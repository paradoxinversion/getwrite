// Last Updated: 2026-08-03

/**
 * @module lib/api/encryption
 *
 * Client-facing encryption calls for the web and desktop builds.
 *
 * Thin `fetch` wrappers over `/api/encryption`. The keyring lives server-side on
 * this path — the model layer needs `node:fs` — so the browser asks the server
 * to unlock, enable, or lock, and receives lock *state* back. No key material
 * crosses this boundary in either direction.
 *
 * The native Android build does not use these: there the same modules run
 * in-process in the WebView, behind `createTransport` (ADR-021). Wiring that
 * pair is Task 21's job.
 */

/** Workspace lock state, as the UI renders it. */
export interface EncryptionStatus {
  /** Whether this deployment may use encryption at all (FR23). */
  isAvailable: boolean;
  /** Whether a workspace keyring exists. */
  hasKeyring: boolean;
  /** Whether the workspace is open for this session. */
  isUnlocked: boolean;
  /** Ids of projects holding a data key — knowable while locked. */
  encryptedProjectIds: string[];
}

/**
 * Sends a request and unwraps its status payload.
 *
 * @param init - Fetch options; omit for a plain status read.
 * @returns The workspace's lock state after the request.
 * @throws {Error} With the server's message, so callers can show it verbatim.
 */
async function request(init?: RequestInit): Promise<EncryptionStatus> {
  const response = await fetch("/api/encryption", {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Encryption request failed.");
  }
  return (await response.json()) as EncryptionStatus;
}

/**
 * Reads the workspace's lock state.
 *
 * @returns The current status.
 */
export function fetchEncryptionStatus(): Promise<EncryptionStatus> {
  return request();
}

/**
 * Opens the workspace for this session.
 *
 * @param passphrase - The passphrase to try.
 * @returns The status after unlocking.
 */
export function unlockWorkspaceRequest(
  passphrase: string,
): Promise<EncryptionStatus> {
  return request({
    method: "POST",
    body: JSON.stringify({ action: "unlock", passphrase }),
  });
}

/**
 * Discards every key held for this session.
 *
 * @returns The status after locking.
 */
export function lockWorkspaceRequest(): Promise<EncryptionStatus> {
  return request({ method: "POST", body: JSON.stringify({ action: "lock" }) });
}

/**
 * Encrypts a project, creating the workspace keyring when `passphrase` is given.
 *
 * @param projectId - The project's directory id.
 * @param projectName - The project's display name.
 * @param passphrase - A new workspace passphrase, or `null` to reuse the session.
 * @returns The status after conversion.
 */
export function enableProjectEncryptionRequest(
  projectId: string,
  projectName: string,
  passphrase: string | null,
): Promise<EncryptionStatus> {
  return request({
    method: "POST",
    body: JSON.stringify({
      action: "enable",
      projectId,
      projectName,
      passphrase,
    }),
  });
}

/**
 * Finishes any conversion a crash left half-done.
 *
 * @returns The status afterwards.
 */
export function resumeConversionsRequest(): Promise<EncryptionStatus> {
  return request({
    method: "POST",
    body: JSON.stringify({ action: "resume" }),
  });
}
