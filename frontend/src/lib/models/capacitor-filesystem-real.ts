// Last Updated: 2026-07-25

/**
 * @module capacitor-filesystem-real
 *
 * **ADR-021 Phase 0.** The real, on-device counterpart to the spike's
 * in-memory fake (`capacitor-filesystem.ts`): a factory that wraps the actual
 * `@capacitor/filesystem` plugin behind the same {@link CapacitorFilesystemLike}
 * contract the fake models, so `capacitorFsAdapter` works unmodified against
 * either.
 *
 * **This module is native-only and must never be statically imported** from
 * anything reachable by the web/hosted/desktop client bundle. It has a
 * top-level `import` of `@capacitor/filesystem` — the one place in the tree
 * that import is allowed — and callers must reach it exclusively via a
 * dynamic `import()` gated behind `resolveRuntime() === "native"`, mirroring
 * `store/transport/search-transport.ts`. See
 * `tests/unit/capacitor-filesystem-real.test.ts` for the regression guard
 * that scans the tree for stray static imports of `@capacitor/filesystem`.
 *
 * Two gaps this module closes relative to the fake:
 *
 * - **The `directory: Directory` root.** The fake fixes a single (implicit)
 *   root and omits the parameter entirely, per its own doc comment. The real
 *   plugin requires a `Directory` on every call to pick an OS-level storage
 *   root. This factory closes over one fixed `Directory` (default
 *   `Directory.Data`, Android app-private scoped storage) and threads it
 *   through every call, so the outward-facing shape stays directory-less,
 *   matching {@link CapacitorFilesystemLike} exactly.
 * - **Richer result shapes.** The real plugin's `FileInfo`/`StatResult` also
 *   carry `uri`, `ctime`, and `mtime`. Those fields are dropped here since
 *   {@link CapacitorFilesystemLike} only models `name`/`type`/`size`.
 *
 * Error handling is intentionally a pass-through: the real plugin already
 * throws message-only `Error`s with no `code` field for not-found and other
 * failure conditions — the exact contract `capacitorFsAdapter.ts`'s
 * `isNotFound` (matching `/does not exist/i`) already expects. This module
 * does not re-translate or swallow errors beyond what's needed to satisfy the
 * method signatures.
 */
import {
  Filesystem,
  Directory,
  Encoding as CapacitorEncoding,
} from "@capacitor/filesystem";
import {
  FsEncoding,
  type CapacitorFilesystemLike,
  type FileInfo,
  type StatResult,
} from "./capacitor-filesystem";

/** Translates the spike's encoding sentinel to the real plugin's `Encoding`. */
function toPluginEncoding(
  encoding: FsEncoding | undefined,
): CapacitorEncoding | undefined {
  return encoding === FsEncoding.UTF8 ? CapacitorEncoding.UTF8 : undefined;
}

/**
 * Creates a {@link CapacitorFilesystemLike} backed by the real
 * `@capacitor/filesystem` plugin, fixed to a single `Directory` root.
 *
 * @param directory - The OS-level storage root every call is scoped to.
 *   Defaults to `Directory.Data`, the app-private root appropriate for
 *   GetWrite's on-device project store under Android scoped storage.
 */
export function createRealCapacitorFilesystem(
  directory: Directory = Directory.Data,
): CapacitorFilesystemLike {
  return {
    readFile: async ({ path, encoding }) => {
      const { data } = await Filesystem.readFile({
        path,
        directory,
        encoding: toPluginEncoding(encoding),
      });
      // The real plugin's ReadFileResult.data is typed `string`, but on some
      // platforms may resolve to a Blob in web contexts; on-device (Android)
      // it is always a string, which is all CapacitorFilesystemLike models.
      return { data: data as string };
    },

    writeFile: async ({ path, data, encoding, recursive }) => {
      const { uri } = await Filesystem.writeFile({
        path,
        data,
        directory,
        encoding: toPluginEncoding(encoding),
        recursive,
      });
      return { uri };
    },

    appendFile: async ({ path, data, encoding }) => {
      await Filesystem.appendFile({
        path,
        data,
        directory,
        encoding: toPluginEncoding(encoding),
      });
    },

    deleteFile: async ({ path }) => {
      await Filesystem.deleteFile({ path, directory });
    },

    mkdir: async ({ path, recursive }) => {
      await Filesystem.mkdir({ path, directory, recursive });
    },

    rmdir: async ({ path, recursive }) => {
      await Filesystem.rmdir({ path, directory, recursive });
    },

    readdir: async ({ path }) => {
      const { files } = await Filesystem.readdir({ path, directory });
      const mapped: FileInfo[] = files.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      }));
      return { files: mapped };
    },

    stat: async ({ path }) => {
      const res = await Filesystem.stat({ path, directory });
      const mapped: StatResult = { type: res.type, size: res.size };
      return mapped;
    },

    rename: async ({ from, to }) => {
      await Filesystem.rename({ from, to, directory, toDirectory: directory });
    },

    copy: async ({ from, to }) => {
      await Filesystem.copy({ from, to, directory, toDirectory: directory });
    },
  };
}
