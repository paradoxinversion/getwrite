// Last Updated: 2026-08-03

/**
 * @module crypto/enable-encryption
 *
 * Turning encryption on for one project, end to end.
 *
 * Four steps, in an order that matters:
 *
 * 1. Establish the workspace keyring — created from a new passphrase the first
 *    time, reused from the unlocked session afterwards.
 * 2. Generate and persist this project's data key.
 * 3. Record its name in the sealed index, so the Start screen can list it
 *    lazily once unlocked (FR21).
 * 4. Sweep the project into ciphertext (`convert-project.ts`).
 *
 * The key is persisted *before* any file is sealed. The reverse order would
 * leave a window where a crash produces ciphertext no key can open — the one
 * unrecoverable failure this feature can actually cause.
 *
 * `resumeInterruptedConversions` finishes anything a crash left half-done.
 * Because the sweep is idempotent it needs no special recovery path: it simply
 * runs again, skipping whatever is already sealed (FR22).
 */
import path from "node:path";
import type { StorageAdapter } from "../io";
import { getStorageAdapter, readdir } from "../io";
import { resolveProjectsDir } from "../projects-dir";
import {
  convertProject,
  readConversionMarker,
  type ConversionResult,
} from "./convert-project";
import {
  createWorkspaceKeyring,
  registerProject,
  requireSessionKeyring,
} from "./keyring-session";
import { setProjectName } from "./name-index";

/** Options accepted by {@link enableProjectEncryption}. */
export interface EnableEncryptionOptions {
  /** The project's directory id. */
  projectId: string;
  /** The project's display name, recorded in the sealed index. */
  projectName: string;
  /**
   * A new workspace passphrase, or `null` to use the unlocked session.
   *
   * `null` is the normal case for a second project: one passphrase covers the
   * whole workspace.
   */
  passphrase: string | null;
  /** Workspace root; defaults to the active projects dir. */
  workspaceRoot?: string;
  /** Storage adapter to use; must be the plain one. */
  adapter?: StorageAdapter;
  /** Reports sweep progress so the UI can show something during the wait. */
  onProgress?: (progress: { done: number; total: number }) => void;
}

/**
 * Encrypts a project, setting up the workspace keyring if this is the first one.
 *
 * @param options - See {@link EnableEncryptionOptions}.
 * @returns What the conversion sweep did.
 * @throws {SessionLockedError} When no passphrase is given and the workspace is
 *   locked.
 * @throws {ProjectBusyError} When the project is already being converted.
 */
export async function enableProjectEncryption(
  options: EnableEncryptionOptions,
): Promise<ConversionResult> {
  const { projectId, projectName, passphrase, onProgress } = options;
  const adapter = options.adapter ?? getStorageAdapter();
  const workspaceRoot = options.workspaceRoot ?? resolveProjectsDir();

  const keyring = passphrase
    ? await createWorkspaceKeyring(passphrase, workspaceRoot, adapter)
    : requireSessionKeyring();

  // Persist the key before sealing anything: ciphertext without a stored key is
  // the one failure here that cannot be undone.
  const key = keyring.hasProject(projectId)
    ? keyring.projectKey(projectId)
    : await registerProject(projectId, workspaceRoot, adapter);

  await setProjectName(
    projectId,
    projectName,
    keyring.workspaceKey(),
    workspaceRoot,
    adapter,
  );

  return convertProject({
    projectRoot: path.join(workspaceRoot, projectId),
    direction: "encrypt",
    key,
    adapter,
    onProgress,
  });
}

/**
 * Finishes any conversion a crash left half-done.
 *
 * Intended for app startup. Needs the workspace unlocked, since finishing a
 * sweep requires the project's data key; while locked the half-converted
 * projects simply stay readable through tolerant mode (Task 15) until someone
 * unlocks.
 *
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @param adapter - Storage adapter to use; must be the plain one.
 * @returns Ids of the projects whose conversions were completed.
 */
export async function resumeInterruptedConversions(
  workspaceRoot?: string,
  adapter: StorageAdapter = getStorageAdapter(),
): Promise<string[]> {
  const root = workspaceRoot ?? resolveProjectsDir();
  const keyring = requireSessionKeyring();
  const resumed: string[] = [];

  for (const id of (await readdir(root)).filter((n) => !n.startsWith("."))) {
    const projectRoot = path.join(root, id);
    const marker = await readConversionMarker(projectRoot, adapter);
    if (!marker || !keyring.hasProject(id)) continue;

    // Re-running the sweep *is* the recovery path — it skips whatever is
    // already in the target form.
    await convertProject({
      projectRoot,
      direction: marker.direction,
      key: keyring.projectKey(id),
      adapter,
    });
    resumed.push(id);
  }

  return resumed;
}
