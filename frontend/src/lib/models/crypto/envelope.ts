// Last Updated: 2026-08-03

/**
 * @module crypto/envelope
 *
 * The on-disk framing for an encrypted file: a self-identifying, versioned
 * container around an AES-256-GCM payload.
 *
 * ```
 *   0       4     5              17                        n
 *   +-------+-----+--------------+-------------------------+
 *   | magic | ver | nonce (12 B) | ciphertext + tag (16 B) |
 *   +-------+-----+--------------+-------------------------+
 * ```
 *
 * **Self-identification is a correctness requirement, not a convenience.** The
 * conversion sweep (Task 14) decides what work remains by inspecting the files
 * themselves, which is what lets an interrupted conversion resume by simply
 * running again — no journal, no separate resume path. See
 * `docs/features/feature-specifications/end-to-end-encryption/conversion-spike.md`.
 *
 * The magic bytes end in `0x00` so no UTF-8 text file can collide with them: a
 * NUL byte cannot appear in the first four bytes of the JSON, Markdown, or plain
 * text GetWrite stores.
 *
 * The version byte covers the *cipher and framing*, so a future algorithm change
 * can be introduced without a data migration. It deliberately does not describe
 * the KDF: files are sealed under a per-project data key, never under the
 * passphrase-derived key, so raising the Argon2id parameters rewraps the keyring
 * and leaves every file untouched.
 */
import {
  NONCE_BYTES,
  TAG_BYTES,
  decrypt,
  encrypt,
  generateNonce,
} from "./primitives";

/** Magic bytes identifying a GetWrite envelope: `G`, `W`, `E`, NUL. */
const MAGIC = Uint8Array.from([0x47, 0x57, 0x45, 0x00]);

/** Current envelope format version. */
export const ENVELOPE_VERSION = 1;

/** Byte length of the fixed header: magic + version + nonce. */
export const ENVELOPE_HEADER_BYTES = MAGIC.length + 1 + NONCE_BYTES;

/** Total bytes an envelope adds to its payload. */
export const ENVELOPE_OVERHEAD_BYTES = ENVELOPE_HEADER_BYTES + TAG_BYTES;

/** Offset at which the nonce begins. */
const NONCE_OFFSET = MAGIC.length + 1;

/**
 * Raised when a buffer is not a well-formed envelope — not encrypted at all,
 * truncated, or written by an unknown format version.
 *
 * Distinct from {@link EnvelopeIntegrityError}: this means "this is not
 * ciphertext", which during a conversion is an expected, benign state.
 */
export class EnvelopeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeFormatError";
  }
}

/**
 * Raised when a well-formed envelope fails authenticated decryption — a wrong
 * key, or tampered/corrupted bytes.
 *
 * Distinct from {@link EnvelopeFormatError}: this means "this is ciphertext and
 * it cannot be trusted", which is never benign. It must reach the user as an
 * integrity failure and never as empty content (FR15).
 */
export class EnvelopeIntegrityError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EnvelopeIntegrityError";
  }
}

/**
 * Reports whether a buffer is a well-formed envelope of a known version.
 *
 * Total function: never throws, whatever it is handed. Callers use it to
 * classify existing files, so a malformed or truncated buffer must answer
 * `false` rather than fail.
 *
 * @param data - Bytes to inspect.
 * @returns `true` when the buffer carries the magic, a known version, and is
 *   long enough to hold a header and tag.
 */
export function isEnvelope(data: Uint8Array): boolean {
  if (data.length < ENVELOPE_OVERHEAD_BYTES) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (data[i] !== MAGIC[i]) return false;
  }
  return data[MAGIC.length] === ENVELOPE_VERSION;
}

/**
 * Seals a payload into a fresh envelope.
 *
 * A new nonce is generated per call, so sealing identical plaintext twice
 * yields different envelopes — required for AES-GCM safety.
 *
 * @param key - The AES-GCM key to seal under.
 * @param plaintext - The bytes to protect.
 * @returns A complete envelope, ready to write to disk.
 */
export async function seal(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const nonce = generateNonce();
  const ciphertext = await encrypt(key, nonce, plaintext);

  const envelope = new Uint8Array(ENVELOPE_HEADER_BYTES + ciphertext.length);
  envelope.set(MAGIC, 0);
  envelope[MAGIC.length] = ENVELOPE_VERSION;
  envelope.set(nonce, NONCE_OFFSET);
  envelope.set(ciphertext, ENVELOPE_HEADER_BYTES);
  return envelope;
}

/**
 * Opens an envelope, verifying its authenticity.
 *
 * @param key - The AES-GCM key the envelope was sealed under.
 * @param envelope - The bytes to open.
 * @returns The recovered plaintext.
 * @throws {EnvelopeFormatError} When the buffer is not a well-formed envelope of
 *   a known version.
 * @throws {EnvelopeIntegrityError} When authenticated decryption fails.
 */
export async function open(
  key: CryptoKey,
  envelope: Uint8Array,
): Promise<Uint8Array> {
  if (!isEnvelope(envelope)) {
    throw new EnvelopeFormatError(describeMalformed(envelope));
  }

  const nonce = envelope.subarray(NONCE_OFFSET, ENVELOPE_HEADER_BYTES);
  const ciphertext = envelope.subarray(ENVELOPE_HEADER_BYTES);
  try {
    return await decrypt(key, nonce, ciphertext);
  } catch (error) {
    // Deliberately opaque: which of "wrong key" or "tampered bytes" applies is
    // not knowable from AES-GCM, and guessing would mislead the caller.
    throw new EnvelopeIntegrityError(
      "Envelope failed authentication: wrong key or corrupted data.",
      { cause: error },
    );
  }
}

/**
 * Explains why a buffer is not a usable envelope.
 *
 * @param data - The rejected buffer.
 * @returns A message naming the specific defect.
 */
function describeMalformed(data: Uint8Array): string {
  if (data.length < ENVELOPE_OVERHEAD_BYTES) {
    return `Not an envelope: expected at least ${ENVELOPE_OVERHEAD_BYTES} bytes, got ${data.length}.`;
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (data[i] !== MAGIC[i]) {
      return "Not an envelope: missing magic bytes (the data is not encrypted).";
    }
  }
  return `Unsupported envelope version ${data[MAGIC.length]}; this build supports version ${ENVELOPE_VERSION}.`;
}
