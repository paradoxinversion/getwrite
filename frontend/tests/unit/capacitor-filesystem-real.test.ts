// ADR-021 Phase 0: proves createRealCapacitorFilesystem() translates
// correctly between CapacitorFilesystemLike and the real `@capacitor/filesystem`
// plugin's actual API shape (directory root, Encoding enum, FileInfo/StatResult
// extra fields), and that this native-only module is never statically
// imported from anything the web bundle could reach.
import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readFile = vi.fn();
const writeFile = vi.fn();
const appendFile = vi.fn();
const deleteFile = vi.fn();
const mkdir = vi.fn();
const rmdir = vi.fn();
const readdir = vi.fn();
const stat = vi.fn();
const rename = vi.fn();
const copy = vi.fn();

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    readFile: (...args: unknown[]) => readFile(...args),
    writeFile: (...args: unknown[]) => writeFile(...args),
    appendFile: (...args: unknown[]) => appendFile(...args),
    deleteFile: (...args: unknown[]) => deleteFile(...args),
    mkdir: (...args: unknown[]) => mkdir(...args),
    rmdir: (...args: unknown[]) => rmdir(...args),
    readdir: (...args: unknown[]) => readdir(...args),
    stat: (...args: unknown[]) => stat(...args),
    rename: (...args: unknown[]) => rename(...args),
    copy: (...args: unknown[]) => copy(...args),
  },
  Directory: {
    Data: "DATA",
    Documents: "DOCUMENTS",
    Library: "LIBRARY",
    Cache: "CACHE",
  },
  Encoding: { UTF8: "utf8", ASCII: "ascii", UTF16: "utf16" },
}));

describe("createRealCapacitorFilesystem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the fixed directory root and translates FsEncoding.UTF8 to the plugin's Encoding.UTF8 on readFile/writeFile", async () => {
    const { createRealCapacitorFilesystem } =
      await import("../../src/lib/models/capacitor-filesystem-real");
    const { FsEncoding } =
      await import("../../src/lib/models/capacitor-filesystem");
    const { Directory, Encoding } = await import("@capacitor/filesystem");

    const realFs = createRealCapacitorFilesystem(Directory.Data);

    readFile.mockResolvedValue({ data: "hello" });
    const readResult = await realFs.readFile({
      path: "a/b.txt",
      encoding: FsEncoding.UTF8,
    });
    expect(readFile).toHaveBeenCalledWith({
      path: "a/b.txt",
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    expect(readResult).toEqual({ data: "hello" });

    writeFile.mockResolvedValue({ uri: "file:///a/b.txt" });
    const writeResult = await realFs.writeFile({
      path: "a/b.txt",
      data: "aGVsbG8=",
      recursive: true,
    });
    expect(writeFile).toHaveBeenCalledWith({
      path: "a/b.txt",
      data: "aGVsbG8=",
      directory: Directory.Data,
      encoding: undefined,
      recursive: true,
    });
    expect(writeResult).toEqual({ uri: "file:///a/b.txt" });
  });

  it("defaults to Directory.Data when no directory is supplied to the factory", async () => {
    const { createRealCapacitorFilesystem } =
      await import("../../src/lib/models/capacitor-filesystem-real");
    const { Directory } = await import("@capacitor/filesystem");

    const realFs = createRealCapacitorFilesystem();
    deleteFile.mockResolvedValue(undefined);
    await realFs.deleteFile({ path: "x.txt" });
    expect(deleteFile).toHaveBeenCalledWith({
      path: "x.txt",
      directory: Directory.Data,
    });
  });

  it("threads the fixed directory root through mkdir/rmdir/appendFile", async () => {
    const { createRealCapacitorFilesystem } =
      await import("../../src/lib/models/capacitor-filesystem-real");
    const { Directory } = await import("@capacitor/filesystem");
    const realFs = createRealCapacitorFilesystem(Directory.Library);

    mkdir.mockResolvedValue(undefined);
    await realFs.mkdir({ path: "d", recursive: true });
    expect(mkdir).toHaveBeenCalledWith({
      path: "d",
      directory: Directory.Library,
      recursive: true,
    });

    rmdir.mockResolvedValue(undefined);
    await realFs.rmdir({ path: "d", recursive: false });
    expect(rmdir).toHaveBeenCalledWith({
      path: "d",
      directory: Directory.Library,
      recursive: false,
    });

    appendFile.mockResolvedValue(undefined);
    await realFs.appendFile({ path: "d/f.txt", data: "abc" });
    expect(appendFile).toHaveBeenCalledWith({
      path: "d/f.txt",
      data: "abc",
      directory: Directory.Library,
      encoding: undefined,
    });
  });

  it("translates the real plugin's richer FileInfo (extra uri/ctime/mtime fields) down to { name, type, size } on readdir", async () => {
    const { createRealCapacitorFilesystem } =
      await import("../../src/lib/models/capacitor-filesystem-real");
    const { Directory } = await import("@capacitor/filesystem");
    const realFs = createRealCapacitorFilesystem(Directory.Data);

    readdir.mockResolvedValue({
      files: [
        {
          name: "a.txt",
          type: "file",
          size: 12,
          uri: "file:///a.txt",
          ctime: 1,
          mtime: 2,
        },
        {
          name: "sub",
          type: "directory",
          size: 0,
          uri: "file:///sub",
          ctime: 1,
          mtime: 2,
        },
      ],
    });

    const result = await realFs.readdir({ path: "." });
    expect(readdir).toHaveBeenCalledWith({
      path: ".",
      directory: Directory.Data,
    });
    expect(result).toEqual({
      files: [
        { name: "a.txt", type: "file", size: 12 },
        { name: "sub", type: "directory", size: 0 },
      ],
    });
  });

  it("translates the real plugin's richer StatResult down to { type, size }", async () => {
    const { createRealCapacitorFilesystem } =
      await import("../../src/lib/models/capacitor-filesystem-real");
    const { Directory } = await import("@capacitor/filesystem");
    const realFs = createRealCapacitorFilesystem(Directory.Data);

    stat.mockResolvedValue({
      type: "file",
      size: 42,
      uri: "file:///a.txt",
      ctime: 1,
      mtime: 2,
    });

    const result = await realFs.stat({ path: "a.txt" });
    expect(stat).toHaveBeenCalledWith({
      path: "a.txt",
      directory: Directory.Data,
    });
    expect(result).toEqual({ type: "file", size: 42 });
  });

  it("threads the fixed directory as both `directory` and `toDirectory` on rename/copy", async () => {
    const { createRealCapacitorFilesystem } =
      await import("../../src/lib/models/capacitor-filesystem-real");
    const { Directory } = await import("@capacitor/filesystem");
    const realFs = createRealCapacitorFilesystem(Directory.Data);

    rename.mockResolvedValue(undefined);
    await realFs.rename({ from: "a", to: "b" });
    expect(rename).toHaveBeenCalledWith({
      from: "a",
      to: "b",
      directory: Directory.Data,
      toDirectory: Directory.Data,
    });

    copy.mockResolvedValue({ uri: "file:///b" });
    await realFs.copy({ from: "a", to: "b" });
    expect(copy).toHaveBeenCalledWith({
      from: "a",
      to: "b",
      directory: Directory.Data,
      toDirectory: Directory.Data,
    });
  });

  it("propagates the real plugin's message-only not-found errors unmodified, preserving capacitorFsAdapter's isNotFound contract", async () => {
    const { createRealCapacitorFilesystem } =
      await import("../../src/lib/models/capacitor-filesystem-real");
    const realFs = createRealCapacitorFilesystem();

    const notFoundError = new Error("File does not exist");
    readFile.mockRejectedValue(notFoundError);

    await expect(realFs.readFile({ path: "missing.txt" })).rejects.toThrow(
      "File does not exist",
    );
    // No `code` field synthesized here -- capacitorFsAdapter.ts is the layer
    // responsible for translating this into a coded ENOENT.
    try {
      await realFs.readFile({ path: "missing.txt" });
      expect.unreachable("expected readFile to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error & { code?: string }).code).toBeUndefined();
    }
  });
});

describe("dynamic-import-only discipline for @capacitor/filesystem", () => {
  const REAL_MODULE_RELATIVE_PATH = path.join(
    "src",
    "lib",
    "models",
    "capacitor-filesystem-real.ts",
  );

  /** Recursively collects every `.ts`/`.tsx` file under `dir`. */
  function collectSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        out.push(...collectSourceFiles(full));
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  it("finds no static top-level import of @capacitor/filesystem outside capacitor-filesystem-real.ts", () => {
    const frontendRoot = path.resolve(__dirname, "..", "..");
    const dirsToScan = ["src", "app"].map((d) => path.join(frontendRoot, d));

    const staticImportRe =
      /^\s*import\s+[^;]*from\s+["']@capacitor\/filesystem["']/m;

    const offenders: string[] = [];
    for (const dir of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      for (const file of collectSourceFiles(dir)) {
        const relative = path.relative(frontendRoot, file);
        if (relative === REAL_MODULE_RELATIVE_PATH) continue;
        const contents = fs.readFileSync(file, "utf8");
        if (staticImportRe.test(contents)) {
          offenders.push(relative);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
