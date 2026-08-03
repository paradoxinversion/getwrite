// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import {
  __resetKeyringSessionForTests,
  isSessionUnlocked,
  registerProject,
} from "../../src/lib/models/crypto/keyring-session";
import cryptoReducer, {
  checkWorkspaceLock,
  createWorkspaceLock,
  unlockWorkspace,
  workspaceLocked,
} from "../../src/store/cryptoSlice";

const WORKSPACE = "/ws";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PASS = "correct horse battery staple";

let adapter: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

/** A store holding only this slice, run inside a workspace storage context. */
function makeStore() {
  return configureStore({ reducer: { crypto: cryptoReducer } });
}

/** Runs a thunk with the workspace bound, as the app does per request. */
function inWorkspace<T>(fn: () => Promise<T>): Promise<T> {
  return runInStorageContext({ tenantRoot: WORKSPACE, adapter }, fn);
}

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

describe("cryptoSlice — lock status", () => {
  it("starts unknown", () => {
    expect(makeStore().getState().crypto.status).toBe("unknown");
  });

  it("reports a workspace with no keyring as absent", async () => {
    const store = makeStore();
    await inWorkspace(() => store.dispatch(checkWorkspaceLock()).unwrap());

    // FR4: nothing here should make the UI prompt for a passphrase.
    expect(store.getState().crypto.status).toBe("absent");
    expect(store.getState().crypto.encryptedProjectIds).toEqual([]);
  });

  it("reports a fresh keyring as unlocked", async () => {
    const store = makeStore();
    await inWorkspace(() => store.dispatch(createWorkspaceLock(PASS)).unwrap());

    expect(store.getState().crypto.status).toBe("unlocked");
    expect(isSessionUnlocked()).toBe(true);
  });

  it("reports an existing keyring as locked after a lock", async () => {
    const store = makeStore();
    await inWorkspace(async () => {
      await store.dispatch(createWorkspaceLock(PASS)).unwrap();
      await registerProject(PROJECT_A, WORKSPACE, adapter);
    });
    store.dispatch(workspaceLocked());

    await inWorkspace(() => store.dispatch(checkWorkspaceLock()).unwrap());
    expect(store.getState().crypto.status).toBe("locked");
    expect(store.getState().crypto.encryptedProjectIds).toEqual([PROJECT_A]);
  });
});

describe("cryptoSlice — unlocking", () => {
  beforeEach(async () => {
    const store = makeStore();
    await inWorkspace(async () => {
      await store.dispatch(createWorkspaceLock(PASS)).unwrap();
      await registerProject(PROJECT_A, WORKSPACE, adapter);
    });
    store.dispatch(workspaceLocked());
  });

  it("unlocks with the right passphrase", async () => {
    const store = makeStore();
    await inWorkspace(() => store.dispatch(unlockWorkspace(PASS)).unwrap());

    expect(store.getState().crypto.status).toBe("unlocked");
    expect(store.getState().crypto.errorMessage).toBe("");
    expect(isSessionUnlocked()).toBe(true);
  });

  it("stays locked and reports a failure on the wrong passphrase", async () => {
    const store = makeStore();
    await inWorkspace(() =>
      store
        .dispatch(unlockWorkspace("wrong"))
        .unwrap()
        .catch(() => undefined),
    );

    expect(store.getState().crypto.status).toBe("locked");
    expect(store.getState().crypto.errorMessage).not.toBe("");
    expect(isSessionUnlocked()).toBe(false);
  });
});

describe("cryptoSlice — no key material reaches the store", () => {
  it("holds nothing but status, ids, and display text", async () => {
    const store = makeStore();
    await inWorkspace(async () => {
      await store.dispatch(createWorkspaceLock(PASS)).unwrap();
      await registerProject(PROJECT_A, WORKSPACE, adapter);
      await store.dispatch(checkWorkspaceLock()).unwrap();
    });

    const state = store.getState().crypto;
    expect(Object.keys(state).sort()).toEqual([
      "encryptedProjectIds",
      "errorMessage",
      "isUnlocking",
      "status",
    ]);

    // The decisive check: the whole slice must survive JSON serialisation, so
    // devtools and any future persistence middleware can never capture a key.
    const serialised = JSON.stringify(state);
    expect(serialised).not.toContain(PASS);
    expect(JSON.parse(serialised)).toEqual(state);
  });

  it("keeps the passphrase out of a failure message", async () => {
    const store = makeStore();
    await inWorkspace(async () => {
      await store.dispatch(createWorkspaceLock(PASS)).unwrap();
    });
    store.dispatch(workspaceLocked());

    const secret = "hunter2-the-actual-passphrase";
    await inWorkspace(() =>
      store
        .dispatch(unlockWorkspace(secret))
        .unwrap()
        .catch(() => undefined),
    );

    expect(store.getState().crypto.errorMessage).not.toContain(secret);
  });
});
