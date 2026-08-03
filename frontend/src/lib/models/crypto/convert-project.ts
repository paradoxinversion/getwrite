// Last Updated: 2026-08-03

/**
 * @module crypto/convert-project
 *
 * Converts a project between plaintext and ciphertext, crash-safely and in
 * either direction.
 *
 * ```
 *   1. write the conversion marker   (announce intent before touching data)
 *   2. sweep every file              (skip whatever is already in target form)
 *   3. flip the project marker       (only once every file agrees with it)
 *   4. delete the conversion marker  (leave tolerant-read mode last)
 * ```
 *
 * **There is no journal, and resume is just "run it again."** Envelopes are
 * self-identifying (`envelope.ts`), so the data is its own progress record: the
 * sweep asks each file what form it is in and skips the ones already done. That
 * makes the whole operation idempotent, which in turn makes crash recovery free
 * — there is no separate resume path to write, and none to get wrong. The
 * design was validated across 232 injected-crash scenarios before it was built
 * (`docs/features/feature-specifications/end-to-end-encryption/conversion-spike.md`).
 *
 * **Both directions are the same loop**, differing only in which form counts as
 * "done". FR25 requires the machinery be direction-agnostic even though v1 only
 * exposes encryption in the UI; sharing the loop satisfies that structurally
 * rather than by discipline.
 *
 * **The sweep works on raw bytes**, through the plain adapter, never through the
 * encrypting decorator. It is the thing that produces ciphertext, so it cannot
 * also be reading through something that assumes ciphertext already exists.
 *
 * Two files are deliberately never converted: the project's own encryption
 * marker and this conversion marker. Both must stay legible for the project's
 * state to be knowable at all.
 */
import path from "node:path";
import { z } from "zod";
import type { Dirent } from "node:fs";
import { atomicWriteFile, type StorageAdapter } from "../io";
import { getStorageAdapter } from "../io";
import { runInStorageContext } from "../storage-context";
import { runWithWriteBarrier } from "../write-barrier";
import { isEnvelope, open, seal } from "./envelope";
import {
  PROJECT_MARKER_FILENAME,
  removeProjectMarker,
  writeProjectMarker,
} from "./project-marker";

/** Which way a conversion runs. */
export type ConversionDirection = "encrypt" | "decrypt";

/** Filename of the in-progress marker, inside the project root. */
const CONVERSION_MARKER_FILENAME = ".converting.json";

/** Current conversion-marker format version. */
const CONVERSION_MARKER_VERSION = 1;

/** Zod schema for the in-progress marker. */
const ConversionMarkerSchema = z.object({
  version: z.number().int().positive(),
  direction: z.enum(["encrypt", "decrypt"]),
  startedAt: z.string().nonempty(),
});

/** The persisted in-progress marker. */
export type ConversionMarker = z.infer<typeof ConversionMarkerSchema>;

/** What a completed conversion did. */
export interface ConversionResult {
  /** Files rewritten into the target form. */
  filesConverted: number;
  /** Files already in the target form and left untouched. */
  filesSkipped: number;
  /** Orphaned `.tmp` files cleaned up from an earlier interrupted run. */
  tempsRemoved: number;
}

/** Raised when a conversion is already under way in the other direction. */
export class ConversionDirectionMismatchError extends Error {
  constructor(requested: ConversionDirection, inProgress: ConversionDirection) {
    super(
      `Cannot ${requested} this project: a ${inProgress} conversion was interrupted and must be finished first.`,
    );
    this.name = "ConversionDirectionMismatchError";
  }
}

/** Options accepted by {@link convertProject}. */
export interface ConvertProjectOptions {
  /** The project directory to convert. */
  projectRoot: string;
  /** Which way to convert. */
  direction: ConversionDirection;
  /** The project's data key. */
  key: CryptoKey;
  /** Storage adapter to use; must be the plain one. Defaults to the active one. */
  adapter?: StorageAdapter;
  /** Called after each file is examined, for progress reporting. */
  onProgress?: (progress: { done: number; total: number }) => void;
}

/**
 * Resolves the conversion marker's path.
 *
 * @param projectRoot - The project directory.
 * @returns Absolute path to the marker.
 */
function conversionMarkerPath(projectRoot: string): string {
  return path.join(projectRoot, CONVERSION_MARKER_FILENAME);
}

/**
 * Reads the in-progress conversion marker, if any.
 *
 * Its presence means a conversion was started and has not finished — which is
 * both the resume signal and, from Task 15 onward, the switch that puts reads
 * into tolerant mode.
 *
 * @param projectRoot - The project directory.
 * @param adapter - Storage adapter to read through; must be the plain one.
 * @returns The marker, or `null` when no conversion is in flight.
 */
export async function readConversionMarker(
  projectRoot: string,
  adapter: StorageAdapter = getStorageAdapter(),
): Promise<ConversionMarker | null> {
  let raw: string;
  try {
    raw = await adapter.readFile(conversionMarkerPath(projectRoot), "utf-8");
  } catch {
    return null;
  }
  const parsed = ConversionMarkerSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

/**
 * Converts every file in a project into the target form.
 *
 * Safe to call repeatedly: files already in the target form are skipped, so a
 * second call after an interrupted first one simply finishes the job, and a
 * call against an already-converted project is a no-op.
 *
 * @param options - See {@link ConvertProjectOptions}.
 * @returns Counts of what the sweep did.
 * @throws {ConversionDirectionMismatchError} When an interrupted conversion in
 *   the opposite direction must be finished first.
 * @throws {ProjectBusyError} When another conversion holds this project's write
 *   barrier.
 */
export async function convertProject(
  options: ConvertProjectOptions,
): Promise<ConversionResult> {
  const { projectRoot, direction, key, onProgress } = options;
  const adapter = options.adapter ?? getStorageAdapter();

  return runWithWriteBarrier(projectRoot, async () => {
    await claimConversion(projectRoot, direction, adapter);

    const files = await listProjectFiles(projectRoot, adapter);
    const result: ConversionResult = {
      filesConverted: 0,
      filesSkipped: 0,
      tempsRemoved: 0,
    };

    let done = 0;
    for (const file of files) {
      await convertOneFile(file, direction, key, adapter, projectRoot, result);
      onProgress?.({ done: ++done, total: files.length });
    }

    // Only now does the project's declared state match every file in it.
    if (direction === "encrypt") await writeProjectMarker(projectRoot, adapter);
    else await removeProjectMarker(projectRoot, adapter);

    // Last: leaving the in-progress state is what ends tolerant reads.
    await adapter.rm(conversionMarkerPath(projectRoot), { force: true });

    return result;
  });
}

/**
 * Writes the in-progress marker, or validates an existing one.
 *
 * @param projectRoot - The project directory.
 * @param direction - The direction being requested.
 * @param adapter - Storage adapter to use.
 * @throws {ConversionDirectionMismatchError} When a conversion in the other
 *   direction is unfinished.
 */
async function claimConversion(
  projectRoot: string,
  direction: ConversionDirection,
  adapter: StorageAdapter,
): Promise<void> {
  const existing = await readConversionMarker(projectRoot, adapter);
  if (existing) {
    // Switching direction halfway would leave files in both forms with no
    // record of which is which. Finish what was started.
    if (existing.direction !== direction) {
      throw new ConversionDirectionMismatchError(direction, existing.direction);
    }
    return;
  }

  const marker: ConversionMarker = {
    version: CONVERSION_MARKER_VERSION,
    direction,
    startedAt: new Date().toISOString(),
  };
  await writeThrough(projectRoot, adapter, () =>
    atomicWriteFile(
      conversionMarkerPath(projectRoot),
      JSON.stringify(marker, null, 2),
      { durable: true },
    ),
  );
}

/**
 * Converts a single file, or accounts for why it was left alone.
 *
 * @param file - Absolute path of the file.
 * @param direction - Conversion direction.
 * @param key - The project data key.
 * @param adapter - Storage adapter to use.
 * @param projectRoot - The project directory.
 * @param result - Running totals, mutated in place.
 */
async function convertOneFile(
  file: string,
  direction: ConversionDirection,
  key: CryptoKey,
  adapter: StorageAdapter,
  projectRoot: string,
  result: ConversionResult,
): Promise<void> {
  // An interrupted atomic write leaves a temp behind; the original is intact,
  // so the temp is always safe to drop and the file is redone below.
  if (file.endsWith(".tmp")) {
    await adapter.rm(file, { force: true });
    result.tempsRemoved += 1;
    return;
  }

  const raw = await adapter.readFileBuffer(file);
  const wantSealed = direction === "encrypt";
  if (isEnvelope(raw) === wantSealed) {
    result.filesSkipped += 1;
    return;
  }

  const next = wantSealed ? await seal(key, raw) : await open(key, raw);
  await writeThrough(projectRoot, adapter, () =>
    atomicWriteFile(file, Buffer.from(next)),
  );
  result.filesConverted += 1;
}

/**
 * Lists every convertible file under a project, deepest paths included.
 *
 * The two markers are excluded: both must stay legible, and sealing either would
 * make the project's own state unknowable.
 *
 * @param projectRoot - The project directory.
 * @param adapter - Storage adapter to read through.
 * @returns Absolute file paths, in a stable order.
 */
async function listProjectFiles(
  projectRoot: string,
  adapter: StorageAdapter,
): Promise<string[]> {
  const excluded = new Set([
    PROJECT_MARKER_FILENAME,
    CONVERSION_MARKER_FILENAME,
  ]);
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = (await adapter.readdir(dir, {
      withFileTypes: true,
    })) as Dirent[];
    for (const entry of entries) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (!(dir === projectRoot && excluded.has(entry.name)))
        out.push(child);
    }
  }

  await walk(projectRoot);
  return out.sort();
}

/**
 * Runs a write inside a storage context bound to this project and adapter.
 *
 * Reuses `atomicWriteFile`'s tested write-temp-then-rename path rather than
 * reimplementing it. The context carries `projectRoot`, so the write is checked
 * against the write barrier — and permitted, since the conversion is the holder.
 *
 * @param projectRoot - The project directory.
 * @param adapter - Storage adapter to bind.
 * @param fn - The write to perform.
 */
async function writeThrough(
  projectRoot: string,
  adapter: StorageAdapter,
  fn: () => Promise<void>,
): Promise<void> {
  await runInStorageContext(
    { tenantRoot: path.dirname(projectRoot), adapter, projectRoot },
    fn,
  );
}
