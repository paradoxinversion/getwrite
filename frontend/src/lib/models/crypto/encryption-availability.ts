// Last Updated: 2026-08-03

/**
 * @module crypto/encryption-availability
 *
 * Whether this deployment may use end-to-end encryption at all.
 *
 * Encryption is a desktop and native-Android feature (FR23). The hosted
 * deployment is excluded deliberately: making it meaningful there requires the
 * whole model layer to run in the browser over a remote blob backend, which is
 * a separate feature. Offering it on hosted before that exists would produce
 * something strictly worse than no encryption — a padlock whose key the server
 * holds.
 *
 * The check is server-side and fail-closed. A client-only gate would hide the
 * UI while leaving the code path reachable, which is not a gate at all.
 */
import { isHostedAuthActive } from "../../auth/auth-config";

/** Raised when encryption is attempted on a deployment that cannot offer it. */
export class EncryptionUnavailableError extends Error {
  constructor() {
    super(
      "Encryption is not available on the hosted deployment. It is supported on the desktop and Android apps.",
    );
    this.name = "EncryptionUnavailableError";
  }
}

/**
 * Whether encryption may be offered and used here.
 *
 * @returns `false` whenever hosted auth is active, `true` otherwise.
 */
export function isEncryptionAvailable(): boolean {
  return !isHostedAuthActive();
}

/**
 * Fails unless encryption is available on this deployment.
 *
 * @throws {EncryptionUnavailableError} When running hosted.
 */
export function assertEncryptionAvailable(): void {
  if (!isEncryptionAvailable()) throw new EncryptionUnavailableError();
}
