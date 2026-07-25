import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import type { Dirent } from "node:fs";

/**
 * A factory that produces a fresh {@link StorageAdapter} plus an optional
 * cleanup hook (e.g. to remove a temp directory for filesystem-backed stores).
 */
export interface AdapterFixture {
  adapter: StorageAdapter;
  cleanup?: () => Promise<void>;
}

/**
 * Shared conformance suite for every {@link StorageAdapter} implementation.
 *
 * It drives the adapter through the `io.ts` wrappers — exactly how model code
 * uses it — and asserts only the behaviors the model layer actually relies on
 * (not incidental strictness like "writeFile throws when the parent dir is
 * missing", which no caller depends on and which the object store does not
 * enforce). Passing this suite against the default fs adapter, the object store
 * over an in-memory store, and the object store over a filesystem store is the
 * proof that injecting an alternate backend is transparent to the model layer.
 *
 * @param label - Human-readable adapter name for the describe block.
 * @param makeFixture - Produces a fresh adapter (+ cleanup) per test.
 */
export function runStorageAdapterConformance(
  label: string,
  makeFixture: () => Promise<AdapterFixture>,
) {
  describe(`StorageAdapter conformance: ${label}`, () => {
    const original = io.getStorageAdapter();
    let cleanup: (() => Promise<void>) | undefined;

    beforeEach(async () => {
      const fixture = await makeFixture();
      cleanup = fixture.cleanup;
      io.setStorageAdapter(fixture.adapter);
    });

    afterEach(async () => {
      io.setStorageAdapter(original);
      await cleanup?.();
      cleanup = undefined;
    });

    it("round-trips text through writeFile/readFile", async () => {
      await io.mkdir("/proj", { recursive: true });
      await io.writeFile("/proj/note.txt", "hello world");
      expect(await io.readFile("/proj/note.txt", "utf8")).toBe("hello world");
    });

    it("round-trips binary through writeFile/readFileBuffer", async () => {
      await io.mkdir("/proj", { recursive: true });
      const bytes = Buffer.from([0x00, 0x01, 0x89, 0x50, 0xff]);
      await io.writeFile("/proj/asset.bin", bytes);
      const read = await io.readFileBuffer("/proj/asset.bin");
      expect(read.equals(bytes)).toBe(true);
    });

    it("readFile on a missing path throws ENOENT", async () => {
      await expect(
        io.readFile("/proj/ghost.txt", "utf8"),
      ).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("exists reflects presence for files and directories", async () => {
      await io.mkdir("/proj/dir", { recursive: true });
      await io.writeFile("/proj/dir/f.txt", "x");
      expect(await io.exists("/proj/dir")).toBe(true);
      expect(await io.exists("/proj/dir/f.txt")).toBe(true);
      expect(await io.exists("/proj/dir/missing")).toBe(false);
    });

    it("an empty mkdir'd directory is visible and lists no children", async () => {
      await io.mkdir("/proj/empty", { recursive: true });
      expect((await io.stat("/proj/empty")).isDirectory()).toBe(true);
      expect(await io.readdir("/proj/empty")).toEqual([]);
    });

    it("readdir returns immediate child names, and Dirent types on request", async () => {
      await io.mkdir("/proj", { recursive: true });
      await io.writeFile("/proj/file.txt", "x");
      await io.mkdir("/proj/sub", { recursive: true });
      await io.writeFile("/proj/sub/deep.txt", "y");

      const names = await io.readdir("/proj");
      expect(names.sort()).toEqual(["file.txt", "sub"]);

      const typed = (await io.readdir("/proj", {
        withFileTypes: true,
      })) as Dirent[];
      const byName = Object.fromEntries(typed.map((d) => [d.name, d]));
      expect(byName["file.txt"].isDirectory()).toBe(false);
      expect(byName["sub"].isDirectory()).toBe(true);
    });

    it("rm removes a directory subtree recursively", async () => {
      await io.mkdir("/proj/dir/sub", { recursive: true });
      await io.writeFile("/proj/dir/a.txt", "a");
      await io.writeFile("/proj/dir/sub/b.txt", "b");
      await io.rm("/proj/dir", { recursive: true, force: true });
      expect(await io.exists("/proj/dir")).toBe(false);
    });

    it("atomicWriteFile writes the final path and leaves no temp behind", async () => {
      await io.mkdir("/proj", { recursive: true });
      await io.atomicWriteFile("/proj/data.json", "committed");
      expect(await io.readFile("/proj/data.json", "utf8")).toBe("committed");
      expect(await io.exists("/proj/data.json.tmp")).toBe(false);
    });

    it("atomicWriteFile overwrites an existing file", async () => {
      await io.mkdir("/proj", { recursive: true });
      await io.writeFile("/proj/data.json", "old");
      await io.atomicWriteFile("/proj/data.json", "new");
      expect(await io.readFile("/proj/data.json", "utf8")).toBe("new");
    });

    it("copyFile duplicates bytes without aliasing the source", async () => {
      await io.mkdir("/proj", { recursive: true });
      await io.writeFile("/proj/src.bin", Buffer.from([1, 2, 3]));
      await io.copyFile("/proj/src.bin", "/proj/dst.bin");
      await io.writeFile("/proj/src.bin", Buffer.from([9]));
      expect((await io.readFileBuffer("/proj/dst.bin")).length).toBe(3);
    });

    it("cp recursively copies a directory subtree", async () => {
      await io.mkdir("/proj/src/nested", { recursive: true });
      await io.writeFile("/proj/src/nested/a.txt", "alpha");
      await io.cp("/proj/src", "/proj/dst", { recursive: true });
      expect(await io.readFile("/proj/dst/nested/a.txt", "utf8")).toBe("alpha");
    });

    it("appendFile creates then extends a file", async () => {
      await io.mkdir("/proj", { recursive: true });
      await io.appendFile("/proj/log.txt", "one");
      await io.appendFile("/proj/log.txt", "two");
      expect(await io.readFile("/proj/log.txt", "utf8")).toBe("onetwo");
    });

    it("file rename moves and overwrites", async () => {
      await io.mkdir("/proj", { recursive: true });
      await io.writeFile("/proj/a", "value");
      await io.rename("/proj/a", "/proj/b");
      expect(await io.readFile("/proj/b", "utf8")).toBe("value");
      expect(await io.exists("/proj/a")).toBe(false);
    });

    it("directory rename moves a subtree to a fresh destination", async () => {
      await io.mkdir("/proj/tmp-dir/nested", { recursive: true });
      await io.writeFile("/proj/tmp-dir/v.txt", "content");
      await io.writeFile("/proj/tmp-dir/nested/deep.txt", "deep");
      await io.rename("/proj/tmp-dir", "/proj/final");
      expect(await io.readFile("/proj/final/v.txt", "utf8")).toBe("content");
      expect(await io.readFile("/proj/final/nested/deep.txt", "utf8")).toBe(
        "deep",
      );
      expect(await io.exists("/proj/tmp-dir")).toBe(false);
    });

    // Note: the stronger "directory rename fails if the destination already
    // exists" guarantee is NOT asserted cross-adapter here, because the backends
    // genuinely diverge — the reference in-memory fs-tree (memoryAdapter)
    // permissively overwrites, whereas the Capacitor fake now throws to match
    // the real @capacitor/filesystem plugin's on-device behavior (ADR-021 Phase
    // 0 gate). The model layer self-guards the case regardless (revision.ts stat
    // pre-check), and the object store's fail-if-exists behavior is covered in
    // its own test.
  });
}
