// Last Updated: 2026-07-25

/**
 * @module native-bootstrap
 *
 * **ADR-021 Phase 0 (Task 4).** The native (Capacitor Android) app-startup
 * entry point: resolves the on-device, app-private projects directory (FR4)
 * and installs it — bundled with the real Capacitor filesystem adapter — as
 * the process-wide *default* {@link StorageContext} (FR5), via
 * {@link setDefaultStorageContext}.
 *
 * `Directory.Data` (resolved through `Filesystem.getUri`) is the plugin's
 * app-private storage root — the directory Android scoped storage guarantees
 * is private to this app and never requires runtime storage permissions,
 * which is exactly what FR4 requires ("no reliance on paths outside the
 * app's private storage"). Nothing here ever resolves a path outside it.
 *
 * Once {@link bootstrapNativeStorageContext} has run, every subsequent
 * `io.ts`/`projects-dir.ts` call anywhere in the app — including
 * fire-and-forget indexer/backlinks-watcher work with no explicit
 * `runInStorageContext` scope of its own — transparently resolves against
 * this default via `getStorageContext()`'s fallback (`storage-context.ts`),
 * with no per-operation rebinding (FR5). `native-search-backend.ts`'s
 * production search path (no `deps.fs` supplied) is the first consumer of
 * this: it no longer binds a fresh context per search call, relying on the
 * ambient default installed here instead.
 *
 * **Native-only.** This module has a dynamic `import("@capacitor/filesystem")`
 * (mirroring `capacitor-filesystem-real.ts`'s dynamic-import-only discipline
 * — see that module's doc comment) and must never be statically imported
 * from anything reachable by the web/hosted/desktop client bundle. There is
 * currently no call site wiring this into a real Android app entry point —
 * that lands with the `android/` workspace package (ADR-021 spec FR11),
 * which is out of scope for Phase 0 Task 4. This module exists as a
 * correctly-implemented, unit-tested seam ready for that wiring.
 */
import { createRealCapacitorFilesystem } from "./capacitor-filesystem-real";
import { capacitorFsAdapter } from "./capacitorFsAdapter";
import { setDefaultStorageContext } from "./storage-context";

/**
 * On-device projects subpath, joined onto the resolved app-private data
 * directory root. Mirrors the `/projects` convention
 * `native-search-backend.ts` uses for its own `projectsDir` default — the
 * native analogue of `GETWRITE_PROJECTS_DIR`.
 */
const PROJECTS_SUBPATH = "projects";

/**
 * Memoized in-flight/settled bootstrap promise. `null` until the first call;
 * thereafter every caller ({@link NativeBootstrap} at startup, and every native
 * transport backend's production path via {@link ensureNativeStorageContext})
 * awaits this SAME promise — which resolves only after the default context is
 * installed AND the projects dir is created. That shared promise is what makes
 * the "bind once, everyone waits for it" gate race-free (FR5).
 */
let bootstrapPromise: Promise<void> | null = null;

/** The one-time bootstrap work; run at most once, guarded by {@link bootstrapPromise}. */
async function doBootstrap(): Promise<void> {
  const { Directory } = await import("@capacitor/filesystem");

  // The adapter is rooted at Directory.Data (app-private storage); every path it
  // receives is resolved *relative to that root* (leading slash stripped). So
  // tenantRoot must be the Directory.Data-relative "/projects" — NOT an absolute
  // `file://…/files/projects` URI. Passing an absolute URI here would make the
  // adapter re-root it under Directory.Data (Directory.Data/file:/data/…), so
  // every read/write would land in a mangled path and project create/list would
  // silently fail. This matches the "/projects" convention the on-device search
  // harness and native-search-backend already use successfully.
  const tenantRoot = `/${PROJECTS_SUBPATH}`;

  const adapter = capacitorFsAdapter(
    createRealCapacitorFilesystem(Directory.Data),
  );

  setDefaultStorageContext({ tenantRoot, adapter });

  // Ensure the projects dir exists so the first `listProjectsCore` readdir on a
  // fresh device returns an empty list rather than ENOENT (desktop/hosted have
  // this directory pre-created at setup). mkdir is idempotent (recursive).
  await adapter.mkdir(tenantRoot, { recursive: true });
}

/**
 * Installs the process-wide default {@link StorageContext} and ensures the
 * projects dir exists. Idempotent: triggers the one-time bootstrap on first
 * call and returns the same memoized promise thereafter, so it can be called
 * eagerly at startup ({@link NativeBootstrap}) and awaited before every native
 * transport operation without ever re-running (FR5).
 */
export function bootstrapNativeStorageContext(): Promise<void> {
  if (!bootstrapPromise) {
    // Do NOT memoize a rejected bootstrap. If the first attempt fails (e.g. a
    // transient `@capacitor/filesystem` import or mkdir hiccup), clearing the
    // memo lets the next native op's ensureNativeStorageContext() retry, rather
    // than permanently bricking all native storage until an app restart.
    bootstrapPromise = doBootstrap().catch((err: unknown) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

/**
 * Alias of {@link bootstrapNativeStorageContext}, awaited by each native
 * transport backend's production path before it touches storage. Because it
 * returns the same memoized promise the startup call uses, a data fetch that
 * races ahead of app-startup bootstrap simply waits for that one bootstrap to
 * finish (context bound + projects dir created) instead of hitting an
 * unbootstrapped filesystem — closing the bootstrap-vs-first-fetch race.
 */
export const ensureNativeStorageContext = bootstrapNativeStorageContext;

/**
 * Test-only reset of the single-invocation guard, so unit tests can prove
 * {@link bootstrapNativeStorageContext}'s "runs exactly once" behavior
 * without cross-test leakage.
 */
export function __resetNativeBootstrapForTests(): void {
  bootstrapPromise = null;
}
