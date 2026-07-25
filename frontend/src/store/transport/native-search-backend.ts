// Last Updated: 2026-07-24

/**
 * @module store/transport/native-search-backend
 *
 * **ADR-021 spike — the transport collapse.** The in-process implementation of
 * {@link SearchTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/...')`, it invokes the *same* transport-agnostic search core the
 * HTTP route uses ({@link executeSearch}), inside a {@link runInStorageContext}
 * scope bound to a {@link capacitorFsAdapter} over the device filesystem. There
 * is no server and no HTTP — the exact same business logic runs directly in the
 * WebView process.
 *
 * This module is imported *only* on the native path (see
 * `search-transport.ts`'s dynamic import), because it pulls in the server-side
 * search core and storage layer, which must never enter the web client bundle.
 *
 * The `deps` seam exists so the spike test can inject the in-memory Capacitor
 * fake and a fixture projects dir. In a real native build, `deps` is omitted and
 * `nativeFilesystem()` resolves the actual `@capacitor/filesystem` plugin — that
 * one wiring line is the only piece deferred behind the dependency sign-off.
 */
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import { runInStorageContext } from "../../lib/models/storage-context";
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
 * Resolves the real Capacitor Filesystem plugin. Deferred behind the
 * dependency sign-off (ADR-021): the native build supplies it, the spike does
 * not need it.
 */
function nativeFilesystem(): CapacitorFilesystemLike {
  throw new Error(
    "Native filesystem not wired: pass deps.fs, or adopt @capacitor/filesystem for the native build (ADR-021).",
  );
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
      const fs = deps.fs ?? nativeFilesystem();
      const projectsDir = deps.projectsDir ?? "/projects";
      const adapter = capacitorFsAdapter(fs);

      // Establish the storage context so the shared core's io.ts calls resolve
      // to the Capacitor adapter — exactly what withStorageContext does for the
      // HTTP route, minus the request.
      return runInStorageContext(
        { tenantRoot: projectsDir, adapter },
        async () => {
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
        },
      );
    },
  };
}
