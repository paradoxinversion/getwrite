// Last Updated: 2026-07-27

/**
 * @module store/transport/native-runner
 *
 * **ADR-021 Phase 2 cleanup.** Every `native-*-backend.ts` used to duplicate an
 * identical ~35-line `run<T>` helper (plus a `nativeFilesystem()` helper, a
 * per-backend `NativeXDeps` interface, and a `projectsDir` default) verbatim.
 * This module is the single source of truth for how a native transport backend
 * binds/awaits the storage context before invoking its lifted core.
 *
 * Native-only: reached only through the `native-*-backend.ts` modules, each of
 * which is excluded from the web bundle via `next.config.mjs`'s
 * `turbopack.resolveAlias` web-stub, so this module never enters the
 * hosted/desktop build.
 */
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import { runInStorageContext } from "../../lib/models/storage-context";
import { ensureNativeStorageContext } from "../../lib/models/native-bootstrap";

/** Injectable deps for a native backend — omitted in production, supplied by tests. */
export interface NativeBackendDeps {
  /** The device filesystem. Production: the real `@capacitor/filesystem` plugin. */
  fs?: CapacitorFilesystemLike;
  /** On-device projects root (the native analogue of `GETWRITE_PROJECTS_DIR`). */
  projectsDir?: string;
}

/** The `run<T>` helper each native backend wraps its operations in. */
export type NativeRunner = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Builds the shared `run<T>` helper a native transport backend wraps every
 * operation in.
 *
 * - **`deps.fs` (tests):** binds a fresh, one-off {@link runInStorageContext}
 *   scope over the injected fake, so a backend can be exercised standalone with
 *   no global native bootstrap having run.
 * - **production:** awaits the memoized native bootstrap
 *   ({@link ensureNativeStorageContext} — context bound + projects dir created),
 *   then resolves directly against the ambient default {@link StorageContext}.
 *   No per-operation re-binding, and no defensive one-off fallback: once the
 *   awaited bootstrap settles, the default context is always installed.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeRunner(deps: NativeBackendDeps = {}): NativeRunner {
  const projectsDir = deps.projectsDir ?? "/projects";
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (deps.fs) {
      const adapter = capacitorFsAdapter(deps.fs);
      return runInStorageContext({ tenantRoot: projectsDir, adapter }, fn);
    }
    await ensureNativeStorageContext();
    return fn();
  };
}
