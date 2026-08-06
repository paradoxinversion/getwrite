// Last Updated: 2026-08-03

/**
 * @module crypto/project-marker
 *
 * The per-project record of whether a project opted in to encryption.
 *
 * Two constraints shape this file, and between them they leave very little in
 * it:
 *
 * - **It must be legible before anything can be decrypted.** Deciding which
 *   adapter a project gets requires knowing whether it is encrypted, so the
 *   marker is plaintext JSON read through the *plain* adapter. It can never sit
 *   behind the encrypting decorator — hence the explicit `adapter` parameter
 *   rather than the ambient storage context, which during adapter resolution is
 *   not yet the one this project will end up using.
 * - **It must carry nothing worth hiding** (FR18). No project name, no id, no
 *   user-authored text of any kind: a writer's title is frequently the most
 *   sensitive string they have. Names live in the sealed workspace index
 *   (`name-index.ts`) instead.
 *
 * Presence *is* the signal (FR3): a project that never opted in has no marker
 * file at all, so this feature adds nothing to an unencrypted project on disk.
 *
 * The conversion sweep must skip this file — it is plaintext by design, and
 * sealing it would make the project's own encrypted state unreadable.
 */
import path from "node:path";
import { z } from "zod";
import { atomicWriteFile, runForTenant, type StorageAdapter } from "../io";
import { getPlainStorageAdapter } from "../io";

/** Filename of the per-project encryption marker, inside the project root. */
export const PROJECT_MARKER_FILENAME = ".encrypted.json";

/** Current marker format version. */
const MARKER_VERSION = 1;

/** Zod schema gating the marker as it crosses the filesystem boundary. */
const ProjectMarkerSchema = z.object({
  version: z.number().int().positive(),
  encrypted: z.literal(true),
  encryptedAt: z.string().nonempty(),
});

/** The persisted marker. Contains no user-authored text by construction. */
export type ProjectEncryptionMarker = z.infer<typeof ProjectMarkerSchema>;

/** Raised when a marker exists but cannot be trusted. */
export class ProjectMarkerFormatError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProjectMarkerFormatError";
  }
}

/**
 * Resolves a project's marker path.
 *
 * @param projectRoot - The project directory.
 * @returns Absolute path to the marker file.
 */
function markerPath(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_MARKER_FILENAME);
}

/**
 * Reads a project's encryption marker.
 *
 * A missing marker is the normal, expected state for an unencrypted project and
 * yields `null`. A marker that exists but does not parse is an error: treating
 * corruption as "not encrypted" risks handing an encrypted project to code that
 * would overwrite it with plaintext.
 *
 * @param projectRoot - The project directory.
 * @param adapter - Storage adapter to read through; must be the plain one.
 * @returns The validated marker, or `null` when the project is unencrypted.
 * @throws {ProjectMarkerFormatError} When a marker exists but is unusable.
 */
export async function readProjectMarker(
  projectRoot: string,
  adapter: StorageAdapter = getPlainStorageAdapter(),
): Promise<ProjectEncryptionMarker | null> {
  const target = markerPath(projectRoot);

  let raw: string;
  try {
    raw = await adapter.readFile(target, "utf-8");
  } catch {
    // Absent marker — the project simply never opted in.
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProjectMarkerFormatError(
      `Encryption marker at ${target} is not valid JSON. Refusing to treat a corrupt marker as an unencrypted project.`,
      { cause: error },
    );
  }

  const result = ProjectMarkerSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProjectMarkerFormatError(
      `Encryption marker at ${target} is not valid: ${result.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
      { cause: result.error },
    );
  }
  if (result.data.version !== MARKER_VERSION) {
    throw new ProjectMarkerFormatError(
      `Unsupported encryption-marker version ${result.data.version}; this build supports version ${MARKER_VERSION}.`,
    );
  }
  return result.data;
}

/**
 * Reports whether a project opted in to encryption.
 *
 * @param projectRoot - The project directory.
 * @param adapter - Storage adapter to read through; must be the plain one.
 * @returns `true` when the project carries a valid marker.
 * @throws {ProjectMarkerFormatError} When a marker exists but is unusable — a
 *   corrupt marker must never be silently downgraded to "unencrypted".
 */
export async function isProjectEncrypted(
  projectRoot: string,
  adapter: StorageAdapter = getPlainStorageAdapter(),
): Promise<boolean> {
  return (await readProjectMarker(projectRoot, adapter)) !== null;
}

/**
 * Marks a project as encrypted.
 *
 * @param projectRoot - The project directory.
 * @param adapter - Storage adapter to write through; must be the plain one.
 * @param now - Timestamp to record; defaults to the current time.
 * @returns The marker that was written.
 */
export async function writeProjectMarker(
  projectRoot: string,
  adapter: StorageAdapter = getPlainStorageAdapter(),
  now: Date = new Date(),
): Promise<ProjectEncryptionMarker> {
  const marker: ProjectEncryptionMarker = {
    version: MARKER_VERSION,
    encrypted: true,
    encryptedAt: now.toISOString(),
  };

  // Durable: if this write is lost after the files are sealed, the project
  // looks unencrypted while holding ciphertext — the worst state to be in.
  await runForTenant(
    projectRoot,
    () =>
      atomicWriteFile(
        markerPath(projectRoot),
        JSON.stringify(marker, null, 2),
        { durable: true },
      ),
    adapter,
  );
  return marker;
}

/**
 * Removes a project's encryption marker, returning it to unencrypted status.
 *
 * A no-op when no marker is present, so callers need not check first.
 *
 * @param projectRoot - The project directory.
 * @param adapter - Storage adapter to write through; must be the plain one.
 */
export async function removeProjectMarker(
  projectRoot: string,
  adapter: StorageAdapter = getPlainStorageAdapter(),
): Promise<void> {
  await runForTenant(
    projectRoot,
    async () => {
      try {
        await adapter.rm(markerPath(projectRoot), { force: true });
      } catch {
        // Already absent — the desired end state either way.
      }
    },
    adapter,
  );
}
