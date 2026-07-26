// ADR-021 Phase 0 — regression tests for the capacitorFsAdapter error handling
// that the on-device (Pixel 7 Pro) gate surfaced and the in-memory conformance
// fake could NOT catch.
//
// The real @capacitor/filesystem plugin wraps failures in a CapacitorException
// that carries its OWN `code` (a Capacitor code, not a Node errno). The adapter
// originally did `if ("code" in err) return err.code === "ENOENT"`, which
// short-circuited to false on every real plugin error and never consulted the
// message — silently breaking both not-found and already-exists detection
// on-device. It also forwarded `mkdir` straight through, but the real plugin
// throws "Directory ... already exists" even with `recursive: true`, unlike
// Node's idempotent `fs.mkdir`.
//
// These tests drive the adapter with a fake that reproduces the real plugin's
// error shape (a non-Node `code` PLUS a human message), which the standard
// conformance fake does not.
import { describe, expect, it, vi } from "vitest";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import type { CapacitorFilesystemLike } from "../../src/lib/models/capacitor-filesystem";

/** An error shaped like a CapacitorException: a Capacitor `code` + a message. */
function capacitorError(message: string, code = "OS-PLUG-FILE-0001"): Error {
  return Object.assign(new Error(message), { code });
}

/** Builds a CapacitorFilesystemLike whose given methods are overridden; the rest throw. */
function fakePlugin(
  overrides: Partial<CapacitorFilesystemLike>,
): CapacitorFilesystemLike {
  const unused = (name: string) => async () => {
    throw new Error(`${name} not used in this test`);
  };
  return {
    readFile: unused("readFile"),
    writeFile: unused("writeFile"),
    appendFile: unused("appendFile"),
    deleteFile: unused("deleteFile"),
    mkdir: unused("mkdir"),
    rmdir: unused("rmdir"),
    readdir: unused("readdir"),
    stat: unused("stat"),
    rename: unused("rename"),
    copy: unused("copy"),
    ...overrides,
  } as CapacitorFilesystemLike;
}

describe("capacitorFsAdapter — real-plugin error classification (device gate regression)", () => {
  it("maps a Capacitor-coded 'File does not exist' to ENOENT (message wins over the plugin code)", async () => {
    const adapter = capacitorFsAdapter(
      fakePlugin({
        readFile: async () => {
          throw capacitorError("File does not exist: foo.txt");
        },
      }),
    );

    await expect(adapter.readFile("/foo.txt", "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("treats a recursive mkdir onto an existing dir as a no-op (Node idempotency), despite the plugin throwing", async () => {
    const mkdir = vi.fn(async () => {
      throw capacitorError(
        "Directory at '/data/x/dst/' already exists, cannot be overwritten.",
      );
    });
    const adapter = capacitorFsAdapter(fakePlugin({ mkdir }));

    // Must NOT throw — matches Node's fs.mkdir(recursive: true).
    await expect(
      adapter.mkdir("/data/x/dst", { recursive: true }),
    ).resolves.toBeUndefined();
    expect(mkdir).toHaveBeenCalledOnce();
  });

  it("still surfaces an already-exists failure for a NON-recursive mkdir (matches node:fs)", async () => {
    const adapter = capacitorFsAdapter(
      fakePlugin({
        mkdir: async () => {
          throw capacitorError("Directory already exists");
        },
      }),
    );

    await expect(adapter.mkdir("/data/x/dst")).rejects.toThrow(/exists/i);
  });

  it("does not misread a genuine 'does not exist' failure as already-exists", async () => {
    // A parent-missing mkdir failure must propagate, not be swallowed.
    const adapter = capacitorFsAdapter(
      fakePlugin({
        mkdir: async () => {
          throw capacitorError("Parent directory does not exist");
        },
      }),
    );

    await expect(
      adapter.mkdir("/data/missing/child", { recursive: true }),
    ).rejects.toThrow(/does not exist/i);
  });
});
