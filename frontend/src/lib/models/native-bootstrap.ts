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
 * Guards {@link bootstrapNativeStorageContext} against being invoked more
 * than once per process — FR5 requires the storage context be bound exactly
 * once, for the process's lifetime.
 */
let isBootstrapped = false;

/**
 * Resolves the on-device app-private data directory root and installs it,
 * together with the real Capacitor filesystem adapter, as the process-wide
 * default {@link StorageContext}.
 *
 * Must be called exactly once, at native app startup, for the lifetime of
 * the process (FR5). A second call is a no-op (logged as a warning) rather
 * than re-resolving and re-installing a new default — re-running startup
 * resolution mid-process is not a supported flow, and silently swapping the
 * ambient context out from under already-in-flight work would be worse than
 * refusing.
 */
export async function bootstrapNativeStorageContext(): Promise<void> {
  if (isBootstrapped) {
    console.warn(
      "[native-bootstrap] bootstrapNativeStorageContext() called more than " +
        "once; ignoring. It must run exactly once at app startup " +
        "(ADR-021 Phase 0, FR5).",
    );
    return;
  }
  isBootstrapped = true;

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { uri } = await Filesystem.getUri({
    path: "",
    directory: Directory.Data,
  });
  const tenantRoot = `${uri.replace(/\/+$/, "")}/${PROJECTS_SUBPATH}`;

  const adapter = capacitorFsAdapter(
    createRealCapacitorFilesystem(Directory.Data),
  );

  setDefaultStorageContext({ tenantRoot, adapter });
}

/**
 * Test-only reset of the single-invocation guard, so unit tests can prove
 * {@link bootstrapNativeStorageContext}'s "runs exactly once" behavior
 * without cross-test leakage.
 */
export function __resetNativeBootstrapForTests(): void {
  isBootstrapped = false;
}
