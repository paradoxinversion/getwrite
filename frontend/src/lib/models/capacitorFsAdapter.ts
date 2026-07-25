// Last Updated: 2026-07-24

/**
 * @module capacitorFsAdapter
 *
 * **SPIKE (ADR-021).** A {@link StorageAdapter} over a
 * {@link CapacitorFilesystemLike} plugin — the bridge that would let GetWrite's
 * model layer run in a Capacitor WebView on Android with **no server and no
 * Node process**, reading and writing the device filesystem directly.
 *
 * Capacitor's Filesystem is genuinely hierarchical (real directories, typed
 * `stat`/`readdir`), so this bridge is far thinner than `objectStoreAdapter` —
 * there are no directory markers, no prefix-list emulation, and no rename
 * synthesis. The three real gaps the bridge absorbs, all surfaced by the spike:
 *
 * 1. **Error translation.** The plugin throws message-only `Error`s with no
 *    `code`. The model layer branches on `err.code === "ENOENT"` (e.g.
 *    `io.exists`, `deleteQuery`, revision guards), so every "not found" from the
 *    plugin is re-thrown as an `ENOENT`-coded error. This is the load-bearing
 *    line of the whole bridge.
 * 2. **Base64 boundary.** The plugin marshals bytes as strings across the
 *    WebView bridge. Binary reads/writes go through base64; text uses
 *    `Encoding.UTF8`. `readFileBuffer` therefore reads base64 and decodes.
 * 3. **File-vs-dir op split.** `rm` maps to `deleteFile` or `rmdir`, and
 *    `stat`/`readdir` distinguish kinds via the plugin's `type` field rather
 *    than `Stats.isDirectory()`.
 */
import path from "node:path";
import type { Dirent, Stats } from "node:fs";
import type { ReaddirResult, StorageAdapter } from "./io";
import type { CapacitorFilesystemLike } from "./capacitor-filesystem";

/** Builds a coded error matching the `node:fs` / model-layer convention. */
function coded(code: string, message: string): Error {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

/**
 * Detects the plugin's "not found" failure. The real plugin has no `err.code`,
 * so we match on the message it throws ("File does not exist"). Kept in one
 * place so tightening the match later (or reading a future `code`) is a
 * one-line change.
 */
function isNotFound(err: unknown): boolean {
  if (err && typeof err === "object") {
    // A Node-style ENOENT wins outright. But the real plugin wraps failures in a
    // CapacitorException that carries a *Capacitor* `code` (not a Node one), so
    // we must NOT short-circuit to false just because some `code` is present —
    // fall through to the message match instead.
    if ((err as { code?: string }).code === "ENOENT") return true;
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return /does not exist/i.test(message);
  }
  return false;
}

/**
 * Detects the plugin's "already exists" failure from `mkdir`. Node's
 * `fs.mkdir(recursive: true)` is idempotent — it never throws when the target
 * already exists — and the model layer relies on that. The real Capacitor
 * plugin instead throws (message "Directory exists" on Android; "already
 * exists" on other platforms) even with `recursive: true`, so the adapter must
 * absorb it to preserve Node semantics. Excludes the "does not exist" message
 * so a not-found is never misread as an already-exists. (The in-memory fake
 * never throws here, so this branch is device-only and the conformance suite is
 * unaffected.)
 */
function isAlreadyExists(err: unknown): boolean {
  if (err && typeof err === "object") {
    // As in isNotFound: honor a Node EEXIST, but don't let the plugin's
    // Capacitor `code` short-circuit the message match. Exclude "does not
    // exist" so a not-found is never misread as an already-exists.
    if ((err as { code?: string }).code === "EEXIST") return true;
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") {
      return /exist/i.test(message) && !/not\s+exist/i.test(message);
    }
  }
  return false;
}

/** Runs a plugin call, re-throwing its "not found" as a coded `ENOENT`. */
async function asEnoent<T>(
  displayPath: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isNotFound(err)) {
      throw coded("ENOENT", `no such file or directory, '${displayPath}'`);
    }
    throw err;
  }
}

/** POSIX-normalizes a path and strips the leading slash for the plugin. */
function toPluginPath(p: string): string {
  return path.posix.normalize(p).replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Coerces a string/Buffer write payload to a `Buffer` (utf8 for strings). */
function toBuffer(data: string | Buffer): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
}

/**
 * Creates a {@link StorageAdapter} backed by a {@link CapacitorFilesystemLike}
 * plugin (real on-device, or the in-memory fake in the spike gate).
 *
 * @param fs - The Capacitor Filesystem plugin (or a faithful fake).
 * @returns A storage adapter honoring the model layer's filesystem contract.
 */
export function capacitorFsAdapter(
  fs: CapacitorFilesystemLike,
): StorageAdapter {
  return {
    mkdir: async (p, opts) => {
      try {
        await fs.mkdir({ path: toPluginPath(p), recursive: opts?.recursive });
      } catch (err) {
        // Match Node's idempotent `mkdir(recursive: true)`: swallow the real
        // plugin's "already exists" throw. Non-recursive mkdir keeps throwing,
        // as `node:fs` does. See isAlreadyExists.
        if (opts?.recursive && isAlreadyExists(err)) return;
        throw err;
      }
    },

    writeFile: async (p, data) => {
      // All writes go through base64 so a single path handles text and binary
      // identically; readFile/readFileBuffer pick their own encoding on the way
      // out. This keeps the atomicWriteFile temp-file dance encoding-agnostic.
      await fs.writeFile({
        path: toPluginPath(p),
        data: toBuffer(data).toString("base64"),
        recursive: true,
      });
    },

    readFile: async (p, encoding) => {
      const { data } = await asEnoent(p, () =>
        fs.readFile({ path: toPluginPath(p) }),
      );
      return Buffer.from(data, "base64").toString(encoding ?? "utf8");
    },

    readFileBuffer: async (p) => {
      const { data } = await asEnoent(p, () =>
        fs.readFile({ path: toPluginPath(p) }),
      );
      return Buffer.from(data, "base64");
    },

    readdir: async (
      p,
      opts?: { withFileTypes?: boolean },
    ): Promise<ReaddirResult> => {
      const { files } = await asEnoent(p, () =>
        fs.readdir({ path: toPluginPath(p) }),
      );
      if (!opts?.withFileTypes) return files.map((f) => f.name);
      return files.map(
        (f) =>
          ({
            name: f.name,
            isDirectory: () => f.type === "directory",
            isFile: () => f.type === "file",
          }) as unknown as Dirent,
      );
    },

    stat: async (p) => {
      const res = await asEnoent(p, () => fs.stat({ path: toPluginPath(p) }));
      return {
        isDirectory: () => res.type === "directory",
        isFile: () => res.type === "file",
        size: res.size,
      } as unknown as Stats;
    },

    rm: async (p, opts) => {
      const pluginPath = toPluginPath(p);
      // The model layer calls rm on both files and directories; the plugin
      // splits these. Probe kind via stat, tolerating a missing path per opts.force.
      let type: "file" | "directory";
      try {
        type = (await fs.stat({ path: pluginPath })).type;
      } catch (err) {
        if (isNotFound(err)) {
          if (opts?.force) return;
          throw coded("ENOENT", `no such file or directory, '${p}'`);
        }
        throw err;
      }
      if (type === "file") {
        await fs.deleteFile({ path: pluginPath });
      } else {
        await fs.rmdir({ path: pluginPath, recursive: opts?.recursive });
      }
    },

    rename: async (oldPath, newPath) => {
      await asEnoent(oldPath, () =>
        fs.rename({ from: toPluginPath(oldPath), to: toPluginPath(newPath) }),
      );
    },

    copyFile: async (src, dst) => {
      await asEnoent(src, () =>
        fs.copy({ from: toPluginPath(src), to: toPluginPath(dst) }),
      );
    },

    cp: async (src, dst) => {
      await asEnoent(src, () =>
        fs.copy({ from: toPluginPath(src), to: toPluginPath(dst) }),
      );
    },

    appendFile: async (p, data) => {
      // The plugin's appendFile takes base64 without an encoding, same as write.
      await fs.appendFile({
        path: toPluginPath(p),
        data: toBuffer(data).toString("base64"),
      });
    },

    // fsyncFile intentionally omitted: the WebView/plugin boundary exposes no
    // client-side durability flush, and io.ts no-ops when it is absent — the
    // same stance objectStoreAdapter takes.
  };
}
