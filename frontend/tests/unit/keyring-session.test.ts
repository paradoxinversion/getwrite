// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { WrongPassphraseError } from "../../src/lib/models/crypto/keyring";
import {
  KEYRING_FILENAME,
  readWrappedKeyring,
} from "../../src/lib/models/crypto/keyring-store";
import {
  NoKeyringError,
  SessionLockedError,
  __resetKeyringSessionForTests,
  createWorkspaceKeyring,
  encryptedProjectIds,
  getSessionKeyring,
  isSessionUnlocked,
  lockSession,
  registerProject,
  requireSessionKeyring,
  unlockSession,
  workspaceHasKeyring,
} from "../../src/lib/models/crypto/keyring-session";

const WORKSPACE = "/ws";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const PASS = "correct horse battery staple";

let adapter: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

beforeEach(async () => {
  adapter = createMemoryAdapter();
  io.setStorageAdapter(adapter);
  await adapter.mkdir(WORKSPACE, { recursive: true });
  __resetKeyringSessionForTests();
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetKeyringSessionForTests();
});

describe("keyring session — a workspace with no keyring", () => {
  it("reports no keyring and stays locked", async () => {
    expect(await workspaceHasKeyring(WORKSPACE, adapter)).toBe(false);
    expect(isSessionUnlocked()).toBe(false);
    expect(getSessionKeyring()).toBeNull();
  });

  it("raises a distinct error when asked to unlock", async () => {
    // "Never set up" must be distinguishable from "wrong passphrase", or the
    // UI cannot tell whether to prompt or to offer setup.
    await expect(
      unlockSession(PASS, WORKSPACE, adapter),
    ).rejects.toBeInstanceOf(NoKeyringError);
  });

  it("raises when project keys are demanded", () => {
    expect(() => requireSessionKeyring()).toThrow(SessionLockedError);
  });
});

describe("keyring session — creating a workspace keyring", () => {
  it("persists it and leaves the session unlocked", async () => {
    await createWorkspaceKeyring(PASS, WORKSPACE, adapter);

    expect(isSessionUnlocked()).toBe(true);
    expect(await workspaceHasKeyring(WORKSPACE, adapter)).toBe(true);
    expect(await readWrappedKeyring(WORKSPACE)).not.toBeNull();
  });

  it("refuses to overwrite an existing keyring", async () => {
    await createWorkspaceKeyring(PASS, WORKSPACE, adapter);
    // Overwriting would orphan every existing project's data key.
    await expect(
      createWorkspaceKeyring("another passphrase", WORKSPACE, adapter),
    ).rejects.toThrow(/already/i);
  });
});

describe("keyring session — unlocking", () => {
  beforeEach(async () => {
    await createWorkspaceKeyring(PASS, WORKSPACE, adapter);
    await registerProject(PROJECT_A, WORKSPACE, adapter);
    await registerProject(PROJECT_B, WORKSPACE, adapter);
    lockSession();
  });

  it("opens every encrypted project from one passphrase", async () => {
    await unlockSession(PASS, WORKSPACE, adapter);

    // FR7: one unlock, whole workspace.
    const keyring = requireSessionKeyring();
    expect(keyring.hasProject(PROJECT_A)).toBe(true);
    expect(keyring.hasProject(PROJECT_B)).toBe(true);
    expect(keyring.projectKey(PROJECT_A)).not.toBe(
      keyring.projectKey(PROJECT_B),
    );
  });

  it("rejects a wrong passphrase and stays locked", async () => {
    await expect(
      unlockSession("wrong passphrase", WORKSPACE, adapter),
    ).rejects.toBeInstanceOf(WrongPassphraseError);

    expect(isSessionUnlocked()).toBe(false);
    expect(getSessionKeyring()).toBeNull();
  });

  it("lists the encrypted projects without needing the passphrase", async () => {
    // The Start screen needs this before an unlock to decide whether to prompt.
    expect(await encryptedProjectIds(WORKSPACE, adapter)).toEqual(
      expect.arrayContaining([PROJECT_A, PROJECT_B]),
    );
    expect(isSessionUnlocked()).toBe(false);
  });
});

describe("keyring session — locking", () => {
  beforeEach(async () => {
    await createWorkspaceKeyring(PASS, WORKSPACE, adapter);
    await registerProject(PROJECT_A, WORKSPACE, adapter);
  });

  it("discards the keys", () => {
    lockSession();

    expect(isSessionUnlocked()).toBe(false);
    expect(getSessionKeyring()).toBeNull();
    expect(() => requireSessionKeyring()).toThrow(SessionLockedError);
  });

  it("locks the underlying keyring, not merely the reference", async () => {
    const keyring = requireSessionKeyring();
    lockSession();

    // Anything still holding a reference must find it unusable, or locking
    // would be cosmetic.
    expect(keyring.isLocked()).toBe(true);
    expect(() => keyring.projectKey(PROJECT_A)).toThrow();
  });

  it("is safe to call when already locked", () => {
    lockSession();
    expect(() => lockSession()).not.toThrow();
  });

  it("can be unlocked again afterwards", async () => {
    lockSession();
    await unlockSession(PASS, WORKSPACE, adapter);
    expect(requireSessionKeyring().hasProject(PROJECT_A)).toBe(true);
  });
});

describe("keyring session — key material never leaves memory", () => {
  it("writes no passphrase or unwrapped key to disk", async () => {
    await createWorkspaceKeyring(PASS, WORKSPACE, adapter);
    await registerProject(PROJECT_A, WORKSPACE, adapter);

    const onDisk = await io.readFile(
      `${WORKSPACE}/${KEYRING_FILENAME}`,
      "utf-8",
    );
    expect(onDisk).not.toContain(PASS);
    // Only wrapped material and public KDF parameters.
    expect(Object.keys(JSON.parse(onDisk)).sort()).toEqual([
      "kdf",
      "projects",
      "verifier",
      "version",
    ]);
  });
});
