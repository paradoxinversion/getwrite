// Last Updated: 2026-08-03

import { describe, it, expect } from "vitest";
import {
  ENVELOPE_HEADER_BYTES,
  ENVELOPE_OVERHEAD_BYTES,
  ENVELOPE_VERSION,
  EnvelopeFormatError,
  EnvelopeIntegrityError,
  isEnvelope,
  open,
  seal,
} from "../../src/lib/models/crypto/envelope";
import {
  generateDataKeyBytes,
  importAesKey,
  randomBytes,
} from "../../src/lib/models/crypto/primitives";

// `Uint8Array.from` re-wraps in this realm's constructor: under jsdom,
// TextEncoder returns a typed array from a different realm, which `toEqual`
// treats as unequal even when every byte matches.
const bytes = (s: string): Uint8Array =>
  Uint8Array.from(new TextEncoder().encode(s));
const text = (b: Uint8Array): string => new TextDecoder().decode(b);
const freshKey = (): Promise<CryptoKey> => importAesKey(generateDataKeyBytes());

describe("envelope — round trip", () => {
  it("round-trips a text payload", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("chapter one"));
    expect(text(await open(key, sealed))).toBe("chapter one");
  });

  it("round-trips a zero-length payload", async () => {
    const key = await freshKey();
    const sealed = await seal(key, new Uint8Array(0));
    expect(await open(key, sealed)).toHaveLength(0);
  });

  it("round-trips a multi-megabyte payload", async () => {
    const key = await freshKey();
    const payload = randomBytes(2 * 1024 * 1024);
    expect(await open(key, await seal(key, payload))).toEqual(payload);
  });

  it("round-trips arbitrary binary payloads", async () => {
    const key = await freshKey();
    const payload = new Uint8Array([0, 255, 127, 128, 0, 0, 13, 10]);
    expect(await open(key, await seal(key, payload))).toEqual(payload);
  });

  it("adds a constant, documented overhead", async () => {
    const key = await freshKey();
    for (const size of [0, 1, 1024, 65536]) {
      const sealed = await seal(
        key,
        randomBytes(Math.max(size, 1)).subarray(0, size),
      );
      expect(sealed.length - size).toBe(ENVELOPE_OVERHEAD_BYTES);
    }
  });

  it("produces a different envelope each time for identical input", async () => {
    const key = await freshKey();
    const payload = bytes("same text");
    const a = await seal(key, payload);
    const b = await seal(key, payload);
    // Distinct nonces are what make this safe; identical output would mean
    // a reused nonce, which is catastrophic for AES-GCM.
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(text(await open(key, a))).toBe(text(await open(key, b)));
  });

  it("stamps the current version byte", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("x"));
    expect(sealed[4]).toBe(ENVELOPE_VERSION);
  });
});

describe("envelope — self-identification", () => {
  it("recognises its own output", async () => {
    const key = await freshKey();
    expect(isEnvelope(await seal(key, bytes("x")))).toBe(true);
    expect(isEnvelope(await seal(key, new Uint8Array(0)))).toBe(true);
  });

  it("rejects plaintext that GetWrite actually stores", () => {
    // The conversion sweep (Task 14) relies on this to know what is already
    // done, so these are the real file shapes it will encounter.
    const plaintexts = [
      "",
      "chapter one",
      '{"id":"abc","name":"The Whistleblower"}',
      '{"type":"doc","content":[]}',
      "# Heading\n\nbody text\n",
      '{"tags":["draft"]}\n{"tags":["final"]}\n',
    ];
    for (const p of plaintexts) expect(isEnvelope(bytes(p))).toBe(false);
  });

  it("rejects short buffers without throwing", () => {
    for (let n = 0; n < ENVELOPE_HEADER_BYTES; n++) {
      expect(isEnvelope(randomBytes(Math.max(n, 1)).subarray(0, n))).toBe(
        false,
      );
    }
  });

  it("rejects a buffer whose magic differs in any byte", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("x"));
    for (let i = 0; i < 4; i++) {
      const altered = Uint8Array.from(sealed);
      altered[i] ^= 0xff;
      expect(isEnvelope(altered)).toBe(false);
    }
  });

  it("rejects an unknown version byte", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("x"));
    sealed[4] = 0xfe;
    expect(isEnvelope(sealed)).toBe(false);
  });
});

describe("envelope — failure modes are distinguishable", () => {
  it("raises a format error when handed plaintext", async () => {
    const key = await freshKey();
    // Distinct from an integrity error: this is "not encrypted", not
    // "encrypted and corrupt". Task 15's tolerant reads depend on the
    // difference.
    await expect(open(key, bytes("plain text"))).rejects.toBeInstanceOf(
      EnvelopeFormatError,
    );
  });

  it("raises a format error for an unknown version", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("x"));
    sealed[4] = 0xfe;
    await expect(open(key, sealed)).rejects.toBeInstanceOf(EnvelopeFormatError);
  });

  it("raises a format error for a truncated envelope", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("chapter one"));
    await expect(
      open(key, sealed.subarray(0, ENVELOPE_HEADER_BYTES - 1)),
    ).rejects.toBeInstanceOf(EnvelopeFormatError);
  });

  it("raises an integrity error when any byte after the header is altered", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("secret manuscript"));
    for (let i = ENVELOPE_HEADER_BYTES; i < sealed.length; i++) {
      const tampered = Uint8Array.from(sealed);
      tampered[i] ^= 0xff;
      await expect(open(key, tampered)).rejects.toBeInstanceOf(
        EnvelopeIntegrityError,
      );
    }
  });

  it("raises an integrity error when the nonce is altered", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("secret manuscript"));
    // Nonce sits inside the header but is not authenticated by shape, so a
    // flipped nonce byte must surface as integrity failure, not format.
    for (let i = 5; i < ENVELOPE_HEADER_BYTES; i++) {
      const tampered = Uint8Array.from(sealed);
      tampered[i] ^= 0xff;
      await expect(open(key, tampered)).rejects.toBeInstanceOf(
        EnvelopeIntegrityError,
      );
    }
  });

  it("raises an integrity error for the wrong key", async () => {
    const sealed = await seal(await freshKey(), bytes("secret"));
    await expect(open(await freshKey(), sealed)).rejects.toBeInstanceOf(
      EnvelopeIntegrityError,
    );
  });

  it("never surfaces a failure as empty content", async () => {
    const key = await freshKey();
    const sealed = await seal(key, bytes("secret manuscript"));
    sealed[sealed.length - 1] ^= 0xff;
    await expect(open(key, sealed)).rejects.toThrow();
  });
});
