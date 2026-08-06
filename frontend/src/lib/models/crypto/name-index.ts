// Last Updated: 2026-08-03

/**
 * @module crypto/name-index
 *
 * A workspace-level map of project id → project name, sealed under the
 * workspace key (FR21).
 *
 * It exists because encrypting a project encrypts its `project.json` too, and
 * the Start screen still has to render something once the user unlocks. Reading
 * a name out of each project would mean one key unwrap plus one manifest
 * decrypt per project; this file makes it **one decryption for the whole list**,
 * which matters most on Android where every read crosses the Capacitor bridge.
 *
 * It deliberately holds *only* names. It is not an alternative source of project
 * data — just enough to draw a list.
 *
 * **This is a second source of truth for names,** and that is its one real
 * hazard: a rename that updates `project.json` but not this index shows a stale
 * name on the Start screen and fails silently rather than loudly. Project
 * create, rename, and delete must all route through {@link setProjectName} /
 * {@link removeProjectName}.
 *
 * Like the keyring, it lives at the workspace root and is read and written
 * through the *plain* adapter — it is sealed by its own content, not by the
 * storage layer, and must be legible without knowing anything about an
 * individual project.
 */
import path from "node:path";
import { z } from "zod";
import { atomicWriteFile, type StorageAdapter } from "../io";
import { getPlainStorageAdapter } from "../io";
import { runInStorageContext } from "../storage-context";
import { withMetaLock } from "../meta-locks";
import { EnvelopeFormatError, open, seal } from "./envelope";

/** Filename of the sealed project-name index, at the workspace root. */
export const NAME_INDEX_FILENAME = ".getwrite-names";

/** Zod schema for the decrypted index payload. */
const NameIndexSchema = z.record(z.string(), z.string());

/** Project id → project name, for encrypted projects. */
export type ProjectNameIndex = z.infer<typeof NameIndexSchema>;

/** Raised when the index exists but cannot be read or trusted. */
export class NameIndexFormatError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NameIndexFormatError";
  }
}

/**
 * Resolves the index path for a workspace.
 *
 * @param workspaceRoot - The workspace (projects-dir) root.
 * @returns Absolute path to the sealed index.
 */
function indexPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, NAME_INDEX_FILENAME);
}

/**
 * Reads and opens the project-name index.
 *
 * An absent index is normal — no encrypted project has been named yet — and
 * yields an empty map. An index that exists but cannot be opened or parsed is an
 * error: reporting it empty would silently blank every project's name on the
 * Start screen, which reads to the user as data loss.
 *
 * @param workspaceKey - The workspace key the index is sealed under.
 * @param workspaceRoot - The workspace root.
 * @param adapter - Storage adapter to read through; must be the plain one.
 * @returns The project id → name map, empty when the index is absent.
 * @throws {NameIndexFormatError} When the index exists but is unusable.
 */
export async function readNameIndex(
  workspaceKey: CryptoKey,
  workspaceRoot: string,
  adapter: StorageAdapter = getPlainStorageAdapter(),
): Promise<ProjectNameIndex> {
  let sealed: Uint8Array;
  try {
    sealed = await adapter.readFileBuffer(indexPath(workspaceRoot));
  } catch {
    return {};
  }

  let opened: Uint8Array;
  try {
    opened = await open(workspaceKey, sealed);
  } catch (error) {
    throw new NameIndexFormatError(
      error instanceof EnvelopeFormatError
        ? `Project-name index at ${indexPath(workspaceRoot)} is not a sealed index.`
        : `Project-name index at ${indexPath(workspaceRoot)} failed authentication: wrong key or corrupted data.`,
      { cause: error },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8").decode(opened));
  } catch (error) {
    throw new NameIndexFormatError(
      "Project-name index decrypted to something that is not JSON.",
      { cause: error },
    );
  }

  const result = NameIndexSchema.safeParse(parsed);
  if (!result.success) {
    throw new NameIndexFormatError(
      "Project-name index is not a map of project id to name.",
      { cause: result.error },
    );
  }
  return result.data;
}

/**
 * Seals and writes the index.
 *
 * @param index - The map to persist.
 * @param workspaceKey - The workspace key to seal under.
 * @param workspaceRoot - The workspace root.
 * @param adapter - Storage adapter to write through; must be the plain one.
 */
async function writeNameIndex(
  index: ProjectNameIndex,
  workspaceKey: CryptoKey,
  workspaceRoot: string,
  adapter: StorageAdapter,
): Promise<void> {
  const sealed = await seal(
    workspaceKey,
    new TextEncoder().encode(JSON.stringify(index)),
  );
  await runInStorageContext({ tenantRoot: workspaceRoot, adapter }, () =>
    atomicWriteFile(indexPath(workspaceRoot), Buffer.from(sealed), {
      durable: true,
    }),
  );
}

/**
 * Applies a change to the index under a lock.
 *
 * Every mutation is read-modify-write on one shared file, so two concurrent
 * renames would otherwise race and the later write would silently discard the
 * earlier one. Serialising on the workspace root makes that impossible.
 *
 * @param workspaceKey - The workspace key.
 * @param workspaceRoot - The workspace root.
 * @param adapter - Storage adapter to use.
 * @param mutate - Produces the next index from the current one.
 * @returns The updated index.
 */
async function updateNameIndex(
  workspaceKey: CryptoKey,
  workspaceRoot: string,
  adapter: StorageAdapter,
  mutate: (current: ProjectNameIndex) => ProjectNameIndex,
): Promise<ProjectNameIndex> {
  return withMetaLock(workspaceRoot, async () => {
    const next = mutate(
      await readNameIndex(workspaceKey, workspaceRoot, adapter),
    );
    await writeNameIndex(next, workspaceKey, workspaceRoot, adapter);
    return next;
  });
}

/**
 * Records or updates a project's name.
 *
 * Call on project create *and* rename — a rename that updates `project.json`
 * without this leaves a stale name on the Start screen.
 *
 * @param projectId - The project's id.
 * @param name - The project's display name.
 * @param workspaceKey - The workspace key.
 * @param workspaceRoot - The workspace root.
 * @param adapter - Storage adapter to use; must be the plain one.
 * @returns The updated index.
 */
export async function setProjectName(
  projectId: string,
  name: string,
  workspaceKey: CryptoKey,
  workspaceRoot: string,
  adapter: StorageAdapter = getPlainStorageAdapter(),
): Promise<ProjectNameIndex> {
  return updateNameIndex(workspaceKey, workspaceRoot, adapter, (current) => ({
    ...current,
    [projectId]: name,
  }));
}

/**
 * Forgets a project's name.
 *
 * A no-op when the project is not in the index, so delete paths need not check.
 *
 * @param projectId - The project's id.
 * @param workspaceKey - The workspace key.
 * @param workspaceRoot - The workspace root.
 * @param adapter - Storage adapter to use; must be the plain one.
 * @returns The updated index.
 */
export async function removeProjectName(
  projectId: string,
  workspaceKey: CryptoKey,
  workspaceRoot: string,
  adapter: StorageAdapter = getPlainStorageAdapter(),
): Promise<ProjectNameIndex> {
  return updateNameIndex(workspaceKey, workspaceRoot, adapter, (current) => {
    const next = { ...current };
    delete next[projectId];
    return next;
  });
}
