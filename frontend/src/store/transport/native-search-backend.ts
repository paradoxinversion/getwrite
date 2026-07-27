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
 * **Storage context binding (ADR-021 Phase 0/2 — FR5).** Delegates to the
 * shared `createNativeRunner(deps)` helper (`native-runner.ts`): `deps.fs`
 * (spike/test) binds a fresh, one-off {@link runInStorageContext} scope over
 * the injected fake; in a real native build `deps.fs` is omitted and the runner
 * awaits the memoized native bootstrap (`ensureNativeStorageContext()` —
 * context bound once at startup + projects dir created), then resolves against
 * the ambient *default* {@link StorageContext} with no per-operation rebinding.
 */
import {
  executeSearch,
  findProjectRoot,
} from "../../lib/search/execute-search";
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import type { SearchResult } from "../search-transport-service";
import type { SearchTransport } from "./search-transport";

/** Default result cap, mirroring the route's `DEFAULT_RESULT_LIMIT`. */
const DEFAULT_RESULT_LIMIT = 50;

/** Injectable dependencies — omitted in production, supplied by the spike test. */
export interface NativeSearchDeps extends NativeBackendDeps {
  /** Result cap; production would read per-project prefs as the route does. */
  resultLimit?: number;
}

/**
 * Builds the in-process search transport for a native build.
 *
 * Storage-context binding goes through the shared `createNativeRunner(deps)`
 * helper (`native-runner.ts`), exactly like every other native transport
 * backend.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeSearchTransport(
  deps: NativeSearchDeps = {},
): SearchTransport {
  const projectsDir = deps.projectsDir ?? "/projects";
  const run = createNativeRunner(deps);
  return {
    async search(projectId, query, filters) {
      return run(async () => {
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
      });
    },
  };
}
