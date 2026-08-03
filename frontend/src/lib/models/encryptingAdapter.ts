// Last Updated: 2026-08-03

/**
 * @module encryptingAdapter
 *
 * A {@link StorageAdapter} decorator that seals file *bodies* on the way out and
 * opens them on the way in, leaving every path and directory semantic to the
 * adapter it wraps.
 *
 * ```
 *   model layer ──▶ encryptingAdapter(inner, key) ──▶ fs | objectStore | capacitorFs
 * ```
 *
 * Because it decorates the same interface it consumes, it composes with every
 * backend GetWrite has — the filesystem adapter, the object store (ADR-019), and
 * the Capacitor bridge (ADR-021) — without any of them knowing it exists. The
 * shared `StorageAdapter` conformance suite is run against it (Task 6) to prove
 * that transparency rather than assert it.
 *
 * **Scope: one key, one project.** The decorator holds a single data key and
 * knows nothing about which project a path belongs to. Selecting the right
 * adapter for a given project — and leaving it out entirely for projects that
 * never opted in (FR3, FR12) — belongs to the storage-context wiring in Task 8.
 * Keeping the mapping out of here is what lets an unencrypted project run
 * through an adapter chain containing no crypto code at all.
 *
 * **Only bodies are protected.** File and directory *names* stay in the clear
 * (FR-non-goal: they are already opaque UUIDs), and `stat().size` reports the
 * sealed length. ADR-019's survey of the model layer established that it reads
 * only `isDirectory`/`isFile`/`name` and existence from `Stats`/`Dirent`, never
 * `size`, so the discrepancy is inert — a property Task 6's conformance run
 * keeps honest.
 *
 * **Reads are strict.** A file that is not a well-formed envelope is rejected,
 * never returned as-is: silently accepting plaintext where ciphertext is
 * expected would let an attacker with write access downgrade a file and have it
 * read back. The tolerant read mode a half-finished conversion needs is
 * deliberately *not* here — it arrives in Task 15, gated on an active conversion
 * marker.
 */
import type { Dirent, Stats } from "node:fs";
import type { ReaddirResult, StorageAdapter } from "./io";
import { open, seal } from "./crypto/envelope";

/** Encodings this decorator can honour when decoding a decrypted body. */
const SUPPORTED_ENCODINGS = new Set(["utf8", "utf-8"]);

/**
 * Wraps a storage adapter so every file body is encrypted at rest.
 *
 * @param inner - The adapter that performs the actual storage operations.
 * @param key - The project data key to seal and open bodies with.
 * @returns An adapter with identical semantics and encrypted contents.
 */
export function encryptingAdapter(
  inner: StorageAdapter,
  key: CryptoKey,
): StorageAdapter {
  /**
   * Reads and opens a file's sealed body.
   *
   * @param path - File to read.
   * @returns The recovered plaintext bytes.
   */
  async function readOpened(path: string): Promise<Uint8Array> {
    return open(key, await inner.readFileBuffer(path));
  }

  /**
   * Seals a payload and writes it.
   *
   * @param path - Destination path.
   * @param data - Text or binary payload.
   * @param opts - Underlying write options, forwarded unchanged.
   */
  async function writeSealed(
    path: string,
    data: string | Buffer,
    opts?: string | object,
  ): Promise<void> {
    await inner.writeFile(
      path,
      Buffer.from(await seal(key, toBytes(data))),
      opts,
    );
  }

  return {
    // ─── Transformed: file bodies ──────────────────────────────────────────
    writeFile: writeSealed,

    readFile: async (path, encoding) => {
      assertSupportedEncoding(encoding);
      return new TextDecoder("utf-8").decode(await readOpened(path));
    },

    readFileBuffer: async (path) => Buffer.from(await readOpened(path)),

    /**
     * Appends by rewriting: an AEAD envelope is a single sealed unit, so there
     * is no way to extend one in place. Read-modify-write is the only correct
     * option, and is why callers should keep appended logs small.
     */
    appendFile: async (path, data) => {
      const existing = (await inner
        .stat(path)
        .then(() => true)
        .catch(() => false))
        ? await readOpened(path)
        : new Uint8Array(0);

      const addition = toBytes(data);
      const combined = new Uint8Array(existing.length + addition.length);
      combined.set(existing, 0);
      combined.set(addition, existing.length);
      await writeSealed(path, Buffer.from(combined));
    },

    // ─── Pass-through: paths, directories, and whole-file moves ────────────
    // Ciphertext is moved verbatim. Both endpoints belong to the same project
    // and therefore the same key, so re-sealing would be pure cost — and it
    // keeps `atomicWriteFile`'s write-tmp-then-rename flow intact.
    mkdir: (path, opts) => inner.mkdir(path, opts),
    readdir: (path, opts): Promise<ReaddirResult> =>
      inner.readdir(path, opts) as Promise<Dirent[] | string[]>,
    stat: (path): Promise<Stats> => inner.stat(path),
    rm: (path, opts) => inner.rm(path, opts),
    rename: (from, to) => inner.rename(from, to),
    copyFile: (from, to) => inner.copyFile(from, to),
    cp: (from, to, opts) => inner.cp(from, to, opts),
    fsyncFile: inner.fsyncFile ? (path) => inner.fsyncFile!(path) : undefined,
  };
}

/**
 * Normalises a write payload to bytes.
 *
 * @param data - Text or binary payload.
 * @returns UTF-8 bytes for text, or the buffer's own bytes.
 */
function toBytes(data: string | Buffer): Uint8Array {
  return typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
}

/**
 * Rejects encodings this decorator cannot honour.
 *
 * The inner adapter's own text decoding is unusable here — it would decode
 * *ciphertext* — so decoding happens after opening, and only for encodings
 * `TextDecoder` and the native build both support. Failing loudly beats
 * returning silently mangled text.
 *
 * @param encoding - Requested encoding, if any.
 * @throws {Error} When the encoding is not supported.
 */
function assertSupportedEncoding(encoding?: string): void {
  if (encoding !== undefined && !SUPPORTED_ENCODINGS.has(encoding)) {
    throw new Error(
      `encryptingAdapter: unsupported read encoding "${encoding}"; ` +
        `only ${[...SUPPORTED_ENCODINGS].join(", ")} can be decoded from an encrypted file.`,
    );
  }
}
