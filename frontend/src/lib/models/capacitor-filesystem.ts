// Last Updated: 2026-07-24

/**
 * @module capacitor-filesystem
 *
 * **SPIKE (ADR-021).** Models the subset of Capacitor's `@capacitor/filesystem`
 * plugin API that a {@link StorageAdapter} needs, plus a dependency-free
 * in-memory fake of it. This is the object-store spike's playbook (ADR-019)
 * applied to a device filesystem: define the backend's contract, fake it
 * faithfully, and prove the bridge against the shared conformance suite in the
 * normal Vitest gate — no device, no `@capacitor/*` dependency yet.
 *
 * The fake deliberately reproduces the plugin's real-world quirks, because
 * those are exactly what the bridge (`capacitorFsAdapter`) must absorb:
 *
 * - **Base64 payloads.** With no `encoding`, `readFile`/`writeFile` carry
 *   binary as base64 strings; with `Encoding.UTF8`, they carry text. There is
 *   no `Buffer` in the plugin API — the WebView boundary is strings only.
 * - **`FileInfo` / `StatResult` shapes.** `readdir` returns `{ files: [...] }`
 *   with a `type: 'file' | 'directory'` discriminator; `stat` returns a
 *   `type`. The plugin is genuinely hierarchical, unlike an object store.
 * - **Non-`err.code` errors.** The plugin throws plain `Error`s with
 *   human-readable messages ("File does not exist") and **no `code` property**.
 *   The model layer keys on `err.code === "ENOENT"`, so the bridge must
 *   translate — this is the single sharpest gap the spike exists to surface.
 */

/** Text encoding sentinel, mirroring `@capacitor/filesystem`'s `Encoding`. */
export enum FsEncoding {
  UTF8 = "utf8",
}

/** Entry kind discriminator used by `readdir`/`stat`, as the plugin reports it. */
export type FileType = "file" | "directory";

/** One `readdir` entry, matching the plugin's `FileInfo`. */
export interface FileInfo {
  name: string;
  type: FileType;
  size: number;
}

/** Result of `stat`, matching the plugin's `StatResult`. */
export interface StatResult {
  type: FileType;
  size: number;
}

/**
 * The slice of `@capacitor/filesystem`'s `Filesystem` plugin the adapter uses.
 * Method shapes and option names mirror the real plugin so the eventual swap to
 * the on-device plugin is a drop-in, not a rewrite. (The real plugin also takes
 * a `directory: Directory` root; the spike fixes a single root, so it is
 * omitted here and reintroduced when the real dependency lands.)
 */
export interface CapacitorFilesystemLike {
  readFile(opts: {
    path: string;
    encoding?: FsEncoding;
  }): Promise<{ data: string }>;
  writeFile(opts: {
    path: string;
    data: string;
    encoding?: FsEncoding;
    recursive?: boolean;
  }): Promise<{ uri: string }>;
  appendFile(opts: {
    path: string;
    data: string;
    encoding?: FsEncoding;
  }): Promise<void>;
  deleteFile(opts: { path: string }): Promise<void>;
  mkdir(opts: { path: string; recursive?: boolean }): Promise<void>;
  rmdir(opts: { path: string; recursive?: boolean }): Promise<void>;
  readdir(opts: { path: string }): Promise<{ files: FileInfo[] }>;
  stat(opts: { path: string }): Promise<StatResult>;
  rename(opts: { from: string; to: string }): Promise<void>;
  copy(opts: { from: string; to: string }): Promise<void>;
}

/** The plugin's "not found" error: a plain message with no `code` field. */
function notFound(path: string): Error {
  return new Error(`File does not exist: ${path}`);
}

/**
 * The plugin's "already exists" error, mirroring the real message observed on a
 * physical device (ADR-021 Phase 0 gate). Like {@link notFound}, it is a plain
 * message with no `code` field — the exact shape `capacitorFsAdapter`'s
 * `isAlreadyExists` must classify by message. Modeling this (rather than the
 * silent idempotency the fake originally had) is what makes the conformance
 * fake faithful to the real plugin, so the divergence the device surfaced can't
 * regress unseen.
 */
function alreadyExists(path: string): Error {
  return new Error(
    `Directory at '${path}' already exists, cannot be overwritten.`,
  );
}

/** Normalizes a plugin path to a canonical key (no leading/trailing slashes). */
function norm(p: string): string {
  return p.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Immediate-parent key of a normalized path (`""` for a top-level entry). */
function parentOf(key: string): string {
  const i = key.lastIndexOf("/");
  return i === -1 ? "" : key.slice(0, i);
}

/**
 * Creates an in-memory fake of {@link CapacitorFilesystemLike} that reproduces
 * the plugin's contract (base64 boundary, hierarchical dirs, message-only
 * errors). Files are stored as raw `Buffer`s internally; the base64/utf8
 * conversion happens only at the API boundary, exactly as the native plugin
 * marshals across the WebView bridge.
 */
export function createFakeCapacitorFilesystem(): CapacitorFilesystemLike {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>([""]); // root always exists

  const isDir = (key: string) => dirs.has(key);
  const isFile = (key: string) => files.has(key);

  const encode = (buf: Buffer, encoding?: FsEncoding): string =>
    encoding === FsEncoding.UTF8
      ? buf.toString("utf8")
      : buf.toString("base64");
  const decode = (data: string, encoding?: FsEncoding): Buffer =>
    Buffer.from(data, encoding === FsEncoding.UTF8 ? "utf8" : "base64");

  return {
    readFile: async ({ path, encoding }) => {
      const key = norm(path);
      const buf = files.get(key);
      if (!buf) throw notFound(path);
      return { data: encode(buf, encoding) };
    },

    writeFile: async ({ path, data, encoding, recursive }) => {
      const key = norm(path);
      if (isDir(key)) throw new Error(`Cannot write to a directory: ${path}`);
      const parent = parentOf(key);
      if (parent !== "" && !isDir(parent)) {
        if (!recursive)
          throw new Error(`Parent directory does not exist: ${path}`);
        // Recursive create of ancestor chain, matching the plugin's option.
        const segs = parent.split("/");
        let acc = "";
        for (const s of segs) {
          acc = acc ? `${acc}/${s}` : s;
          dirs.add(acc);
        }
      }
      files.set(key, decode(data, encoding));
      return { uri: `mem://${key}` };
    },

    appendFile: async ({ path, data, encoding }) => {
      const key = norm(path);
      const existing = files.get(key) ?? Buffer.alloc(0);
      files.set(key, Buffer.concat([existing, decode(data, encoding)]));
    },

    deleteFile: async ({ path }) => {
      const key = norm(path);
      if (!files.delete(key)) throw notFound(path);
    },

    mkdir: async ({ path, recursive }) => {
      const key = norm(path);
      // The real plugin throws if the target already exists, even with
      // `recursive: true` (confirmed on-device) — unlike Node's idempotent
      // fs.mkdir. capacitorFsAdapter absorbs this for recursive calls to
      // restore Node semantics, so faithfully throwing here is what exercises
      // that adapter branch.
      if (isDir(key) || isFile(key)) throw alreadyExists(path);
      const parent = parentOf(key);
      if (parent !== "" && !isDir(parent) && !recursive) {
        throw new Error(`Parent directory does not exist: ${path}`);
      }
      if (recursive) {
        const segs = key.split("/");
        let acc = "";
        for (const s of segs) {
          acc = acc ? `${acc}/${s}` : s;
          dirs.add(acc);
        }
      } else {
        dirs.add(key);
      }
    },

    rmdir: async ({ path, recursive }) => {
      const key = norm(path);
      if (!isDir(key)) throw notFound(path);
      const prefix = `${key}/`;
      const children = [
        ...[...files.keys()].filter((k) => k.startsWith(prefix)),
        ...[...dirs].filter((k) => k !== key && k.startsWith(prefix)),
      ];
      if (children.length > 0 && !recursive) {
        throw new Error(`Directory not empty: ${path}`);
      }
      for (const k of [...files.keys()])
        if (k === key || k.startsWith(prefix)) files.delete(k);
      for (const k of [...dirs])
        if (k === key || k.startsWith(prefix)) dirs.delete(k);
    },

    readdir: async ({ path }) => {
      const key = norm(path);
      if (isFile(key)) throw new Error(`Not a directory: ${path}`);
      if (!isDir(key)) throw notFound(path);
      const prefix = key === "" ? "" : `${key}/`;
      const names = new Set<string>();
      const collect = (k: string) => {
        if (!k.startsWith(prefix) || k === key) return;
        const rest = k.slice(prefix.length);
        if (rest === "" || rest.includes("/")) {
          if (rest.includes("/")) names.add(rest.split("/")[0]);
          return;
        }
        names.add(rest);
      };
      files.forEach((_, k) => collect(k));
      dirs.forEach((k) => collect(k));
      const entries: FileInfo[] = [...names].map((name) => {
        const childKey = prefix + name;
        return {
          name,
          type: isDir(childKey) ? "directory" : "file",
          size: files.get(childKey)?.length ?? 0,
        };
      });
      return { files: entries };
    },

    stat: async ({ path }) => {
      const key = norm(path);
      if (isFile(key)) return { type: "file", size: files.get(key)!.length };
      if (isDir(key)) return { type: "directory", size: 0 };
      throw notFound(path);
    },

    rename: async ({ from, to }) => {
      const src = norm(from);
      const dst = norm(to);
      if (isFile(src)) {
        files.set(dst, files.get(src)!); // overwrites, matching the reference fs adapter
        files.delete(src);
        dirs.delete(dst);
        return;
      }
      if (isDir(src)) {
        // The real plugin throws when renaming a directory onto an existing
        // destination (confirmed on-device) rather than merging — the exact
        // behavior revision.ts's writeRevision temp-dir -> v-<N> rename relies
        // on. (writeRevision never actually collides, since version numbers are
        // fresh under the per-resource lock.) File rename is left overwriting,
        // as atomicWriteFile depends on it and the device gate did not test it.
        if (isDir(dst) || isFile(dst)) throw alreadyExists(to);
        const prefix = `${src}/`;
        for (const k of [...files.keys()]) {
          if (k === src || k.startsWith(prefix)) {
            files.set(dst + k.slice(src.length), files.get(k)!);
            files.delete(k);
          }
        }
        for (const k of [...dirs]) {
          if (k === src || k.startsWith(prefix)) {
            dirs.add(dst + k.slice(src.length));
            dirs.delete(k);
          }
        }
        return;
      }
      throw notFound(from);
    },

    copy: async ({ from, to }) => {
      const src = norm(from);
      const dst = norm(to);
      if (isFile(src)) {
        files.set(dst, Buffer.from(files.get(src)!)); // fresh buffer — no aliasing
        return;
      }
      if (isDir(src)) {
        const prefix = `${src}/`;
        dirs.add(dst);
        for (const k of [...dirs]) {
          if (k.startsWith(prefix)) dirs.add(dst + k.slice(src.length));
        }
        for (const k of [...files.keys()]) {
          if (k.startsWith(prefix))
            files.set(dst + k.slice(src.length), Buffer.from(files.get(k)!));
        }
        return;
      }
      throw notFound(from);
    },
  };
}
