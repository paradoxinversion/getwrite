// Last Updated: 2026-08-03

/**
 * @module crypto/primitives
 *
 * The single source of cryptographic operations for GetWrite's end-to-end
 * encryption. Everything above this module works with `CryptoKey` handles and
 * byte arrays; nothing above it chooses an algorithm or a parameter.
 *
 * Two deliberate choices, both established by the spike recorded in
 * `docs/features/feature-specifications/end-to-end-encryption/kdf-spike.md`:
 *
 * - **AES-256-GCM via `globalThis.crypto.subtle`.** `SubtleCrypto` is present in
 *   Node (desktop/Electron) *and* in the Android WebView — Capacitor serves the
 *   app from `https://localhost`, a secure context — so one code path serves
 *   every build target. No dual implementation, no polyfill.
 * - **Argon2id via `@noble/hashes`.** WebCrypto offers only PBKDF2, which is
 *   compute-only and therefore cheap to attack with GPUs; Argon2id's memory cost
 *   is what actually resists offline guessing. `@noble/hashes` is pure JS with
 *   no runtime dependencies, so it needs no WASM instantiation in the WebView.
 *
 * Argon2id here derives the *workspace* key from the user's passphrase. Files
 * are never sealed under that key directly — they are sealed under a per-project
 * data key, which the keyring stores wrapped. That indirection is what makes
 * raising the Argon2id parameters a rewrap of the keyring rather than a rewrite
 * of every file.
 */
import { argon2id } from "@noble/hashes/argon2.js";

/** Length of an AES-256 key, in bytes. */
export const KEY_BYTES = 32;

/** Length of an AES-GCM nonce (96 bits — the size GCM is specified for). */
export const NONCE_BYTES = 12;

/** Length of the AES-GCM authentication tag, in bytes. */
export const TAG_BYTES = 16;

/** Length of an Argon2id salt, in bytes. */
export const SALT_BYTES = 16;

/**
 * Argon2id cost parameters.
 *
 * Persisted in plaintext beside the wrapped keys so they can be raised later
 * without invalidating existing workspaces (FR5).
 */
export interface Argon2Params {
  /** Memory cost in KiB. */
  memoryKiB: number;
  /** Number of passes over memory. */
  iterations: number;
  /** Degree of parallelism. */
  parallelism: number;
}

/**
 * OWASP-minimum Argon2id parameters (m=19 MiB, t=2, p=1).
 *
 * Measured at ~266 ms on a development machine and extrapolated to ~0.8–1.3 s on
 * a mid-range phone — acceptable because unlocking happens once per session.
 */
export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  memoryKiB: 19456,
  iterations: 2,
  parallelism: 1,
};

/**
 * Returns the ambient WebCrypto implementation.
 *
 * @returns The platform `Crypto` object.
 * @throws {Error} When WebCrypto is unavailable, which would otherwise surface
 *   later as a confusing `undefined` property access.
 */
function webcrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error(
      "WebCrypto (crypto.subtle) is unavailable in this runtime; " +
        "encryption requires a secure context.",
    );
  }
  return c;
}

/**
 * Maximum bytes `crypto.getRandomValues` will produce in a single call.
 *
 * Fixed by the Web Crypto specification and enforced by browsers and the
 * Android WebView alike, so larger requests must be filled in chunks.
 */
const MAX_RANDOM_BYTES_PER_CALL = 65536;

/**
 * Generates cryptographically secure random bytes.
 *
 * Requests larger than {@link MAX_RANDOM_BYTES_PER_CALL} are filled in chunks;
 * a single oversized call would throw `QuotaExceededError`.
 *
 * @param length - Number of bytes to generate; must be positive.
 * @returns The random bytes.
 * @throws {Error} When `length` is not a positive integer.
 */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(
      `randomBytes: length must be a positive integer, got ${length}`,
    );
  }
  const crypto = webcrypto();
  const out = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += MAX_RANDOM_BYTES_PER_CALL) {
    crypto.getRandomValues(
      out.subarray(
        offset,
        Math.min(offset + MAX_RANDOM_BYTES_PER_CALL, length),
      ),
    );
  }
  return out;
}

/**
 * Generates a fresh Argon2id salt.
 *
 * @returns A random salt of {@link SALT_BYTES} bytes.
 */
export function generateSalt(): Uint8Array {
  return randomBytes(SALT_BYTES);
}

/**
 * Generates a fresh AES-GCM nonce.
 *
 * Every seal must use a unique nonce under a given key; reuse is catastrophic
 * for GCM, so callers should never cache or reuse the result.
 *
 * @returns A random nonce of {@link NONCE_BYTES} bytes.
 */
export function generateNonce(): Uint8Array {
  return randomBytes(NONCE_BYTES);
}

/**
 * Generates raw key material for a per-project data key.
 *
 * @returns Random bytes of {@link KEY_BYTES} length.
 */
export function generateDataKeyBytes(): Uint8Array {
  return randomBytes(KEY_BYTES);
}

/**
 * Derives raw key material from a passphrase using Argon2id.
 *
 * Synchronous: `@noble/hashes` is pure JS and blocks for the duration of the
 * derivation. Callers on the UI thread should treat this as a deliberate,
 * user-initiated pause (unlock), not something to run per operation.
 *
 * @param passphrase - The user's passphrase; must not be empty.
 * @param salt - Per-workspace salt of {@link SALT_BYTES} bytes.
 * @param params - Argon2id cost parameters.
 * @returns Derived key material of {@link KEY_BYTES} bytes.
 * @throws {Error} When the passphrase is empty or the salt is the wrong length.
 */
export function deriveKeyMaterial(
  passphrase: string,
  salt: Uint8Array,
  params: Argon2Params,
): Uint8Array {
  if (passphrase.length === 0) {
    throw new Error("deriveKeyMaterial: passphrase must not be empty");
  }
  if (salt.length !== SALT_BYTES) {
    throw new Error(
      `deriveKeyMaterial: salt must be ${SALT_BYTES} bytes, got ${salt.length}`,
    );
  }
  return argon2id(passphrase, salt, {
    m: params.memoryKiB,
    t: params.iterations,
    p: params.parallelism,
    dkLen: KEY_BYTES,
  });
}

/**
 * Imports raw key material as a non-extractable AES-GCM key.
 *
 * Non-extractable so the unwrapped key cannot be read back out of the
 * `CryptoKey` handle and accidentally persisted or logged (FR5).
 *
 * @param raw - Key material of exactly {@link KEY_BYTES} bytes.
 * @returns The imported AES-GCM key.
 * @throws {Error} When the key material is the wrong length.
 */
export async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `importAesKey: key material must be ${KEY_BYTES} bytes, got ${raw.length}`,
    );
  }
  return webcrypto().subtle.importKey(
    "raw",
    toArrayBuffer(raw),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Derives the workspace key from a passphrase, ready for use.
 *
 * @param passphrase - The user's passphrase.
 * @param salt - Per-workspace salt.
 * @param params - Argon2id cost parameters.
 * @returns A non-extractable AES-GCM key.
 */
export async function deriveWorkspaceKey(
  passphrase: string,
  salt: Uint8Array,
  params: Argon2Params,
): Promise<CryptoKey> {
  return importAesKey(deriveKeyMaterial(passphrase, salt, params));
}

/**
 * Encrypts a payload with AES-256-GCM.
 *
 * The returned buffer is ciphertext with the 16-byte authentication tag
 * appended — WebCrypto's convention. The nonce is *not* included; framing is
 * the envelope module's concern.
 *
 * @param key - An AES-GCM key.
 * @param nonce - A unique nonce of {@link NONCE_BYTES} bytes.
 * @param plaintext - The bytes to encrypt.
 * @returns Ciphertext with the authentication tag appended.
 * @throws {Error} When the nonce is the wrong length.
 */
export async function encrypt(
  key: CryptoKey,
  nonce: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  assertNonce(nonce);
  const sealed = await webcrypto().subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce), tagLength: TAG_BYTES * 8 },
    key,
    toArrayBuffer(plaintext),
  );
  return new Uint8Array(sealed);
}

/**
 * Decrypts and verifies an AES-256-GCM payload.
 *
 * @param key - The AES-GCM key the payload was sealed under.
 * @param nonce - The nonce used to seal it.
 * @param ciphertext - Ciphertext with the authentication tag appended.
 * @returns The recovered plaintext.
 * @throws {Error} When the nonce is the wrong length, or when verification
 *   fails — a wrong key, a wrong nonce, or any altered byte.
 */
export async function decrypt(
  key: CryptoKey,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  assertNonce(nonce);
  const opened = await webcrypto().subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce), tagLength: TAG_BYTES * 8 },
    key,
    toArrayBuffer(ciphertext),
  );
  return new Uint8Array(opened);
}

/**
 * Validates a nonce's length.
 *
 * @param nonce - The nonce to check.
 * @throws {Error} When the nonce is not {@link NONCE_BYTES} bytes.
 */
function assertNonce(nonce: Uint8Array): void {
  if (nonce.length !== NONCE_BYTES) {
    throw new Error(`nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}`);
  }
}

/**
 * Copies a view's bytes into a standalone `ArrayBuffer`.
 *
 * A `Uint8Array` may be a window onto a larger buffer (`subarray`), and
 * WebCrypto reads the whole underlying buffer rather than the view — so passing
 * the view's `.buffer` directly would silently encrypt or decrypt the wrong
 * bytes. Copying is the correctness-preserving option.
 *
 * @param view - The byte view to copy.
 * @returns An `ArrayBuffer` holding exactly the view's bytes.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(view.length);
  copy.set(view);
  return copy.buffer;
}
