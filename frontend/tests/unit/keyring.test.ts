// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import {
  KeyringFormatError,
  KeyringLockedError,
  UnknownProjectError,
  WrongPassphraseError,
  createKeyring,
  unlockKeyring,
  type WrappedKeyring,
} from "../../src/lib/models/crypto/keyring";
import {
  KEYRING_FILENAME,
  keyringExists,
  readWrappedKeyring,
  writeWrappedKeyring,
} from "../../src/lib/models/crypto/keyring-store";
import {
  ENVELOPE_OVERHEAD_BYTES,
  isEnvelope,
  open,
  seal,
} from "../../src/lib/models/crypto/envelope";
import { KEY_BYTES } from "../../src/lib/models/crypto/primitives";

const PASS = "correct horse battery staple";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";

const bytes = (s: string): Uint8Array =>
  Uint8Array.from(new TextEncoder().encode(s));
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

describe("keyring — creation", () => {
  it("produces a wrapped keyring with no projects", async () => {
    const keyring = await createKeyring(PASS);
    const snapshot = keyring.snapshot();

    expect(snapshot.version).toBe(1);
    expect(snapshot.kdf.algorithm).toBe("argon2id");
    expect(snapshot.projects).toEqual({});
    expect(keyring.isLocked()).toBe(false);
  });

  it("records the KDF parameters in plaintext so they can be raised later", async () => {
    const { kdf } = (await createKeyring(PASS)).snapshot();
    expect(kdf.memoryKiB).toBe(19456);
    expect(kdf.iterations).toBe(2);
    expect(kdf.parallelism).toBe(1);
    expect(typeof kdf.salt).toBe("string");
  });

  it("uses a fresh random salt per workspace", async () => {
    const a = (await createKeyring(PASS)).snapshot();
    const b = (await createKeyring(PASS)).snapshot();
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe("keyring — unlocking", () => {
  it("unlocks with the correct passphrase", async () => {
    const snapshot = (await createKeyring(PASS)).snapshot();
    const reopened = await unlockKeyring(snapshot, PASS);
    expect(reopened.isLocked()).toBe(false);
  });

  it("rejects a wrong passphrase", async () => {
    const snapshot = (await createKeyring(PASS)).snapshot();
    await expect(
      unlockKeyring(snapshot, "wrong passphrase"),
    ).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("rejects an empty passphrase", async () => {
    const snapshot = (await createKeyring(PASS)).snapshot();
    await expect(unlockKeyring(snapshot, "")).rejects.toThrow();
  });

  it("rejects a tampered verifier", async () => {
    const snapshot = (await createKeyring(PASS)).snapshot();
    const tampered: WrappedKeyring = {
      ...snapshot,
      verifier: snapshot.verifier.slice(0, -4) + "AAAA",
    };
    await expect(unlockKeyring(tampered, PASS)).rejects.toThrow();
  });

  it("rejects an unknown keyring version", async () => {
    const snapshot = (await createKeyring(PASS)).snapshot();
    await expect(
      unlockKeyring(
        { ...snapshot, version: 99 } as unknown as WrappedKeyring,
        PASS,
      ),
    ).rejects.toBeInstanceOf(KeyringFormatError);
  });

  it("rejects a structurally invalid keyring", async () => {
    await expect(
      unlockKeyring({ version: 1 } as unknown as WrappedKeyring, PASS),
    ).rejects.toBeInstanceOf(KeyringFormatError);
  });
});

describe("keyring — per-project data keys", () => {
  it("registers a project and returns an updated snapshot", async () => {
    const keyring = await createKeyring(PASS);
    const snapshot = await keyring.addProject(PROJECT_A);

    expect(keyring.hasProject(PROJECT_A)).toBe(true);
    expect(Object.keys(snapshot.projects)).toEqual([PROJECT_A]);
    expect(keyring.projectIds()).toEqual([PROJECT_A]);
  });

  it("returns a usable key for a registered project", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);

    const sealed = await seal(
      keyring.projectKey(PROJECT_A),
      bytes("chapter one"),
    );
    expect(text(await open(keyring.projectKey(PROJECT_A), sealed))).toBe(
      "chapter one",
    );
  });

  it("generates independent keys per project", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    const snapshot = await keyring.addProject(PROJECT_B);

    expect(snapshot.projects[PROJECT_A]).not.toBe(snapshot.projects[PROJECT_B]);

    // The decisive check: project B's key must not open project A's data.
    const sealedForA = await seal(
      keyring.projectKey(PROJECT_A),
      bytes("secret"),
    );
    await expect(
      open(keyring.projectKey(PROJECT_B), sealedForA),
    ).rejects.toThrow();
  });

  it("refuses to register the same project twice", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    await expect(keyring.addProject(PROJECT_A)).rejects.toThrow(/already/i);
  });

  it("raises a typed error for an unregistered project", async () => {
    const keyring = await createKeyring(PASS);
    expect(() => keyring.projectKey(PROJECT_A)).toThrow(UnknownProjectError);
  });

  it("exposes a workspace key distinct from any project key", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);

    // Used to seal workspace-scoped artefacts (the name index, FR21). It must
    // not be interchangeable with a project key.
    const sealed = await seal(keyring.workspaceKey(), bytes("workspace data"));
    expect(text(await open(keyring.workspaceKey(), sealed))).toBe(
      "workspace data",
    );
    await expect(open(keyring.projectKey(PROJECT_A), sealed)).rejects.toThrow();
  });

  it("denies the workspace key once locked", async () => {
    const keyring = await createKeyring(PASS);
    keyring.lock();
    expect(() => keyring.workspaceKey()).toThrow(KeyringLockedError);
  });

  it("forgets a project on removal", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    const snapshot = keyring.removeProject(PROJECT_A);

    expect(keyring.hasProject(PROJECT_A)).toBe(false);
    expect(snapshot.projects).toEqual({});
    expect(() => keyring.projectKey(PROJECT_A)).toThrow(UnknownProjectError);
  });

  it("survives a persistence round trip", async () => {
    const original = await createKeyring(PASS);
    await original.addProject(PROJECT_A);
    const sealed = await seal(
      original.projectKey(PROJECT_A),
      bytes("chapter one"),
    );
    const snapshot = original.snapshot();

    const reopened = await unlockKeyring(snapshot, PASS);
    expect(text(await open(reopened.projectKey(PROJECT_A), sealed))).toBe(
      "chapter one",
    );
  });
});

describe("keyring — no unwrapped key material is ever persisted", () => {
  it("stores each data key as a sealed envelope, never as raw bytes", async () => {
    const keyring = await createKeyring(PASS);
    const snapshot = await keyring.addProject(PROJECT_A);

    const wrapped = Uint8Array.from(atob(snapshot.projects[PROJECT_A]), (c) =>
      c.charCodeAt(0),
    );
    // A sealed 32-byte key is exactly overhead + KEY_BYTES long, and carries
    // the envelope magic. Raw key material would be KEY_BYTES with no magic.
    expect(isEnvelope(wrapped)).toBe(true);
    expect(wrapped).toHaveLength(ENVELOPE_OVERHEAD_BYTES + KEY_BYTES);
  });

  it("serialises to exactly the documented fields", async () => {
    const keyring = await createKeyring(PASS);
    const snapshot = await keyring.addProject(PROJECT_A);
    expect(Object.keys(snapshot).sort()).toEqual([
      "kdf",
      "projects",
      "verifier",
      "version",
    ]);
    expect(Object.keys(snapshot.kdf).sort()).toEqual([
      "algorithm",
      "iterations",
      "memoryKiB",
      "parallelism",
      "salt",
    ]);
  });

  it("never writes the passphrase into the serialised form", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    expect(JSON.stringify(keyring.snapshot())).not.toContain(PASS);
  });
});

describe("keyring — locking", () => {
  it("denies key access once locked", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    keyring.lock();

    expect(keyring.isLocked()).toBe(true);
    expect(() => keyring.projectKey(PROJECT_A)).toThrow(KeyringLockedError);
  });

  it("still exposes wrapped material after locking", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    keyring.lock();
    // Wrapped material is not secret — persistence must still work post-lock.
    expect(Object.keys(keyring.snapshot().projects)).toEqual([PROJECT_A]);
  });

  it("refuses to register a project while locked", async () => {
    const keyring = await createKeyring(PASS);
    keyring.lock();
    await expect(keyring.addProject(PROJECT_A)).rejects.toBeInstanceOf(
      KeyringLockedError,
    );
  });

  it("can be reopened from its snapshot after locking", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    const snapshot = keyring.snapshot();
    keyring.lock();

    const reopened = await unlockKeyring(snapshot, PASS);
    expect(reopened.hasProject(PROJECT_A)).toBe(true);
  });
});

describe("keyring — changing the passphrase", () => {
  it("rewraps without touching file-level data", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    // Sealed before the change; must still open after it. This is the property
    // that makes a passphrase change a rewrap rather than a data migration.
    const sealed = await seal(
      keyring.projectKey(PROJECT_A),
      bytes("chapter one"),
    );

    const rewrapped = await keyring.changePassphrase("a brand new passphrase");
    const reopened = await unlockKeyring(rewrapped, "a brand new passphrase");

    expect(text(await open(reopened.projectKey(PROJECT_A), sealed))).toBe(
      "chapter one",
    );
  });

  it("invalidates the old passphrase", async () => {
    const keyring = await createKeyring(PASS);
    const rewrapped = await keyring.changePassphrase("a brand new passphrase");
    await expect(unlockKeyring(rewrapped, PASS)).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it("uses a fresh salt and re-seals every wrapped key", async () => {
    const keyring = await createKeyring(PASS);
    const before = await keyring.addProject(PROJECT_A);
    const beforeSalt = before.kdf.salt;
    const beforeWrapped = before.projects[PROJECT_A];

    const after = await keyring.changePassphrase("a brand new passphrase");

    expect(after.kdf.salt).not.toBe(beforeSalt);
    expect(after.projects[PROJECT_A]).not.toBe(beforeWrapped);
  });

  it("refuses while locked", async () => {
    const keyring = await createKeyring(PASS);
    keyring.lock();
    await expect(keyring.changePassphrase("another")).rejects.toBeInstanceOf(
      KeyringLockedError,
    );
  });
});

describe("keyring store — persistence", () => {
  const original = io.getStorageAdapter();

  beforeEach(() => {
    io.setStorageAdapter(createMemoryAdapter());
  });

  afterEach(() => {
    io.setStorageAdapter(original);
  });

  it("reports absence before anything is written", async () => {
    expect(await keyringExists("/ws")).toBe(false);
    expect(await readWrappedKeyring("/ws")).toBeNull();
  });

  it("round-trips a keyring through the filesystem", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    await writeWrappedKeyring(keyring.snapshot(), "/ws");

    expect(await keyringExists("/ws")).toBe(true);
    const loaded = await readWrappedKeyring("/ws");
    expect(loaded).not.toBeNull();

    const reopened = await unlockKeyring(loaded as WrappedKeyring, PASS);
    expect(reopened.hasProject(PROJECT_A)).toBe(true);
  });

  it("writes the keyring at the workspace root, outside any project", async () => {
    await writeWrappedKeyring((await createKeyring(PASS)).snapshot(), "/ws");
    const raw = await io.readFile(`/ws/${KEYRING_FILENAME}`, "utf-8");
    expect(JSON.parse(raw).version).toBe(1);
  });

  it("writes no unwrapped key material to disk", async () => {
    const keyring = await createKeyring(PASS);
    await keyring.addProject(PROJECT_A);
    await writeWrappedKeyring(keyring.snapshot(), "/ws");

    const raw = await io.readFile(`/ws/${KEYRING_FILENAME}`, "utf-8");
    expect(raw).not.toContain(PASS);
    expect(JSON.parse(raw).projects[PROJECT_A]).toEqual(expect.any(String));
  });

  it("rejects a corrupt keyring file rather than returning a partial one", async () => {
    await io.mkdir("/ws", { recursive: true });
    await io.writeFile(`/ws/${KEYRING_FILENAME}`, "{ not json");
    await expect(readWrappedKeyring("/ws")).rejects.toBeInstanceOf(
      KeyringFormatError,
    );
  });

  it("rejects a structurally invalid keyring file", async () => {
    await io.mkdir("/ws", { recursive: true });
    await io.writeFile(
      `/ws/${KEYRING_FILENAME}`,
      JSON.stringify({ version: 1 }),
    );
    await expect(readWrappedKeyring("/ws")).rejects.toBeInstanceOf(
      KeyringFormatError,
    );
  });

  it("overwrites an existing keyring on rewrap", async () => {
    const keyring = await createKeyring(PASS);
    await writeWrappedKeyring(keyring.snapshot(), "/ws");
    const rewrapped = await keyring.changePassphrase("a brand new passphrase");
    await writeWrappedKeyring(rewrapped, "/ws");

    const loaded = await readWrappedKeyring("/ws");
    expect(loaded?.kdf.salt).toBe(rewrapped.kdf.salt);
  });
});
