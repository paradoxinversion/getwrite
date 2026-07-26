// Last Updated: 2026-07-24

/**
 * @module store/transport/search-transport
 *
 * **ADR-021 seam.** The transport-collapse point for search: one
 * {@link SearchTransport} contract with two implementations selected by the
 * build-time runtime.
 *
 * - **Web/hosted/desktop** → {@link httpSearchTransport}, which carries the
 *   original `fetch('/api/project/:id/search')` call **byte-for-byte**. The
 *   existing server path is untouched.
 * - **Native (Capacitor)** → an in-process backend, dynamically imported only
 *   when `runtime === "native"`. The dynamic import is deliberate: it keeps the
 *   server-only search core (which imports `node:*` and the storage layer) out
 *   of the web client bundle entirely, so the HTTP build never pays for it.
 *
 * Call sites depend on {@link resolveSearchTransport} rather than on `fetch`,
 * which is the whole point — the same Redux transport service works on both
 * platforms with no branching of its own.
 *
 * As of ADR-021 Phase 1, the runtime branch, dispatch, and error handling are
 * centralized in {@link createTransport} (`./create-transport`), a generic
 * helper shared across transports. This module's job is now just to supply
 * the HTTP implementation and a `loadNative` thunk carrying the literal
 * dynamic import specifier `./native-search-backend` — the literal specifier
 * is what lets `next.config.mjs`'s `turbopack.resolveAlias` substitute the
 * `node:*`-free web-stub for it at build time (see
 * `native-search-backend.web-stub.ts`).
 */
import type { SearchFilters, SearchResult } from "../search-transport-service";
import { createTransport } from "./create-transport";

/** The single operation both platforms implement. */
export interface SearchTransport {
  search(
    projectId: string,
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult[]>;
}

/** Extracts a human-readable message from an `{ error }` JSON body. */
function getApiErrorMessage(errorBody: unknown, fallback: string): string {
  if (
    errorBody &&
    typeof errorBody === "object" &&
    "error" in errorBody &&
    typeof (errorBody as { error: unknown }).error === "string"
  ) {
    return (errorBody as { error: string }).error;
  }
  return fallback;
}

/**
 * HTTP transport — the hosted/desktop path. This is the original
 * `executeSearchRequest` body verbatim; preserving it exactly is what keeps the
 * server build unchanged.
 */
export const httpSearchTransport: SearchTransport = {
  async search(projectId, query, filters) {
    const params = new URLSearchParams({ q: query });
    if (filters?.folder) params.set("folder", filters.folder);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.tags && filters.tags.length > 0) {
      params.set("tags", filters.tags.join(","));
    }
    const response = await fetch(
      `/api/project/${projectId}/search?${params.toString()}`,
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        getApiErrorMessage(errorBody, "Unable to perform search."),
      );
    }

    return (await response.json()) as SearchResult[];
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the web
 * bundle's module graph.
 *
 * The runtime branch, dispatch, and error handling are centralized in
 * {@link createTransport}; this call site's only remaining responsibility is
 * providing the HTTP implementation and the native loader thunk. The thunk
 * contains the literal `import("./native-search-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can still substitute the
 * web-stub for it at build time, exactly as before this refactor.
 */
export const resolveSearchTransport: () => Promise<SearchTransport> =
  createTransport(httpSearchTransport, () =>
    import("./native-search-backend").then(({ createNativeSearchTransport }) =>
      createNativeSearchTransport(),
    ),
  );
