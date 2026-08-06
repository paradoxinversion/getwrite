// Last Updated: 2026-08-03

import { describe, it, expect } from "vitest";
import {
  DEFAULT_ARGON2_PARAMS,
  KEY_BYTES,
  NONCE_BYTES,
  SALT_BYTES,
  decrypt,
  deriveKeyMaterial,
  deriveWorkspaceKey,
  encrypt,
  generateDataKeyBytes,
  generateNonce,
  generateSalt,
  importAesKey,
  randomBytes,
} from "../../src/lib/models/crypto/primitives";

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");

// `Uint8Array.from` re-wraps in this realm's constructor: under jsdom,
// TextEncoder returns a typed array from a different realm, which `toEqual`
// treats as unequal even when every byte matches.
const bytes = (s: string): Uint8Array =>
  Uint8Array.from(new TextEncoder().encode(s));

describe("crypto primitives — Argon2id key derivation", () => {
  it("matches a pinned test vector for the default parameters", () => {
    // Guards against silent parameter drift or a library change altering
    // derived keys — which would make every existing project unopenable.
    const salt = new Uint8Array(SALT_BYTES).fill(7);
    const derived = deriveKeyMaterial(
      "correct horse battery staple",
      salt,
      DEFAULT_ARGON2_PARAMS,
    );
    expect(hex(derived)).toBe(
      "799f12b9e17710824482d829835acb69f5a9355bf774c4f07342823b11b90928",
    );
  });

  it("uses OWASP-minimum parameters by default", () => {
    expect(DEFAULT_ARGON2_PARAMS).toEqual({
      memoryKiB: 19456,
      iterations: 2,
      parallelism: 1,
    });
  });

  it("derives a key of exactly KEY_BYTES length", () => {
    const derived = deriveKeyMaterial(
      "pw",
      generateSalt(),
      DEFAULT_ARGON2_PARAMS,
    );
    expect(derived).toHaveLength(KEY_BYTES);
  });

  it("is deterministic for identical inputs", () => {
    const salt = generateSalt();
    const a = deriveKeyMaterial("same passphrase", salt, DEFAULT_ARGON2_PARAMS);
    const b = deriveKeyMaterial("same passphrase", salt, DEFAULT_ARGON2_PARAMS);
    expect(hex(a)).toBe(hex(b));
  });

  it("derives different keys for different salts", () => {
    const a = deriveKeyMaterial("pw", generateSalt(), DEFAULT_ARGON2_PARAMS);
    const b = deriveKeyMaterial("pw", generateSalt(), DEFAULT_ARGON2_PARAMS);
    expect(hex(a)).not.toBe(hex(b));
  });

  it("derives different keys for different passphrases", () => {
    const salt = generateSalt();
    const a = deriveKeyMaterial("passphrase one", salt, DEFAULT_ARGON2_PARAMS);
    const b = deriveKeyMaterial("passphrase two", salt, DEFAULT_ARGON2_PARAMS);
    expect(hex(a)).not.toBe(hex(b));
  });

  it("derives different keys when parameters differ", () => {
    const salt = generateSalt();
    const a = deriveKeyMaterial("pw", salt, DEFAULT_ARGON2_PARAMS);
    const b = deriveKeyMaterial("pw", salt, {
      ...DEFAULT_ARGON2_PARAMS,
      iterations: 3,
    });
    expect(hex(a)).not.toBe(hex(b));
  });

  it("rejects a salt of the wrong length", () => {
    expect(() =>
      deriveKeyMaterial("pw", new Uint8Array(4), DEFAULT_ARGON2_PARAMS),
    ).toThrow(/salt/i);
  });

  it("rejects an empty passphrase", () => {
    expect(() =>
      deriveKeyMaterial("", generateSalt(), DEFAULT_ARGON2_PARAMS),
    ).toThrow(/passphrase/i);
  });

  it("produces a workspace key usable for AES-GCM", async () => {
    const key = await deriveWorkspaceKey(
      "pw",
      generateSalt(),
      DEFAULT_ARGON2_PARAMS,
    );
    const nonce = generateNonce();
    const sealed = await encrypt(key, nonce, bytes("hello"));
    expect(new TextDecoder().decode(await decrypt(key, nonce, sealed))).toBe(
      "hello",
    );
  });
});

describe("crypto primitives — random generation", () => {
  it("generates salts, nonces and data keys of the documented lengths", () => {
    expect(generateSalt()).toHaveLength(SALT_BYTES);
    expect(generateNonce()).toHaveLength(NONCE_BYTES);
    expect(generateDataKeyBytes()).toHaveLength(KEY_BYTES);
  });

  it("generates the requested number of bytes", () => {
    expect(randomBytes(1)).toHaveLength(1);
    expect(randomBytes(64)).toHaveLength(64);
  });

  it("does not repeat values across calls", () => {
    const seen = new Set(
      Array.from({ length: 50 }, () => hex(generateDataKeyBytes())),
    );
    expect(seen.size).toBe(50);
  });

  it("rejects a non-positive length", () => {
    expect(() => randomBytes(0)).toThrow(/length/i);
    expect(() => randomBytes(-1)).toThrow(/length/i);
  });
});

describe("crypto primitives — AES-256-GCM", () => {
  const freshKey = async (): Promise<CryptoKey> =>
    importAesKey(generateDataKeyBytes());

  it("round-trips a payload", async () => {
    const key = await freshKey();
    const nonce = generateNonce();
    const plaintext = bytes("chapter one");
    const sealed = await encrypt(key, nonce, plaintext);
    expect(await decrypt(key, nonce, sealed)).toEqual(plaintext);
  });

  it("round-trips a zero-length payload", async () => {
    const key = await freshKey();
    const nonce = generateNonce();
    const sealed = await encrypt(key, nonce, new Uint8Array(0));
    expect(await decrypt(key, nonce, sealed)).toHaveLength(0);
  });

  it("round-trips a multi-megabyte payload", async () => {
    const key = await freshKey();
    const nonce = generateNonce();
    const plaintext = randomBytes(2 * 1024 * 1024);
    const sealed = await encrypt(key, nonce, plaintext);
    // `toEqual` walks two million elements one at a time and can exceed the
    // 5s timeout on a loaded machine; a native byte compare is O(n) in C.
    expect(
      Buffer.from(await decrypt(key, nonce, sealed)).equals(
        Buffer.from(plaintext),
      ),
    ).toBe(true);
  });

  it("appends a 16-byte authentication tag", async () => {
    const key = await freshKey();
    const sealed = await encrypt(key, generateNonce(), bytes("abc"));
    expect(sealed).toHaveLength(3 + 16);
  });

  it("produces ciphertext that does not contain the plaintext", async () => {
    const key = await freshKey();
    const sealed = await encrypt(
      key,
      generateNonce(),
      bytes("secret manuscript"),
    );
    expect(Buffer.from(sealed).includes(Buffer.from("secret manuscript"))).toBe(
      false,
    );
  });

  it("fails to decrypt with the wrong key", async () => {
    const nonce = generateNonce();
    const sealed = await encrypt(await freshKey(), nonce, bytes("secret"));
    await expect(decrypt(await freshKey(), nonce, sealed)).rejects.toThrow();
  });

  it("fails to decrypt with the wrong nonce", async () => {
    const key = await freshKey();
    const sealed = await encrypt(key, generateNonce(), bytes("secret"));
    await expect(decrypt(key, generateNonce(), sealed)).rejects.toThrow();
  });

  it("fails to decrypt when any ciphertext byte is altered", async () => {
    const key = await freshKey();
    const nonce = generateNonce();
    const sealed = await encrypt(key, nonce, bytes("secret manuscript"));
    for (let i = 0; i < sealed.length; i++) {
      const tampered = Uint8Array.from(sealed);
      tampered[i] ^= 0xff;
      await expect(decrypt(key, nonce, tampered)).rejects.toThrow();
    }
  });

  it("rejects a nonce of the wrong length", async () => {
    const key = await freshKey();
    await expect(encrypt(key, new Uint8Array(8), bytes("x"))).rejects.toThrow(
      /nonce/i,
    );
  });

  it("rejects key material of the wrong length", async () => {
    await expect(importAesKey(new Uint8Array(16))).rejects.toThrow(/key/i);
  });
});
