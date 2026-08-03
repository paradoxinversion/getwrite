// Last Updated: 2026-08-03

/**
 * @module api/encryption
 *
 * The HTTP surface for end-to-end encryption on web and desktop.
 *
 * It exists because the keyring lives *server-side* on this path. The model
 * layer needs `node:fs`, so the browser cannot call `keyring-session.ts` or
 * `enable-encryption.ts` directly — unlike the native Android build, where the
 * same modules run in-process inside the WebView.
 *
 * One route with an action discriminator rather than five sibling routes:
 * encryption is a single session-scoped surface whose operations share the same
 * guard, the same failure mapping, and the same lifecycle. Splitting it would
 * duplicate all three.
 *
 * Passphrases arrive in the request body and are never logged, never stored, and
 * never echoed back. What the client gets is lock *state*, never key material.
 */
import { NextResponse } from "next/server";
import { withStorageContext } from "../_tenant/with-storage-context";
import {
  EncryptionUnavailableError,
  isEncryptionAvailable,
} from "../../../src/lib/models/crypto/encryption-availability";
import {
  NoKeyringError,
  encryptedProjectIds,
  isSessionUnlocked,
  lockSession,
  unlockSession,
  workspaceHasKeyring,
} from "../../../src/lib/models/crypto/keyring-session";
import { WrongPassphraseError } from "../../../src/lib/models/crypto/keyring";
import {
  enableProjectEncryption,
  resumeInterruptedConversions,
} from "../../../src/lib/models/crypto/enable-encryption";

/** What the client may ask this route to do. */
type EncryptionAction =
  | { action: "unlock"; passphrase: string }
  | { action: "lock" }
  | {
      action: "enable";
      projectId: string;
      projectName: string;
      passphrase: string | null;
    }
  | { action: "resume" };

/** The lock state the UI renders from. Never includes key material. */
interface EncryptionStatus {
  isAvailable: boolean;
  hasKeyring: boolean;
  isUnlocked: boolean;
  encryptedProjectIds: string[];
}

/**
 * Reads the workspace's current lock state.
 *
 * @returns Availability, whether a keyring exists, and whether it is open.
 */
async function readStatus(): Promise<EncryptionStatus> {
  if (!isEncryptionAvailable()) {
    return {
      isAvailable: false,
      hasKeyring: false,
      isUnlocked: false,
      encryptedProjectIds: [],
    };
  }
  return {
    isAvailable: true,
    hasKeyring: await workspaceHasKeyring(),
    isUnlocked: isSessionUnlocked(),
    encryptedProjectIds: await encryptedProjectIds(),
  };
}

/**
 * Maps a thrown value to the status code and message the client should see.
 *
 * @param error - The thrown value.
 * @returns A JSON error response.
 */
function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof EncryptionUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof WrongPassphraseError) {
    // 401, and deliberately not distinguished from any other wrong-passphrase
    // outcome: the client only needs "that did not open it".
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof NoKeyringError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  const message =
    error instanceof Error ? error.message : "Encryption request failed.";
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Returns the workspace's lock state.
 *
 * @returns The current {@link EncryptionStatus}.
 */
async function getEncryptionStatus(): Promise<NextResponse> {
  try {
    return NextResponse.json(await readStatus());
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Performs a lock-state or conversion action.
 *
 * @param request - The incoming request carrying an {@link EncryptionAction}.
 * @returns The resulting {@link EncryptionStatus}, or an error.
 */
async function postEncryptionAction(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as EncryptionAction;

    switch (body.action) {
      case "unlock":
        await unlockSession(body.passphrase);
        break;
      case "lock":
        lockSession();
        break;
      case "enable":
        await enableProjectEncryption({
          projectId: body.projectId,
          projectName: body.projectName,
          passphrase: body.passphrase,
        });
        break;
      case "resume":
        await resumeInterruptedConversions();
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json(await readStatus());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withStorageContext(getEncryptionStatus);
export const POST = withStorageContext(postEncryptionAction);
