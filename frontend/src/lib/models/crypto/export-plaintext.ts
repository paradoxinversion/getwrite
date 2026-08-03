// Last Updated: 2026-08-03

/**
 * @module crypto/export-plaintext
 *
 * Writes an unlocked encrypted project out as an ordinary, unencrypted project
 * directory.
 *
 * This is FR24's escape hatch, and the reason opt-in is not a one-way door.
 * v1 has no in-place decryption, so without this a writer who encrypts a project
 * and changes their mind has no route back at all. It produces a *complete,
 * openable project* — not compiled manuscript output — so the copy can simply be
 * opened as a normal project.
 *
 * Both encryption markers are deliberately omitted from the copy: carrying them
 * over would produce a directory that claims to be encrypted while holding
 * plaintext, which is precisely the state every other part of this feature works
 * to prevent.
 *
 * Files are opened individually rather than by running the conversion sweep,
 * because the sweep rewrites in place and this must not touch the original. The
 * decrypt logic is the same `isEnvelope`/`open` pair the sweep uses, so a
 * half-converted project exports correctly too.
 */
import path from "node:path";
import type { Dirent } from "node:fs";
import type { StorageAdapter } from "../io";
import { getStorageAdapter } from "../io";
import { isEnvelope, open } from "./envelope";
import { PROJECT_MARKER_FILENAME } from "./project-marker";

/** Filenames that must never appear in a plaintext export. */
const OMITTED = new Set([PROJECT_MARKER_FILENAME, ".converting.json"]);

/** Options accepted by {@link exportProjectAsPlaintext}. */
export interface ExportPlaintextOptions {
  /** The encrypted project directory to read. */
  projectRoot: string;
  /** Where to write the plaintext copy. Must be empty or absent. */
  destinationRoot: string;
  /** The project's data key. */
  key: CryptoKey;
  /** Storage adapter to use; must be the plain one. */
  adapter?: StorageAdapter;
  /** Reports progress so a long export can show something. */
  onProgress?: (progress: { done: number; total: number }) => void;
}

/** What an export produced. */
export interface ExportPlaintextResult {
  /** Number of files written to the destination. */
  filesWritten: number;
}

/**
 * Exports an unlocked encrypted project as a plaintext project directory.
 *
 * @param options - See {@link ExportPlaintextOptions}.
 * @returns How many files were written.
 * @throws {Error} When the destination sits inside the project, or already has
 *   content — either would risk destroying data rather than copying it.
 * @throws {EnvelopeIntegrityError} When a file cannot be opened with this key.
 */
export async function exportProjectAsPlaintext(
  options: ExportPlaintextOptions,
): Promise<ExportPlaintextResult> {
  const { projectRoot, destinationRoot, key, onProgress } = options;
  const adapter = options.adapter ?? getStorageAdapter();

  assertSafeDestination(projectRoot, destinationRoot);
  await assertEmptyDestination(destinationRoot, adapter);

  const files = await listExportableFiles(projectRoot, adapter);
  let done = 0;

  for (const filePath of files) {
    const relative = filePath.slice(projectRoot.length + 1);
    const target = path.join(destinationRoot, relative);

    const raw = await adapter.readFileBuffer(filePath);
    // Tolerant by construction: a half-converted project holds both forms, and
    // the escape hatch has to work in exactly that situation.
    const plaintext = isEnvelope(raw) ? await open(key, raw) : raw;

    await adapter.mkdir(path.dirname(target), { recursive: true });
    await adapter.writeFile(target, Buffer.from(plaintext));

    // Incremented on its own line, deliberately: `onProgress?.({done: ++done})`
    // never evaluates its argument when no callback is supplied, so the count
    // would silently stay at zero for every caller that ignores progress.
    done += 1;
    onProgress?.({ done, total: files.length });
  }

  return { filesWritten: done };
}

/**
 * Rejects a destination that would corrupt the source.
 *
 * @param projectRoot - The project being exported.
 * @param destinationRoot - The proposed destination.
 * @throws {Error} When the destination is inside the project, or is the project.
 */
function assertSafeDestination(
  projectRoot: string,
  destinationRoot: string,
): void {
  const source = path.resolve(projectRoot);
  const target = path.resolve(destinationRoot);
  if (target === source || target.startsWith(`${source}${path.sep}`)) {
    throw new Error(
      "Cannot export a project into itself; choose a destination outside the project.",
    );
  }
}

/**
 * Rejects a destination that already holds files.
 *
 * @param destinationRoot - The proposed destination.
 * @param adapter - Storage adapter to inspect with.
 * @throws {Error} When the destination exists and is not empty.
 */
async function assertEmptyDestination(
  destinationRoot: string,
  adapter: StorageAdapter,
): Promise<void> {
  try {
    const existing = await adapter.readdir(destinationRoot);
    if (existing.length > 0) {
      throw new Error(
        `Cannot export into ${destinationRoot}: the destination already has content.`,
      );
    }
  } catch (error) {
    // A missing destination is the expected case; anything else is real.
    if (
      error instanceof Error &&
      error.message.includes("already has content")
    ) {
      throw error;
    }
  }
}

/**
 * Lists every file that belongs in a plaintext export.
 *
 * Omits both encryption markers, so the copy opens as an ordinary project, and
 * any `.tmp` left by an interrupted atomic write.
 *
 * @param projectRoot - The project directory.
 * @param adapter - Storage adapter to read through.
 * @returns Absolute file paths, in a stable order.
 */
async function listExportableFiles(
  projectRoot: string,
  adapter: StorageAdapter,
): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = (await adapter.readdir(dir, {
      withFileTypes: true,
    })) as Dirent[];
    for (const entry of entries) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(child);
      } else if (!OMITTED.has(entry.name) && !entry.name.endsWith(".tmp")) {
        out.push(child);
      }
    }
  }

  await walk(projectRoot);
  return out.sort();
}
