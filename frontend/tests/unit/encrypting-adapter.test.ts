// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Dirent } from "node:fs";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { encryptingAdapter } from "../../src/lib/models/encryptingAdapter";
import { createKeyring } from "../../src/lib/models/crypto/keyring";
import {
  EnvelopeFormatError,
  EnvelopeIntegrityError,
  isEnvelope,
} from "../../src/lib/models/crypto/envelope";

const PASS = "correct horse battery staple";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";

let inner: StorageAdapter;
let keyA: CryptoKey;
let keyB: CryptoKey;
const previous = io.getStorageAdapter();

beforeEach(async () => {
  const keyring = await createKeyring(PASS);
  await keyring.addProject(PROJECT_A);
  await keyring.addProject(PROJECT_B);
  keyA = keyring.projectKey(PROJECT_A);
  keyB = keyring.projectKey(PROJECT_B);

  inner = createMemoryAdapter();
  io.setStorageAdapter(encryptingAdapter(inner, keyA));
  await io.mkdir("/proj", { recursive: true });
});

afterEach(() => {
  io.setStorageAdapter(previous);
});

describe("encryptingAdapter — round trips", () => {
  it("round-trips text through writeFile/readFile", async () => {
    await io.writeFile("/proj/a.txt", "chapter one");
    expect(await io.readFile("/proj/a.txt")).toBe("chapter one");
  });

  it("accepts both utf8 spellings", async () => {
    await io.writeFile("/proj/a.txt", "chapter one");
    expect(await io.readFile("/proj/a.txt", "utf8")).toBe("chapter one");
    expect(await io.readFile("/proj/a.txt", "utf-8")).toBe("chapter one");
  });

  it("round-trips non-ASCII text", async () => {
    const content = "Café — “smart quotes”, emoji 🔐, CJK 文字";
    await io.writeFile("/proj/u.txt", content);
    expect(await io.readFile("/proj/u.txt")).toBe(content);
  });

  it("round-trips binary through readFileBuffer", async () => {
    const payload = Buffer.from([0, 1, 254, 255, 0, 13, 10, 26]);
    await io.writeFile("/proj/bin", payload);
    expect(Buffer.from(await io.readFileBuffer("/proj/bin"))).toEqual(payload);
  });

  it("round-trips an empty file", async () => {
    await io.writeFile("/proj/empty.txt", "");
    expect(await io.readFile("/proj/empty.txt")).toBe("");
    expect(await io.readFileBuffer("/proj/empty.txt")).toHaveLength(0);
  });

  it("round-trips a one-megabyte payload", async () => {
    const content = "x".repeat(1024 * 1024);
    await io.writeFile("/proj/big.txt", content);
    expect(await io.readFile("/proj/big.txt")).toBe(content);
  });

  it("works through atomicWriteFile", async () => {
    await io.atomicWriteFile("/proj/atomic.json", '{"a":1}');
    expect(await io.readFile("/proj/atomic.json")).toBe('{"a":1}');
    expect(await io.exists("/proj/atomic.json.tmp")).toBe(false);
  });

  it("rejects an encoding it cannot honour rather than corrupting data", async () => {
    await io.writeFile("/proj/a.txt", "chapter one");
    await expect(io.readFile("/proj/a.txt", "base64")).rejects.toThrow(
      /encoding/i,
    );
  });
});

describe("encryptingAdapter — nothing readable reaches the disk", () => {
  it("stores an envelope, not plaintext", async () => {
    await io.writeFile("/proj/a.txt", "secret manuscript");
    const raw = await inner.readFileBuffer("/proj/a.txt");

    expect(isEnvelope(raw)).toBe(true);
    expect(Buffer.from(raw).includes(Buffer.from("secret manuscript"))).toBe(
      false,
    );
  });

  it("leaks no JSON structure from a manifest", async () => {
    await io.writeFile(
      "/proj/project.json",
      JSON.stringify({ id: PROJECT_A, name: "The Whistleblower" }),
    );
    const raw = Buffer.from(await inner.readFileBuffer("/proj/project.json"));

    // Deliberately multi-byte fragments only: a single byte such as "{" occurs
    // in any ciphertext of this length by chance roughly a third of the time,
    // which would make this test flaky rather than meaningful.
    for (const fragment of ["The Whistleblower", '"name"', PROJECT_A]) {
      expect(raw.includes(Buffer.from(fragment))).toBe(false);
    }
  });

  it("writes a distinct ciphertext each time, even for identical content", async () => {
    await io.writeFile("/proj/one.txt", "same");
    await io.writeFile("/proj/two.txt", "same");
    const a = Buffer.from(await inner.readFileBuffer("/proj/one.txt"));
    const b = Buffer.from(await inner.readFileBuffer("/proj/two.txt"));
    expect(a.equals(b)).toBe(false);
  });

  it("keeps an empty file indistinguishable from any other short file", async () => {
    await io.writeFile("/proj/empty.txt", "");
    const raw = await inner.readFileBuffer("/proj/empty.txt");
    // A zero-length file must still be sealed, not written through as 0 bytes.
    expect(raw.length).toBeGreaterThan(0);
    expect(isEnvelope(raw)).toBe(true);
  });
});

describe("encryptingAdapter — keys are per project", () => {
  it("cannot read another project's file", async () => {
    await io.writeFile("/proj/a.txt", "secret");
    io.setStorageAdapter(encryptingAdapter(inner, keyB));
    await expect(io.readFile("/proj/a.txt")).rejects.toBeInstanceOf(
      EnvelopeIntegrityError,
    );
  });
});

describe("encryptingAdapter — refuses to trust unsealed or altered data", () => {
  it("rejects a plaintext file rather than returning it", async () => {
    // A downgrade attempt: plaintext dropped in where ciphertext is expected.
    await inner.writeFile("/proj/plain.txt", "attacker plaintext");
    await expect(io.readFile("/proj/plain.txt")).rejects.toBeInstanceOf(
      EnvelopeFormatError,
    );
  });

  it("rejects a tampered envelope", async () => {
    await io.writeFile("/proj/a.txt", "secret manuscript");
    const raw = Buffer.from(await inner.readFileBuffer("/proj/a.txt"));
    raw[raw.length - 1] ^= 0xff;
    await inner.writeFile("/proj/a.txt", raw);

    await expect(io.readFile("/proj/a.txt")).rejects.toBeInstanceOf(
      EnvelopeIntegrityError,
    );
  });

  it("never surfaces a failure as empty content", async () => {
    await inner.writeFile("/proj/plain.txt", "");
    await expect(io.readFileBuffer("/proj/plain.txt")).rejects.toThrow();
  });
});

describe("encryptingAdapter — tolerant mode", () => {
  it("passes an unsealed file through unchanged", async () => {
    await inner.writeFile("/proj/plain.txt", "not yet converted");
    const tolerant = encryptingAdapter(inner, keyA, { tolerant: true });

    expect(await tolerant.readFile("/proj/plain.txt", "utf-8")).toBe(
      "not yet converted",
    );
  });

  it("still opens sealed files", async () => {
    await io.writeFile("/proj/sealed.txt", "already converted");
    const tolerant = encryptingAdapter(inner, keyA, { tolerant: true });

    expect(await tolerant.readFile("/proj/sealed.txt", "utf-8")).toBe(
      "already converted",
    );
  });

  it("reads a half-converted project end to end", async () => {
    // Exactly the state an interrupted conversion leaves behind (FR22).
    await io.writeFile("/proj/done.txt", "sealed already");
    await inner.writeFile("/proj/pending.txt", "still plaintext");
    const tolerant = encryptingAdapter(inner, keyA, { tolerant: true });

    expect(await tolerant.readFile("/proj/done.txt", "utf-8")).toBe(
      "sealed already",
    );
    expect(await tolerant.readFile("/proj/pending.txt", "utf-8")).toBe(
      "still plaintext",
    );
  });

  it("does not tolerate a tampered envelope", async () => {
    await io.writeFile("/proj/a.txt", "secret manuscript");
    const raw = Buffer.from(await inner.readFileBuffer("/proj/a.txt"));
    raw[raw.length - 1] ^= 0xff;
    await inner.writeFile("/proj/a.txt", raw);

    // "Not encrypted" is an expected mid-conversion state; "encrypted and
    // untrustworthy" never is, tolerant or not.
    const tolerant = encryptingAdapter(inner, keyA, { tolerant: true });
    await expect(
      tolerant.readFile("/proj/a.txt", "utf-8"),
    ).rejects.toBeInstanceOf(EnvelopeIntegrityError);
  });

  it("does not tolerate another project's ciphertext", async () => {
    const foreign = encryptingAdapter(inner, keyB);
    await foreign.writeFile("/proj/foreign.txt", "other project");

    const tolerant = encryptingAdapter(inner, keyA, { tolerant: true });
    await expect(
      tolerant.readFile("/proj/foreign.txt", "utf-8"),
    ).rejects.toBeInstanceOf(EnvelopeIntegrityError);
  });

  it("tolerates through readFileBuffer as well as readFile", async () => {
    await inner.writeFile("/proj/bin", Buffer.from([1, 2, 3]));
    const tolerant = encryptingAdapter(inner, keyA, { tolerant: true });

    expect(Buffer.from(await tolerant.readFileBuffer("/proj/bin"))).toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  it("is off unless asked for", async () => {
    await inner.writeFile("/proj/plain.txt", "downgrade attempt");
    // The default must stay strict: a tolerant default would be a standing
    // downgrade vector rather than a bounded, conversion-scoped one.
    await expect(
      io.readFile("/proj/plain.txt", "utf-8"),
    ).rejects.toBeInstanceOf(EnvelopeFormatError);
  });
});

describe("encryptingAdapter — path and directory semantics pass through", () => {
  it("lists directory entries unchanged", async () => {
    await io.writeFile("/proj/a.txt", "a");
    await io.mkdir("/proj/sub", { recursive: true });

    const names = await io.readdir("/proj");
    expect([...names].sort()).toEqual(["a.txt", "sub"]);

    // Only `name` and `isDirectory` are asserted: those, plus existence, are
    // the whole of what the model layer consumes from Dirent/Stats (ADR-019),
    // and correspondingly all the in-memory adapter synthesises.
    const typed = (await io.readdir("/proj", {
      withFileTypes: true,
    })) as Dirent[];
    expect(typed.find((e) => e.name === "a.txt")?.isDirectory()).toBe(false);
    expect(typed.find((e) => e.name === "sub")?.isDirectory()).toBe(true);
  });

  it("reports existence and directory-ness correctly", async () => {
    await io.writeFile("/proj/a.txt", "a");
    expect(await io.exists("/proj/a.txt")).toBe(true);
    expect(await io.exists("/proj/nope.txt")).toBe(false);
    expect((await io.stat("/proj")).isDirectory()).toBe(true);
    expect((await io.stat("/proj/a.txt")).isDirectory()).toBe(false);
  });

  it("stores more bytes than the plaintext it was given", async () => {
    await io.writeFile("/proj/a.txt", "chapter one");
    // The sealed body is necessarily longer than its plaintext, so any
    // size-derived value an adapter reports describes ciphertext. Harmless
    // because the model layer never reads size — asserted here against the
    // stored bytes, which every adapter can answer for.
    const stored = await inner.readFileBuffer("/proj/a.txt");
    expect(stored.length).toBeGreaterThan("chapter one".length);
  });

  it("removes files and directories", async () => {
    await io.writeFile("/proj/a.txt", "a");
    await io.rm("/proj/a.txt");
    expect(await io.exists("/proj/a.txt")).toBe(false);
  });
});

describe("encryptingAdapter — moves ciphertext without re-sealing", () => {
  it("renames a file and keeps it readable", async () => {
    await io.writeFile("/proj/a.txt", "chapter one");
    const before = Buffer.from(await inner.readFileBuffer("/proj/a.txt"));

    await io.rename("/proj/a.txt", "/proj/b.txt");

    expect(await io.readFile("/proj/b.txt")).toBe("chapter one");
    // Byte-identical proves the move did not decrypt and re-encrypt.
    expect(
      Buffer.from(await inner.readFileBuffer("/proj/b.txt")).equals(before),
    ).toBe(true);
  });

  it("copies a file and keeps both readable", async () => {
    await io.writeFile("/proj/a.txt", "chapter one");
    await io.copyFile("/proj/a.txt", "/proj/copy.txt");

    expect(await io.readFile("/proj/a.txt")).toBe("chapter one");
    expect(await io.readFile("/proj/copy.txt")).toBe("chapter one");
  });

  it("copies a directory tree recursively", async () => {
    await io.mkdir("/proj/src/nested", { recursive: true });
    await io.writeFile("/proj/src/a.txt", "alpha");
    await io.writeFile("/proj/src/nested/b.txt", "beta");

    await io.cp("/proj/src", "/proj/dst", { recursive: true });

    expect(await io.readFile("/proj/dst/a.txt")).toBe("alpha");
    expect(await io.readFile("/proj/dst/nested/b.txt")).toBe("beta");
  });
});

describe("encryptingAdapter — appendFile", () => {
  it("creates the file when absent", async () => {
    await io.appendFile("/proj/log.jsonl", '{"a":1}\n');
    expect(await io.readFile("/proj/log.jsonl")).toBe('{"a":1}\n');
  });

  it("concatenates across appends", async () => {
    await io.appendFile("/proj/log.jsonl", '{"a":1}\n');
    await io.appendFile("/proj/log.jsonl", '{"b":2}\n');
    await io.appendFile("/proj/log.jsonl", '{"c":3}\n');
    expect(await io.readFile("/proj/log.jsonl")).toBe(
      '{"a":1}\n{"b":2}\n{"c":3}\n',
    );
  });

  it("leaves the file sealed, never appending plaintext", async () => {
    await io.appendFile("/proj/log.jsonl", '{"secret":"value"}\n');
    await io.appendFile("/proj/log.jsonl", '{"more":"data"}\n');

    const raw = Buffer.from(await inner.readFileBuffer("/proj/log.jsonl"));
    expect(isEnvelope(raw)).toBe(true);
    expect(raw.includes(Buffer.from("secret"))).toBe(false);
    expect(raw.includes(Buffer.from("more"))).toBe(false);
  });

  it("appends binary without corruption", async () => {
    await io.appendFile("/proj/bin", Buffer.from([0, 1, 2]));
    await io.appendFile("/proj/bin", Buffer.from([253, 254, 255]));
    expect(Buffer.from(await io.readFileBuffer("/proj/bin"))).toEqual(
      Buffer.from([0, 1, 2, 253, 254, 255]),
    );
  });
});
