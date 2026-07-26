// Last Updated: 2026-07-25

/**
 * @module store/transport/native-search-backend
 *
 * **ADR-021 spike — the transport collapse.** The in-process implementation of
 * {@link SearchTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/...')`, it invokes the *same* transport-agnostic search core the
 * HTTP route uses ({@link executeSearch}). There is no server and no HTTP — the
 * exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `search-transport.ts`'s dynamic import), because it pulls in the server-side
 * search core and storage layer, which must never enter the web client bundle.
 *
 * **Storage context binding (ADR-021 Phase 0, Task 4 — FR5).** `deps.fs`
 * remains the test-injection seam for exercising this transport without a
 * device: when supplied, this module binds a fresh, one-off
 * {@link runInStorageContext} scope for that call, exactly as before, so
 * spike tests get a standalone, isolated result with no global bootstrap
 * required.
 *
 * In a real native build, `deps.fs` is omitted. FR5 requires
 * `runInStorageContext` be bound exactly once, at app startup — not
 * per-operation — so this production path does **not** rebind a context per
 * search call. It relies on the ambient *default* {@link StorageContext}
 * installed once by `native-bootstrap.ts` (`setDefaultStorageContext`),
 * which `getStorageContext()`'s fallback (`storage-context.ts`) makes
 * transparently visible to every `io.ts` call in this module's call chain.
 * `nativeFilesystem()` is kept only as a defensive fallback for the
 * (unsupported) case where no bootstrap has run yet: rather than silently
 * resolving to the wrong default (Node's `fs/promises` adapter, meaningless
 * on Android), it binds a one-off context against the real plugin so the
 * call still resolves against the real device filesystem.
 */
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { createRealCapacitorFilesystem } from "../../lib/models/capacitor-filesystem-real";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import {
  getStorageContext,
  runInStorageContext,
} from "../../lib/models/storage-context";
import {
  executeSearch,
  findProjectRoot,
} from "../../lib/search/execute-search";
import type { SearchResult } from "../search-transport-service";
import type { SearchTransport } from "./search-transport";

/** Default result cap, mirroring the route's `DEFAULT_RESULT_LIMIT`. */
const DEFAULT_RESULT_LIMIT = 50;

/** Injectable dependencies — omitted in production, supplied by the spike test. */
export interface NativeSearchDeps {
  /** The device filesystem. Production: the real `@capacitor/filesystem` plugin. */
  fs?: CapacitorFilesystemLike;
  /** On-device projects root (the native analogue of `GETWRITE_PROJECTS_DIR`). */
  projectsDir?: string;
  /** Result cap; production would read per-project prefs as the route does. */
  resultLimit?: number;
}

/**
 * Resolves the real Capacitor Filesystem plugin, scoped to the default
 * `Directory.Data` root. This is the production path: the native runtime
 * never supplies `deps.fs`, so every real device call flows through here.
 */
function nativeFilesystem(): CapacitorFilesystemLike {
  return createRealCapacitorFilesystem();
}

/**
 * Builds the in-process search transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeSearchTransport(
  deps: NativeSearchDeps = {},
): SearchTransport {
  return {
    async search(projectId, query, filters) {
      const projectsDir = deps.projectsDir ?? "/projects";

      const runSearch = async (): Promise<SearchResult[]> => {
        const projectRoot = await findProjectRoot(projectsDir, projectId);
        if (!projectRoot) {
          throw new Error(`Project ${projectId} not found.`);
        }
        const results = await executeSearch(
          projectRoot,
          query,
          {
            folder: filters?.folder,
            status: filters?.status,
            tags: filters?.tags,
          },
          deps.resultLimit ?? DEFAULT_RESULT_LIMIT,
        );
        // The core returns the canonical server shape; the service's public
        // SearchResult is structurally the same view of it.
        return results as unknown as SearchResult[];
      };

      if (deps.fs) {
        // Explicit test injection: bind a fresh, one-off context for this
        // call only — matching how the spike tests exercise this transport
        // standalone, without any global native bootstrap having run.
        const adapter = capacitorFsAdapter(deps.fs);
        return runInStorageContext(
          { tenantRoot: projectsDir, adapter },
          runSearch,
        );
      }

      if (getStorageContext()) {
        // Production path: an ambient StorageContext is already active —
        // either the process-wide default installed once at native app
        // startup (native-bootstrap.ts, FR5), or an explicit scope some
        // caller already established. Resolve directly; do not rebind.
        return runSearch();
      }

      // Defensive fallback: no ambient context yet (e.g. this call happened
      // before native-bootstrap.ts ran, or there is no bootstrap at all in
      // this environment). Bind a one-off context against the real plugin so
      // the call still resolves against the real device filesystem instead
      // of silently falling through to io.ts's Node `fs/promises` default,
      // which is meaningless on Android.
      const adapter = capacitorFsAdapter(nativeFilesystem());
      return runInStorageContext(
        { tenantRoot: projectsDir, adapter },
        runSearch,
      );
    },
  };
}
