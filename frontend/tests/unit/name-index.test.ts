// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach } from "vitest";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import {
  createKeyring,
  type Keyring,
} from "../../src/lib/models/crypto/keyring";
import { isEnvelope } from "../../src/lib/models/crypto/envelope";
import {
  NAME_INDEX_FILENAME,
  NameIndexFormatError,
  readNameIndex,
  removeProjectName,
  setProjectName,
} from "../../src/lib/models/crypto/name-index";

const WORKSPACE = "/ws";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const INDEX_PATH = `${WORKSPACE}/${NAME_INDEX_FILENAME}`;

let adapter: StorageAdapter;
let keyring: Keyring;
let key: CryptoKey;

beforeEach(async () => {
  adapter = createMemoryAdapter();
  await adapter.mkdir(WORKSPACE, { recursive: true });
  keyring = await createKeyring("correct horse battery staple");
  key = keyring.workspaceKey();
});

describe("name index — round trips", () => {
  it("reads as empty when absent", async () => {
    expect(await readNameIndex(key, WORKSPACE, adapter)).toEqual({});
  });

  it("stores and returns a name", async () => {
    await setProjectName(
      PROJECT_A,
      "The Whistleblower",
      key,
      WORKSPACE,
      adapter,
    );
    expect(await readNameIndex(key, WORKSPACE, adapter)).toEqual({
      [PROJECT_A]: "The Whistleblower",
    });
  });

  it("yields every name from a single read", async () => {
    await setProjectName(
      PROJECT_A,
      "The Whistleblower",
      key,
      WORKSPACE,
      adapter,
    );
    await setProjectName(PROJECT_B, "Poetry 2026", key, WORKSPACE, adapter);

    // FR21's point: one decryption renders the whole list, rather than one
    // unwrap plus one manifest decrypt per project.
    expect(await readNameIndex(key, WORKSPACE, adapter)).toEqual({
      [PROJECT_A]: "The Whistleblower",
      [PROJECT_B]: "Poetry 2026",
    });
  });

  it("overwrites a name on rename", async () => {
    await setProjectName(PROJECT_A, "Working Title", key, WORKSPACE, adapter);
    await setProjectName(
      PROJECT_A,
      "The Whistleblower",
      key,
      WORKSPACE,
      adapter,
    );

    expect(await readNameIndex(key, WORKSPACE, adapter)).toEqual({
      [PROJECT_A]: "The Whistleblower",
    });
  });

  it("drops a name on delete, leaving the others", async () => {
    await setProjectName(
      PROJECT_A,
      "The Whistleblower",
      key,
      WORKSPACE,
      adapter,
    );
    await setProjectName(PROJECT_B, "Poetry 2026", key, WORKSPACE, adapter);

    await removeProjectName(PROJECT_A, key, WORKSPACE, adapter);

    expect(await readNameIndex(key, WORKSPACE, adapter)).toEqual({
      [PROJECT_B]: "Poetry 2026",
    });
  });

  it("treats removing an unknown project as a no-op", async () => {
    await setProjectName(
      PROJECT_A,
      "The Whistleblower",
      key,
      WORKSPACE,
      adapter,
    );
    await removeProjectName(PROJECT_B, key, WORKSPACE, adapter);
    expect(await readNameIndex(key, WORKSPACE, adapter)).toEqual({
      [PROJECT_A]: "The Whistleblower",
    });
  });

  it("round-trips names with non-ASCII characters", async () => {
    const name = "Café — 文字 🔐";
    await setProjectName(PROJECT_A, name, key, WORKSPACE, adapter);
    expect((await readNameIndex(key, WORKSPACE, adapter))[PROJECT_A]).toBe(
      name,
    );
  });
});

describe("name index — names never touch the disk in the clear", () => {
  it("writes a sealed envelope", async () => {
    await setProjectName(
      PROJECT_A,
      "The Whistleblower",
      key,
      WORKSPACE,
      adapter,
    );
    const raw = await adapter.readFileBuffer(INDEX_PATH);
    expect(isEnvelope(raw)).toBe(true);
  });

  it("leaks neither names nor project ids", async () => {
    await setProjectName(
      PROJECT_A,
      "The Whistleblower",
      key,
      WORKSPACE,
      adapter,
    );
    const raw = Buffer.from(await adapter.readFileBuffer(INDEX_PATH));

    for (const fragment of ["The Whistleblower", PROJECT_A]) {
      expect(raw.includes(Buffer.from(fragment))).toBe(false);
    }
  });

  it("is unreadable with the wrong key", async () => {
    await setProjectName(
      PROJECT_A,
      "The Whistleblower",
      key,
      WORKSPACE,
      adapter,
    );
    const otherKey = (
      await createKeyring("a different passphrase")
    ).workspaceKey();

    await expect(readNameIndex(otherKey, WORKSPACE, adapter)).rejects.toThrow();
  });
});

describe("name index — rejects what it cannot trust", () => {
  it("raises on a corrupt index rather than reporting it empty", async () => {
    await adapter.writeFile(INDEX_PATH, "not an envelope");
    // Reporting empty would silently blank every project's name on the Start
    // screen, which reads as data loss.
    await expect(readNameIndex(key, WORKSPACE, adapter)).rejects.toBeInstanceOf(
      NameIndexFormatError,
    );
  });

  it("raises on a sealed payload that is not a name map", async () => {
    const { seal } = await import("../../src/lib/models/crypto/envelope");
    await adapter.writeFile(
      INDEX_PATH,
      Buffer.from(
        await seal(key, new TextEncoder().encode('["not","a","map"]')),
      ),
    );
    await expect(readNameIndex(key, WORKSPACE, adapter)).rejects.toBeInstanceOf(
      NameIndexFormatError,
    );
  });
});

describe("name index — concurrent updates do not lose writes", () => {
  it("serialises interleaved updates to different projects", async () => {
    // Read-modify-write on a shared file: without serialisation the later
    // write would clobber the earlier one.
    await Promise.all([
      setProjectName(PROJECT_A, "The Whistleblower", key, WORKSPACE, adapter),
      setProjectName(PROJECT_B, "Poetry 2026", key, WORKSPACE, adapter),
    ]);

    expect(await readNameIndex(key, WORKSPACE, adapter)).toEqual({
      [PROJECT_A]: "The Whistleblower",
      [PROJECT_B]: "Poetry 2026",
    });
  });
});
