// Last Updated: 2026-03-11

/**
 * @module io
 *
 * Thin indirection layer over filesystem operations used by model modules.
 *
 * This module centralizes all filesystem access behind a replaceable
 * {@link StorageAdapter}. Production code uses Node's `fs/promises` API by
 * default, while tests can inject an in-memory or mocked adapter via
 * {@link setStorageAdapter}.
 *
 * Each wrapper resolves its adapter per-call via `currentAdapter()`, which
 * prefers the ambient {@link StorageContext.adapter} bound by
 * `runInStorageContext` (see `storage-context.ts`), if any request/task
 * scope is currently active, and otherwise falls back to the module-level
 * default/override adapter set via {@link setStorageAdapter}.
 *
 * Primary goals:
 * - Enable deterministic tests by swapping the global storage implementation.
 * - Keep call sites agnostic to concrete I/O APIs.
 * - Provide a small, explicit contract for operations used by the models.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent, Stats } from "node:fs";
import { getStorageContext, runInStorageContext } from "./storage-context";
import { assertWritable } from "./write-barrier";

/**
 * Result type for directory listings.
 *
 * Mirrors Node's `readdir` behavior:
 * - `string[]` when entries are returned as names.
 * - `Dirent[]` when `withFileTypes: true` is used.
 */
export type ReaddirResult = string[] | Dirent[];

/**
 * Abstract contract for storage operations used throughout the models layer.
 *
 * Implementations may target the real filesystem, an in-memory map, or a
 * test-double, as long as they preserve method semantics.
 */
export type StorageAdapter = {
  /**
   * Creates a directory.
   *
   * @param path - Directory path to create.
   * @param opts - Optional creation flags.
   * @param opts.recursive - When `true`, creates parent directories as needed.
   */
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  /**
   * Writes file data to disk.
   *
   * @param path - Target file path.
   * @param data - File contents as text or binary buffer.
   * @param opts - Optional write options accepted by the implementation.
   */
  writeFile(
    path: string,
    data: string | Buffer,
    opts?: string | object,
  ): Promise<void>;
  /**
   * Reads a file as text.
   *
   * @param path - File path to read.
   * @param encoding - Optional text encoding.
   * @returns File contents as a string.
   */
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  /**
   * Reads a file as raw bytes. Binary-safe: implementations must not decode
   * the payload to text. Used for binary assets (e.g. template ZIP packs).
   *
   * @param path - File path to read.
   * @returns File contents as a `Buffer`.
   */
  readFileBuffer(path: string): Promise<Buffer>;
  /**
   * Reads directory entries.
   *
   * @param path - Directory path to read.
   * @param opts - Optional flags controlling entry shape.
   * @param opts.withFileTypes - When `true`, returns `Dirent[]`.
   * @returns Either names (`string[]`) or typed entries (`Dirent[]`).
   */
  readdir(
    path: string,
    opts?: { withFileTypes?: boolean },
  ): Promise<ReaddirResult>;
  /**
   * Retrieves filesystem metadata for a path.
   *
   * @param path - File or directory path.
   * @returns Node `Stats` object for the path.
   */
  stat(path: string): Promise<Stats>;
  /**
   * Removes a file or directory.
   *
   * @param path - Path to remove.
   * @param opts - Optional removal flags.
   * @param opts.recursive - When `true`, removes directories recursively.
   * @param opts.force - When `true`, ignores missing paths.
   */
  rm(
    path: string,
    opts?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  /**
   * Renames or moves a file/directory.
   *
   * @param oldPath - Existing path.
   * @param newPath - New destination path.
   */
  rename(oldPath: string, newPath: string): Promise<void>;
  /**
   * Copies a single file's bytes to a new path. Binary-safe: implementations
   * must preserve raw bytes, not round-trip through a text decode.
   *
   * @param src - Source file path.
   * @param dst - Destination file path.
   */
  copyFile(src: string, dst: string): Promise<void>;
  /**
   * Recursively copies a file or directory tree to a new path. Binary-safe.
   *
   * @param src - Source path.
   * @param dst - Destination path.
   * @param opts - Optional copy flags.
   * @param opts.recursive - When `true`, copies directories recursively.
   */
  cp(src: string, dst: string, opts?: { recursive?: boolean }): Promise<void>;
  /**
   * Appends data to a file, creating it if it does not exist.
   *
   * @param path - Target file path.
   * @param data - Data to append as text or binary.
   */
  appendFile(path: string, data: string | Buffer): Promise<void>;
  /**
   * Flushes file data to disk so it survives sudden shutdown.
   *
   * Real filesystem adapters should open the file, call `fsync`, and close.
   * In-memory or test adapters may treat this as a no-op since their writes
   * have no on-disk durability concern.
   *
   * @param path - Existing file path.
   */
  fsyncFile?(path: string): Promise<void>;
};

/**
 * Active process-wide storage adapter.
 *
 * Defaults to Node's `fs/promises` implementation, but can be overridden via
 * {@link setStorageAdapter} for tests.
 */
let adapter: StorageAdapter = {
  mkdir: async (p, o) => {
    await fs.mkdir(p, o);
  },
  writeFile: (p, d, o) => fs.writeFile(p, d, o as any),
  readFile: (p, e) => fs.readFile(p, e ?? "utf8") as Promise<string>,
  readFileBuffer: (p) => fs.readFile(p) as Promise<Buffer>,
  readdir: (p, o) => fs.readdir(p, o as any) as Promise<ReaddirResult>,
  stat: (p) => fs.stat(p) as Promise<Stats>,
  rm: (p, o) => fs.rm(p, o as any),
  rename: (a, b) => fs.rename(a, b),
  copyFile: (s, d) => fs.copyFile(s, d),
  cp: (s, d, o) => fs.cp(s, d, o as any),
  appendFile: (p, d) => fs.appendFile(p, d),
  fsyncFile: async (p) => {
    const handle = await fs.open(p, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
};

/**
 * Replaces the active process-wide storage adapter.
 *
 * Primarily intended for tests that need to intercept filesystem effects.
 *
 * @param a - New storage adapter implementation to use.
 */
export function setStorageAdapter(a: StorageAdapter) {
  adapter = a;
}

/**
 * Resolves the storage adapter to use for the current call.
 *
 * Prefers the ambient {@link StorageContext.adapter} bound via
 * `runInStorageContext` for the current async execution chain, if any.
 * Falls back to the module-level default/override adapter (see
 * {@link setStorageAdapter}) when no context is active.
 *
 * @returns The {@link StorageAdapter} to use for this call.
 */
function currentAdapter(): StorageAdapter {
  return getStorageContext()?.adapter ?? adapter;
}

/**
 * Resolves the adapter for a *mutating* call, first enforcing any write barrier
 * held on the scope's project.
 *
 * Every write path in the model layer funnels through the wrappers below, so
 * checking here catches all of them by construction rather than by enumerating
 * call sites — see `write-barrier.ts` for why that matters.
 *
 * The wrappers that use this are declared `async` so a refused write surfaces
 * as a rejected promise rather than a synchronous throw — callers that do not
 * `await` immediately would otherwise see an exception escape past their
 * `.catch()`.
 *
 * @returns The {@link StorageAdapter} to use for this call.
 * @throws {ProjectBusyError} When the scope's project is mid-conversion.
 */
function mutatingAdapter(): StorageAdapter {
  assertWritable(getStorageContext()?.projectRoot);
  return currentAdapter();
}

/**
 * Returns the storage adapter that would be used for the current call.
 *
 * Resolves via {@link currentAdapter}: the ambient context adapter (if a
 * `runInStorageContext` scope is active), otherwise the module-level
 * default/override adapter.
 *
 * @returns Active {@link StorageAdapter} instance.
 */
export function getStorageAdapter(): StorageAdapter {
  return currentAdapter();
}

/**
 * Runs `fn` inside a {@link StorageContext} derived from a single project's
 * root directory — the imperative sibling of the route-level
 * `withStorageContext` helper, for non-route entry points (CLI commands,
 * background workers).
 *
 * `tenantRoot` is bound to `path.dirname(projectRoot)` so it matches the value
 * `resolveProjectsDir()` is contracted to return in a request (the *parent*
 * directory that contains project folders), rather than the individual project
 * dir — keeping route and non-route contexts consistent.
 *
 * The adapter defaults to whatever is active at the call site, but callers that
 * schedule deferred work (a queue drain, a debounce timer) should capture the
 * adapter at enqueue time and pass it explicitly, since by drain/fire time no
 * ambient context is active and the default would resolve to the module
 * fallback instead of the enqueuing scope's adapter.
 *
 * @param projectRoot - The project directory being operated on.
 * @param fn - The callback to execute within the derived context.
 * @param adapter - Adapter to bind; defaults to the currently active adapter.
 * @returns Whatever `fn` returns (synchronously or as a `Promise`).
 */
export function runForTenant<T>(
  projectRoot: string,
  fn: () => T,
  adapter: StorageAdapter = currentAdapter(),
): T {
  return runInStorageContext(
    { tenantRoot: path.dirname(projectRoot), adapter },
    fn,
  );
}

/**
 * Creates a directory using the active storage adapter.
 *
 * @param p - Directory path.
 * @param o - Optional creation options.
 * @returns Resolves when the directory operation completes.
 */
export const mkdir = async (p: string, o?: { recursive?: boolean }) =>
  mutatingAdapter().mkdir(p, o);

/**
 * Writes file data using the active storage adapter.
 *
 * @param p - Destination file path.
 * @param d - Data payload as text or binary.
 * @param o - Optional write options.
 * @returns Resolves when the write completes.
 */
export const writeFile = async (
  p: string,
  d: string | Buffer,
  o?: string | object,
) => mutatingAdapter().writeFile(p, d, o);

/**
 * Reads a text file using the active storage adapter.
 *
 * @param p - File path to read.
 * @param e - Optional text encoding.
 * @returns File contents as a string.
 */
export const readFile = (p: string, e?: BufferEncoding) =>
  currentAdapter().readFile(p, e);

/**
 * Reads a file as raw bytes using the active storage adapter (binary-safe).
 *
 * @param p - File path to read.
 * @returns File contents as a `Buffer`.
 */
export const readFileBuffer = (p: string) => currentAdapter().readFileBuffer(p);

/**
 * Reads directory entries using the active storage adapter.
 *
 * Overloaded to mirror `fs.readdir`'s precision: names by default, `Dirent[]`
 * when `withFileTypes` is `true`, so call sites avoid a manual cast.
 *
 * @param p - Directory path.
 * @param o - Optional listing options.
 * @returns Directory entries as `string[]` or `Dirent[]`.
 */
export function readdir(p: string): Promise<string[]>;
export function readdir(
  p: string,
  o: { withFileTypes: true },
): Promise<Dirent[]>;
export function readdir(
  p: string,
  o?: { withFileTypes?: boolean },
): Promise<ReaddirResult>;
export function readdir(
  p: string,
  o?: { withFileTypes?: boolean },
): Promise<ReaddirResult> {
  return currentAdapter().readdir(p, o);
}

/**
 * Reads filesystem metadata for a path.
 *
 * @param p - File or directory path.
 * @returns Node `Stats` for the path.
 */
export const stat = (p: string) => currentAdapter().stat(p);

/**
 * Removes a file or directory using the active storage adapter.
 *
 * @param p - Path to remove.
 * @param o - Optional removal options.
 * @returns Resolves when removal completes.
 */
export const rm = async (
  p: string,
  o?: { recursive?: boolean; force?: boolean },
) => mutatingAdapter().rm(p, o);

/**
 * Renames or moves a file/directory using the active storage adapter.
 *
 * @param a - Existing path.
 * @param b - Destination path.
 * @returns Resolves when rename completes.
 */
export const rename = async (a: string, b: string) =>
  mutatingAdapter().rename(a, b);

/**
 * Copies a single file using the active storage adapter (binary-safe).
 *
 * @param s - Source file path.
 * @param d - Destination file path.
 * @returns Resolves when the copy completes.
 */
export const copyFile = async (s: string, d: string) =>
  mutatingAdapter().copyFile(s, d);

/**
 * Recursively copies a file or directory tree using the active storage
 * adapter (binary-safe).
 *
 * @param s - Source path.
 * @param d - Destination path.
 * @param o - Optional copy flags.
 * @returns Resolves when the copy completes.
 */
export const cp = async (s: string, d: string, o?: { recursive?: boolean }) =>
  mutatingAdapter().cp(s, d, o);

/**
 * Appends data to a file using the active storage adapter, creating it when
 * absent.
 *
 * @param p - Target file path.
 * @param d - Data to append as text or binary.
 * @returns Resolves when the append completes.
 */
export const appendFile = async (p: string, d: string | Buffer) =>
  mutatingAdapter().appendFile(p, d);

/**
 * Reports whether a path exists, using the active storage adapter.
 *
 * Composed from {@link stat} so the contract stays async-only: this is the
 * adapter-backed replacement for a synchronous `fs.existsSync` check.
 *
 * @param p - Path to test.
 * @returns `true` when the path exists, `false` otherwise.
 */
export const exists = async (p: string): Promise<boolean> => {
  try {
    await currentAdapter().stat(p);
    return true;
  } catch {
    return false;
  }
};

/**
 * Flushes file data to disk using the active storage adapter. No-op when the
 * adapter does not implement {@link StorageAdapter.fsyncFile}.
 *
 * @param p - File path to fsync.
 */
export const fsyncFile = async (p: string): Promise<void> => {
  const a = currentAdapter();
  if (a.fsyncFile) await a.fsyncFile(p);
};

/**
 * Options accepted by {@link atomicWriteFile}.
 */
export interface AtomicWriteOptions {
  /**
   * Underlying write options forwarded to the storage adapter's `writeFile`.
   */
  writeOptions?: string | object;
  /**
   * When `true`, fsync the temp file before renaming so data survives a
   * sudden shutdown. Adds latency; intended for index/backlinks meta writes
   * where loss would force an expensive rebuild.
   */
  durable?: boolean;
}

/**
 * Writes file data atomically: writes to `<path>.tmp` then renames into place.
 *
 * On POSIX systems rename is atomic within a filesystem, so a crash between
 * the write and the rename leaves the original file intact rather than
 * producing a partially-written result. When `opts.durable` is true, also
 * fsyncs the temp file before rename so committed data survives a crash.
 *
 * For backwards compatibility, callers may still pass a plain options object
 * — it is forwarded directly to the underlying `writeFile`.
 *
 * @param p - Destination file path.
 * @param data - File contents as text or binary.
 * @param opts - Either underlying write options or {@link AtomicWriteOptions}.
 * @returns Resolves when the rename completes.
 */
export async function atomicWriteFile(
  p: string,
  data: string | Buffer,
  opts?: string | object | AtomicWriteOptions,
): Promise<void> {
  const tmp = `${p}.tmp`;
  const normalized = normalizeAtomicWriteOptions(opts);
  await writeFile(tmp, data, normalized.writeOptions);
  if (normalized.durable) {
    try {
      await fsyncFile(tmp);
    } catch (err) {
      // Best-effort: a missing fsync impl or a permission error must not
      // block the rename, since the atomic guarantee still holds without it.
      console.warn("[io] fsync before rename failed:", err);
    }
  }
  await rename(tmp, p);
}

function normalizeAtomicWriteOptions(
  opts?: string | object | AtomicWriteOptions,
): { writeOptions?: string | object; durable: boolean } {
  if (opts == null) return { writeOptions: undefined, durable: false };
  if (typeof opts === "string") return { writeOptions: opts, durable: false };
  const typed = opts as AtomicWriteOptions;
  if ("durable" in typed || "writeOptions" in typed) {
    return {
      writeOptions: typed.writeOptions,
      durable: typed.durable === true,
    };
  }
  return { writeOptions: opts, durable: false };
}

export default { setStorageAdapter, getStorageAdapter };
