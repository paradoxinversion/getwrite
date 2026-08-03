// Last Updated: 2026-08-03

/**
 * @module crypto/keyring-session
 *
 * The one place an unlocked {@link Keyring} lives for the life of a session.
 *
 * **It is a module, not Redux state, and that is deliberate.** `CryptoKey`
 * handles are not serialisable, and putting key material in the store would put
 * it in devtools, in any state snapshot, and in whatever a future persistence
 * middleware decides to write down. `cryptoSlice.ts` holds only what the UI
 * needs to render — absent, locked, or unlocked — and never a key.
 *
 * FR7 in three parts:
 *
 * - *One unlock opens everything* — a single passphrase derives the workspace
 *   key, which unwraps every project's data key at once.
 * - *Memory only* — nothing here writes; `keyring-store.ts` persists wrapped
 *   material, which is not secret.
 * - *Discarded on lock and exit* — {@link lockSession} locks the keyring itself
 *   rather than merely dropping the reference, so anything still holding one
 *   finds it unusable. Process exit frees the memory inherently.
 */
import type { StorageAdapter } from "../io";
import { getStorageAdapter } from "../io";
import { runInStorageContext } from "../storage-context";
import { createKeyring, unlockKeyring, type Keyring } from "./keyring";
import { readWrappedKeyring, writeWrappedKeyring } from "./keyring-store";

/** Raised when the workspace has no keyring — encryption was never set up. */
export class NoKeyringError extends Error {
  constructor() {
    super("This workspace has no keyring; encryption has not been set up.");
    this.name = "NoKeyringError";
  }
}

/** Raised when project keys are needed but the session is locked. */
export class SessionLockedError extends Error {
  constructor() {
    super("The workspace is locked. Unlock it to continue.");
    this.name = "SessionLockedError";
  }
}

/** The unlocked keyring for this session, or `null` while locked. */
let session: Keyring | null = null;

/**
 * The unlocked keyring, or `null` when locked.
 *
 * Prefer {@link requireSessionKeyring} at call sites that cannot proceed
 * without one; this is for code that must branch on lock state.
 *
 * @returns The unlocked keyring, or `null`.
 */
export function getSessionKeyring(): Keyring | null {
  return session;
}

/**
 * Whether the workspace is currently unlocked.
 *
 * @returns `true` when project keys are available.
 */
export function isSessionUnlocked(): boolean {
  return session !== null && !session.isLocked();
}

/**
 * The unlocked keyring, or a typed failure.
 *
 * @returns The unlocked keyring.
 * @throws {SessionLockedError} When the workspace is locked.
 */
export function requireSessionKeyring(): Keyring {
  if (!isSessionUnlocked() || !session) throw new SessionLockedError();
  return session;
}

/**
 * Whether this workspace has ever had encryption set up.
 *
 * The Start screen consults this before deciding whether to prompt at all: a
 * user with no encrypted projects must never see a passphrase prompt (FR4).
 *
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @param adapter - Storage adapter to read through; must be the plain one.
 * @returns `true` when a keyring is present.
 */
export async function workspaceHasKeyring(
  workspaceRoot?: string,
  adapter: StorageAdapter = getStorageAdapter(),
): Promise<boolean> {
  return (await readKeyringVia(workspaceRoot, adapter)) !== null;
}

/**
 * The ids of every encrypted project, readable without unlocking.
 *
 * Wrapped key material is not secret, so the *set* of encrypted projects is
 * knowable while locked — which is what lets the project list show lock state
 * before any passphrase is entered.
 *
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @param adapter - Storage adapter to read through; must be the plain one.
 * @returns Project ids that have a wrapped data key.
 */
export async function encryptedProjectIds(
  workspaceRoot?: string,
  adapter: StorageAdapter = getStorageAdapter(),
): Promise<string[]> {
  const wrapped = await readKeyringVia(workspaceRoot, adapter);
  return wrapped ? Object.keys(wrapped.projects) : [];
}

/**
 * Creates a workspace keyring and leaves the session unlocked.
 *
 * @param passphrase - The user's chosen passphrase.
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @param adapter - Storage adapter to write through; must be the plain one.
 * @returns The unlocked keyring.
 * @throws {Error} When a keyring already exists — overwriting one would orphan
 *   every existing project's data key, which is unrecoverable.
 */
export async function createWorkspaceKeyring(
  passphrase: string,
  workspaceRoot?: string,
  adapter: StorageAdapter = getStorageAdapter(),
): Promise<Keyring> {
  if (await workspaceHasKeyring(workspaceRoot, adapter)) {
    throw new Error(
      "This workspace already has a keyring; creating another would make every existing encrypted project unreadable.",
    );
  }

  const keyring = await createKeyring(passphrase);
  await runVia(workspaceRoot, adapter, () =>
    writeWrappedKeyring(keyring.snapshot(), workspaceRoot),
  );
  session = keyring;
  return keyring;
}

/**
 * Registers a project with the session keyring and persists the result.
 *
 * Deliberately does both. `Keyring.addProject` only mutates memory and returns a
 * snapshot the caller must write; a caller that forgets loses that project's
 * data key at the next unlock, silently and unrecoverably. Nothing outside this
 * module should have to remember that.
 *
 * @param projectId - The project to register.
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @param adapter - Storage adapter to write through; must be the plain one.
 * @returns The project's freshly generated data key.
 * @throws {SessionLockedError} When the workspace is locked.
 */
export async function registerProject(
  projectId: string,
  workspaceRoot?: string,
  adapter: StorageAdapter = getStorageAdapter(),
): Promise<CryptoKey> {
  const keyring = requireSessionKeyring();
  const snapshot = await keyring.addProject(projectId);
  await runVia(workspaceRoot, adapter, () =>
    writeWrappedKeyring(snapshot, workspaceRoot),
  );
  return keyring.projectKey(projectId);
}

/**
 * Unlocks the workspace for this session.
 *
 * On failure the session is left locked rather than partially opened.
 *
 * @param passphrase - The passphrase to try.
 * @param workspaceRoot - Workspace root; defaults to the active projects dir.
 * @param adapter - Storage adapter to read through; must be the plain one.
 * @returns The unlocked keyring.
 * @throws {NoKeyringError} When the workspace has no keyring.
 * @throws {WrongPassphraseError} When the passphrase does not open it.
 */
export async function unlockSession(
  passphrase: string,
  workspaceRoot?: string,
  adapter: StorageAdapter = getStorageAdapter(),
): Promise<Keyring> {
  const wrapped = await readKeyringVia(workspaceRoot, adapter);
  if (!wrapped) throw new NoKeyringError();

  const keyring = await unlockKeyring(wrapped, passphrase);
  session = keyring;
  return keyring;
}

/**
 * Discards every key held for this session.
 *
 * Locks the keyring itself, not just this module's reference: any component
 * still holding one must find it unusable, or locking would be cosmetic.
 * Safe to call when already locked.
 */
export function lockSession(): void {
  session?.lock();
  session = null;
}

/** Test-only hook clearing session state between cases. */
export function __resetKeyringSessionForTests(): void {
  session = null;
}

/**
 * Reads the wrapped keyring through an explicit adapter.
 *
 * @param workspaceRoot - Workspace root.
 * @param adapter - Storage adapter to read through.
 * @returns The wrapped keyring, or `null` when absent.
 */
async function readKeyringVia(
  workspaceRoot: string | undefined,
  adapter: StorageAdapter,
): ReturnType<typeof readWrappedKeyring> {
  return runVia(workspaceRoot, adapter, () =>
    readWrappedKeyring(workspaceRoot),
  );
}

/**
 * Runs a keyring-store call against an explicit adapter.
 *
 * The store resolves its adapter from the ambient storage context; binding one
 * here keeps callers free to pass an adapter explicitly, which the native and
 * object-store paths both need.
 *
 * @param workspaceRoot - Workspace root, bound as the tenant root.
 * @param adapter - Storage adapter to bind.
 * @param fn - The store call to run.
 * @returns Whatever `fn` returns.
 */
function runVia<T>(
  workspaceRoot: string | undefined,
  adapter: StorageAdapter,
  fn: () => Promise<T>,
): Promise<T> {
  if (!workspaceRoot) return fn();
  return runInStorageContext({ tenantRoot: workspaceRoot, adapter }, fn);
}
