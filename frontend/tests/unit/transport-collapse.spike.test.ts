// SPIKE (ADR-021, phase 2): proves the transport-collapse seam for search.
//
// Three claims:
//   1. Web build → the transport routes over HTTP, byte-for-byte the original
//      fetch('/api/project/:id/search') call. The server path is untouched.
//   2. Native build → the transport dispatches to the in-process backend
//      instead of fetch (proven by the native flag flipping the code path).
//   3. The in-process backend reuses the SAME shared search core
//      (executeSearch) over a capacitorFsAdapter, returning a real hit with no
//      HTTP at all — tying phase 2 to phase 1.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSearchRequest } from "../../src/store/search-transport-service";
import { createNativeSearchTransport } from "../../src/store/transport/native-search-backend";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import type { CapacitorFilesystemLike } from "../../src/lib/models/capacitor-filesystem";

const RUNTIME_ENV = "NEXT_PUBLIC_GETWRITE_RUNTIME";
const originalFetch = globalThis.fetch;
const originalRuntime = process.env[RUNTIME_ENV];

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalRuntime === undefined) delete process.env[RUNTIME_ENV];
  else process.env[RUNTIME_ENV] = originalRuntime;
  vi.restoreAllMocks();
});

describe("transport collapse — web routing (HTTP path preserved)", () => {
  beforeEach(() => {
    delete process.env[RUNTIME_ENV]; // default → "web"
  });

  it("routes executeSearchRequest through fetch to the /api search route", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          resourceId: "res-1",
          title: "Dragon Notes",
          snippet: "",
          status: null,
          folderId: null,
          tags: [],
        },
      ],
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const results = await executeSearchRequest(
      { projectId: "proj-1" },
      "dragon",
      { status: "draft", tags: ["t1", "t2"] },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe("/api/project/proj-1/search?q=dragon&status=draft&tags=t1%2Ct2");
    expect(results).toHaveLength(1);
    expect(results[0].resourceId).toBe("res-1");
  });
});

describe("transport collapse — native routing (no HTTP)", () => {
  beforeEach(() => {
    process.env[RUNTIME_ENV] = "native";
  });

  it("dispatches to the in-process backend instead of fetch", async () => {
    const fetchMock = vi.fn(() => {
      throw new Error("fetch must not be called on the native path");
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    // No deps are threaded through the service, so the native backend resolves
    // `nativeFilesystem()` to the real `@capacitor/filesystem` bridge
    // (ADR-021 Phase 0, Task 3 — the old "Native filesystem not wired" stub is
    // gone). Outside a real Capacitor WebView there's no native implementation
    // registered for the plugin, so `findProjectRoot`'s directory read fails
    // and it swallows that failure as "project not found" — proving the real
    // bridge was reached (not the literal stub message) without asserting on
    // Capacitor's internal, version-fragile error text.
    await expect(
      executeSearchRequest({ projectId: "proj-1" }, "dragon"),
    ).rejects.toThrow(/Project proj-1 not found/);
    await expect(
      executeSearchRequest({ projectId: "proj-1" }, "dragon"),
    ).rejects.not.toThrow(/Native filesystem not wired/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("transport collapse — in-process backend reuses the shared search core", () => {
  /** Seeds a minimal, searchable project into a Capacitor fake. */
  async function seedProject(fs: CapacitorFilesystemLike): Promise<void> {
    const adapter = capacitorFsAdapter(fs);
    const root = "/projects/proj-1";
    await adapter.mkdir(`${root}/meta/index`, { recursive: true });
    await adapter.writeFile(
      `${root}/project.json`,
      JSON.stringify({ id: "proj-1" }),
    );
    // Inverted index: term → { resourceId: frequency }.
    await adapter.writeFile(
      `${root}/meta/index/inverted.json`,
      JSON.stringify({ dragon: { "res-1": 3 } }),
    );
    // Sidecar carrying the resource's display name.
    await adapter.writeFile(
      `${root}/meta/resource-res-1.meta.json`,
      JSON.stringify({ name: "Dragon Notes" }),
    );
  }

  it("returns a real hit from executeSearch over the Capacitor adapter, with no fetch", async () => {
    const fetchMock = vi.fn(() => {
      throw new Error("fetch must not be called in-process");
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const fs = createFakeCapacitorFilesystem();
    await seedProject(fs);

    const transport = createNativeSearchTransport({
      fs,
      projectsDir: "/projects",
    });
    const results = await transport.search("proj-1", "dragon");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      resourceId: "res-1",
      title: "Dragon Notes", // proves the sidecar was read through the adapter
      status: null,
      folderId: null,
      tags: [],
    });
  });

  it("returns no hits for a term absent from the index (core ran, empty result)", async () => {
    const fs = createFakeCapacitorFilesystem();
    await seedProject(fs);
    const transport = createNativeSearchTransport({
      fs,
      projectsDir: "/projects",
    });

    expect(await transport.search("proj-1", "unicorn")).toEqual([]);
  });
});
