// ADR-021 Phase 0 (Task 4): proves the "bind once at startup, ambient
// thereafter" mechanism required by FR4/FR5.
//
// Three claims:
//   1. Before any bootstrap runs, getStorageContext() returns undefined --
//      preserving today's web/desktop behavior unchanged (Section 4,
//      docs/standards/storage-context.md).
//   2. bootstrapNativeStorageContext() installs the Directory.Data-relative
//      "/projects" as the process-wide default StorageContext's tenantRoot
//      (FR4/FR5), along with the real Capacitor adapter, and ensures that dir
//      exists. It does NOT resolve an absolute file:// URI (that would mangle
//      every adapter path, which is rooted at Directory.Data).
//   3. AFTER bootstrap, a search issued with NO explicit
//      runInStorageContext wrapper around it -- the real native production
//      shape, createNativeSearchTransport({}) with no deps -- resolves
//      correctly against that ambient default, proving "bound once, read
//      many times without re-binding".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Everything the mocked `@capacitor/filesystem` module needs must be built
// inside vi.hoisted(), since vi.mock() factories are hoisted above imports.
const mocks = vi.hoisted(() => {
  const files = new Map<string, string>();
  const dirs = new Set<string>([""]);

  function norm(p: string): string {
    return p.replace(/^\/+/, "").replace(/\/+$/, "");
  }
  function parentOf(key: string): string {
    const i = key.lastIndexOf("/");
    return i === -1 ? "" : key.slice(0, i);
  }
  function addAncestors(key: string): void {
    const segs = key.split("/").filter(Boolean);
    let acc = "";
    for (const s of segs) {
      acc = acc ? `${acc}/${s}` : s;
      dirs.add(acc);
    }
  }

  const getUri = vi.fn(async ({ path }: { path: string }) => ({
    uri: `file:///data/user/0/app.getwrite/files${path ? `/${norm(path)}` : ""}`,
  }));

  const mkdir = vi.fn(
    async ({ path, recursive }: { path: string; recursive?: boolean }) => {
      const key = norm(path);
      if (recursive) addAncestors(key);
      else dirs.add(key);
    },
  );

  const writeFile = vi.fn(
    async ({ path, data }: { path: string; data: string }) => {
      const key = norm(path);
      addAncestors(parentOf(key));
      files.set(key, data);
      return { uri: `file:///${key}` };
    },
  );

  const readFile = vi.fn(async ({ path }: { path: string }) => {
    const key = norm(path);
    if (!files.has(key)) throw new Error("File does not exist");
    return { data: files.get(key)! };
  });

  const readdir = vi.fn(async ({ path }: { path: string }) => {
    const key = norm(path);
    if (key !== "" && !dirs.has(key)) throw new Error("Folder does not exist");
    const prefix = key === "" ? "" : `${key}/`;
    const names = new Set<string>();
    for (const k of files.keys()) {
      if (k !== key && k.startsWith(prefix))
        names.add(k.slice(prefix.length).split("/")[0]!);
    }
    for (const k of dirs) {
      if (k !== "" && k !== key && k.startsWith(prefix))
        names.add(k.slice(prefix.length).split("/")[0]!);
    }
    return {
      files: [...names].map((name) => ({
        name,
        type: dirs.has(`${prefix}${name}`)
          ? ("directory" as const)
          : ("file" as const),
        size: 0,
      })),
    };
  });

  const stat = vi.fn(async ({ path }: { path: string }) => {
    const key = norm(path);
    if (files.has(key))
      return { type: "file" as const, size: files.get(key)!.length };
    if (dirs.has(key)) return { type: "directory" as const, size: 0 };
    throw new Error("does not exist");
  });

  return { files, dirs, getUri, mkdir, writeFile, readFile, readdir, stat };
});

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    getUri: mocks.getUri,
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
    readFile: mocks.readFile,
    readdir: mocks.readdir,
    stat: mocks.stat,
    appendFile: vi.fn(),
    deleteFile: vi.fn(),
    rmdir: vi.fn(),
    rename: vi.fn(),
    copy: vi.fn(),
  },
  Directory: {
    Data: "DATA",
    Documents: "DOCUMENTS",
    Library: "LIBRARY",
    Cache: "CACHE",
  },
  Encoding: { UTF8: "utf8", ASCII: "ascii", UTF16: "utf16" },
}));

async function resetAll(): Promise<void> {
  mocks.files.clear();
  mocks.dirs.clear();
  mocks.dirs.add("");
  vi.clearAllMocks();

  const { __resetDefaultStorageContextForTests } =
    await import("../../src/lib/models/storage-context");
  __resetDefaultStorageContextForTests();
  const { __resetNativeBootstrapForTests } =
    await import("../../src/lib/models/native-bootstrap");
  __resetNativeBootstrapForTests();
}

describe("native-bootstrap", () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterEach(async () => {
    await resetAll();
  });

  it("getStorageContext() returns undefined before any bootstrap runs (web/desktop behavior unchanged)", async () => {
    const { getStorageContext } =
      await import("../../src/lib/models/storage-context");
    expect(getStorageContext()).toBeUndefined();
  });

  it("binds the Directory.Data-relative /projects as the default tenantRoot and ensures it exists (FR4/FR5)", async () => {
    const { bootstrapNativeStorageContext } =
      await import("../../src/lib/models/native-bootstrap");
    const { getStorageContext } =
      await import("../../src/lib/models/storage-context");

    expect(getStorageContext()).toBeUndefined();

    await bootstrapNativeStorageContext();

    const ctx = getStorageContext();
    expect(ctx).toBeDefined();
    // tenantRoot is Directory.Data-relative "/projects" — NOT an absolute
    // file:// URI. The adapter is rooted at Directory.Data and re-roots every
    // path under it, so an absolute URI here would mangle every read/write.
    expect(ctx?.tenantRoot).toBe("/projects");
    expect(ctx?.adapter).toBeDefined();
    // The absolute-URI resolution (Filesystem.getUri) is no longer used.
    expect(mocks.getUri).not.toHaveBeenCalled();
    // Ensures the projects dir exists (idempotent recursive mkdir) so the first
    // list on a fresh device returns an empty array rather than ENOENT.
    expect(mocks.mkdir).toHaveBeenCalledWith(
      expect.objectContaining({ path: "projects", recursive: true }),
    );
  });

  it("a search issued with no explicit runInStorageContext wrapper resolves via the ambient default after bootstrap (FR5)", async () => {
    const { bootstrapNativeStorageContext } =
      await import("../../src/lib/models/native-bootstrap");
    const { getStorageContext } =
      await import("../../src/lib/models/storage-context");
    const { createNativeSearchTransport } =
      await import("../../src/store/transport/native-search-backend");

    await bootstrapNativeStorageContext();

    const ctx = getStorageContext();
    if (!ctx)
      throw new Error("expected an ambient default context after bootstrap");

    // Seed a minimal searchable project through the SAME adapter bootstrap
    // installed -- proving the later, wrapper-less search call flows
    // through that one already-bound adapter instance, not a freshly
    // re-bound one.
    const root = "/projects/proj-1";
    await ctx.adapter.mkdir(`${root}/meta/index`, { recursive: true });
    await ctx.adapter.writeFile(
      `${root}/project.json`,
      JSON.stringify({ id: "proj-1" }),
    );
    await ctx.adapter.writeFile(
      `${root}/meta/index/inverted.json`,
      JSON.stringify({ dragon: { "res-1": 3 } }),
    );
    await ctx.adapter.writeFile(
      `${root}/meta/resource-res-1.meta.json`,
      JSON.stringify({ name: "Dragon Notes" }),
    );

    // Production shape: no deps supplied, no explicit runInStorageContext
    // wrapper anywhere in this test around the search call itself.
    const transport = createNativeSearchTransport({ projectsDir: "/projects" });
    const results = await transport.search("proj-1", "dragon");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      resourceId: "res-1",
      title: "Dragon Notes",
    });
  });

  it("running bootstrap twice does not re-resolve or re-install a second default context (bound exactly once)", async () => {
    const { bootstrapNativeStorageContext } =
      await import("../../src/lib/models/native-bootstrap");
    const { getStorageContext } =
      await import("../../src/lib/models/storage-context");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootstrapNativeStorageContext();
    const first = getStorageContext();
    expect(mocks.mkdir).toHaveBeenCalledTimes(1); // ensured the projects dir once

    await bootstrapNativeStorageContext();
    const second = getStorageContext();

    expect(mocks.mkdir).toHaveBeenCalledTimes(1); // second bootstrap is a no-op
    expect(second).toBe(first); // same object identity -- not re-installed
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
