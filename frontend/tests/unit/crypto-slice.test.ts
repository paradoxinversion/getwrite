// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import cryptoReducer, {
  checkWorkspaceLock,
  encryptProject,
  lockWorkspace,
  unlockWorkspace,
} from "../../src/store/cryptoSlice";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PASS = "correct horse battery staple";

/** The status payload `/api/encryption` returns. */
function status(overrides: Record<string, unknown> = {}) {
  return {
    isAvailable: true,
    hasKeyring: true,
    isUnlocked: false,
    encryptedProjectIds: [PROJECT_A],
    ...overrides,
  };
}

/** Stubs `fetch` with a single JSON response. */
function stubFetch(body: unknown, ok = true, statusCode = 200): void {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok, status: statusCode, json: async () => body }),
  );
}

function makeStore() {
  return configureStore({ reducer: { crypto: cryptoReducer } });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cryptoSlice — lock status", () => {
  it("starts unknown", () => {
    expect(makeStore().getState().crypto.status).toBe("unknown");
  });

  it("reports a deployment that cannot offer encryption", async () => {
    stubFetch(
      status({
        isAvailable: false,
        hasKeyring: false,
        encryptedProjectIds: [],
      }),
    );
    const store = makeStore();
    await store.dispatch(checkWorkspaceLock()).unwrap();

    // FR23: hosted is excluded, and the UI must not offer it.
    expect(store.getState().crypto.status).toBe("unavailable");
  });

  it("reports a workspace with no keyring as absent", async () => {
    stubFetch(status({ hasKeyring: false, encryptedProjectIds: [] }));
    const store = makeStore();
    await store.dispatch(checkWorkspaceLock()).unwrap();

    // FR4: nothing here should make the UI prompt for a passphrase.
    expect(store.getState().crypto.status).toBe("absent");
  });

  it("reports an existing keyring as locked", async () => {
    stubFetch(status());
    const store = makeStore();
    await store.dispatch(checkWorkspaceLock()).unwrap();

    expect(store.getState().crypto.status).toBe("locked");
    expect(store.getState().crypto.encryptedProjectIds).toEqual([PROJECT_A]);
  });
});

describe("cryptoSlice — unlocking", () => {
  it("unlocks with the right passphrase", async () => {
    stubFetch(status({ isUnlocked: true }));
    const store = makeStore();
    await store.dispatch(unlockWorkspace(PASS)).unwrap();

    expect(store.getState().crypto.status).toBe("unlocked");
    expect(store.getState().crypto.errorMessage).toBe("");
  });

  it("stays locked and reports the server's message on a wrong passphrase", async () => {
    stubFetch({ error: "Incorrect passphrase." }, false, 401);
    const store = makeStore();
    await store
      .dispatch(unlockWorkspace("wrong"))
      .unwrap()
      .catch(() => undefined);

    expect(store.getState().crypto.status).toBe("locked");
    expect(store.getState().crypto.errorMessage).toBe("Incorrect passphrase.");
  });

  it("locks again on request", async () => {
    stubFetch(status({ isUnlocked: false }));
    const store = makeStore();
    await store.dispatch(lockWorkspace()).unwrap();
    expect(store.getState().crypto.status).toBe("locked");
  });
});

describe("cryptoSlice — encrypting a project", () => {
  it("tracks the conversion and folds in the new status", async () => {
    stubFetch(status({ isUnlocked: true }));
    const store = makeStore();

    const pending = store.dispatch(
      encryptProject({
        projectId: PROJECT_A,
        projectName: "X",
        passphrase: PASS,
      }),
    );
    expect(store.getState().crypto.isConverting).toBe(true);

    await pending.unwrap();
    expect(store.getState().crypto.isConverting).toBe(false);
    expect(store.getState().crypto.status).toBe("unlocked");
  });

  it("reports a failure without leaving the UI stuck converting", async () => {
    stubFetch({ error: "Could not encrypt." }, false, 400);
    const store = makeStore();
    await store
      .dispatch(
        encryptProject({
          projectId: PROJECT_A,
          projectName: "X",
          passphrase: null,
        }),
      )
      .unwrap()
      .catch(() => undefined);

    expect(store.getState().crypto.isConverting).toBe(false);
    expect(store.getState().crypto.errorMessage).toBe("Could not encrypt.");
  });
});

describe("cryptoSlice — no key material reaches the store", () => {
  it("holds nothing but status, ids, and display text", async () => {
    stubFetch(status({ isUnlocked: true }));
    const store = makeStore();
    await store.dispatch(unlockWorkspace(PASS)).unwrap();

    const state = store.getState().crypto;
    expect(Object.keys(state).sort()).toEqual([
      "encryptedProjectIds",
      "errorMessage",
      "isConverting",
      "isUnlocking",
      "status",
    ]);
    // Survives serialisation, so devtools and any persistence middleware can
    // never capture a key.
    const serialised = JSON.stringify(state);
    expect(serialised).not.toContain(PASS);
    expect(JSON.parse(serialised)).toEqual(state);
  });
});
