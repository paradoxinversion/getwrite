// Last Updated: 2026-08-03

/**
 * @module crypto/keyring-store
 *
 * Persistence for the wrapped keyring.
 *
 * The keyring lives at the **workspace root** — the directory `resolveProjectsDir()`
 * returns, which contains the project folders — and never inside a project. That
 * placement is a hard requirement, not a preference: the keyring must be readable
 * *before* any project can be decrypted, so it can never itself sit behind the
 * encrypting adapter. Reads and writes here always go through the plain storage
 * adapter.
 *
 * Nothing written here is secret. The file holds the KDF salt and parameters in
 * plaintext plus sealed key material; the passphrase and every unwrapped key stay
 * in memory (see `keyring.ts`).
 */
import path from "node:path";
import { atomicWriteFile, exists, mkdir, readFile } from "../io";
import { resolveProjectsDir } from "../projects-dir";
import {
  KeyringFormatError,
  parseWrappedKeyring,
  type WrappedKeyring,
} from "./keyring";

/**
 * Filename of the wrapped keyring.
 *
 * Dot-prefixed so directory listings of the workspace root can skip it by the
 * same convention that already skips `.DS_Store`, rather than mistaking it for a
 * project folder.
 */
export const KEYRING_FILENAME = ".getwrite-keyring.json";

/**
 * Resolves the keyring's path for a workspace.
 *
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @returns Absolute path to the keyring file.
 */
function keyringPath(workspaceRoot?: string): string {
  return path.join(workspaceRoot ?? resolveProjectsDir(), KEYRING_FILENAME);
}

/**
 * Reports whether a workspace has a keyring — that is, whether encryption has
 * ever been enabled in it.
 *
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @returns `true` when a keyring file is present.
 */
export async function keyringExists(workspaceRoot?: string): Promise<boolean> {
  return exists(keyringPath(workspaceRoot));
}

/**
 * Reads and validates a workspace's keyring.
 *
 * A missing file is a normal state — it simply means encryption was never
 * enabled — and yields `null`. A file that exists but cannot be parsed is an
 * error: silently treating corruption as "no encryption" would present an
 * encrypted workspace as an empty one, and could lead to overwriting it.
 *
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @returns The validated keyring, or `null` when absent.
 * @throws {KeyringFormatError} When the file exists but is unreadable or invalid.
 */
export async function readWrappedKeyring(
  workspaceRoot?: string,
): Promise<WrappedKeyring | null> {
  const target = keyringPath(workspaceRoot);
  if (!(await exists(target))) return null;

  const raw = await readFile(target, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new KeyringFormatError(
      `Keyring at ${target} is not valid JSON. Refusing to treat a corrupt keyring as an absent one.`,
      { cause: error },
    );
  }
  return parseWrappedKeyring(parsed);
}

/**
 * Writes a workspace's keyring atomically and durably.
 *
 * Durable because losing this file loses every encrypted project in the
 * workspace: the data keys exist nowhere else, so a keyring lost to a crash is
 * indistinguishable from a forgotten passphrase.
 *
 * @param wrapped - The keyring to persist.
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 */
export async function writeWrappedKeyring(
  wrapped: WrappedKeyring,
  workspaceRoot?: string,
): Promise<void> {
  const root = workspaceRoot ?? resolveProjectsDir();
  await mkdir(root, { recursive: true });
  await atomicWriteFile(
    path.join(root, KEYRING_FILENAME),
    JSON.stringify(wrapped, null, 2),
    { durable: true },
  );
}
