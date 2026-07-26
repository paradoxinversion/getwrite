import type { SavedQuery } from "../lib/models/saved-queries";
import type { QueryAST } from "../lib/models/query-ast";
import { selectActiveProjectDirectoryId } from "./projectsSlice";
import type { RootState } from "./store";
import { createTransport } from "./transport/create-transport";

export interface QueryRequestContext {
  projectId: string;
}

/**
 * Resolves selected project context needed for query requests.
 *
 * `expectedProjectId` is the Redux-internal `selectedProjectId` (mirrored
 * from `project.json`'s `id` field) — it is used only to guard against a
 * project switch racing an in-flight request, never sent to the API. The
 * `projectId` returned in the context is the active project's on-disk
 * directory basename (via {@link selectActiveProjectDirectoryId}), which is
 * what every tenant-scoped query route (ADR-017/018) actually expects. Per
 * FR12, a project's on-disk directory name and its `project.json` `id` are
 * two independently generated UUIDs — sending the wrong one is a silent
 * failure, not an auth error.
 */
export function resolveQueryRequestContext(
  state: RootState,
  expectedProjectId: string,
): QueryRequestContext | { error: string } {
  const { selectedProjectId } = state.projects;

  if (!selectedProjectId) {
    return { error: "No project selected." };
  }

  if (selectedProjectId !== expectedProjectId) {
    return { error: "Project changed before operation completed." };
  }

  const projectId = selectActiveProjectDirectoryId(state);
  if (!projectId) {
    return { error: "Selected project is missing a root path." };
  }

  return { projectId };
}

async function postJson<T>(
  url: string,
  body: unknown,
  fallbackError: string,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody &&
      typeof errorBody === "object" &&
      "error" in errorBody &&
      typeof (errorBody as { error?: unknown }).error === "string"
        ? (errorBody as { error: string }).error
        : fallbackError;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export interface ListQueriesResponse {
  queries: SavedQuery[];
}

export interface WriteQueryResponse {
  query: SavedQuery;
}

export interface EvaluateQueryResponse {
  ids: string[];
}

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 1, Task 3)
//
// One QueryTransport contract with two implementations selected by the
// build-time runtime, mirroring revision-transport-service.ts:
//
// - Web/hosted/desktop -> httpQueryTransport, which carries the original
//   `fetch('/api/project/query/...')` calls byte-for-byte.
// - Native (Capacitor) -> an in-process backend
//   (`./transport/native-query-backend`), dynamically imported only when
//   `runtime === "native"`, reusing the shared query cores
//   (`lib/models/query-evaluate-core.ts`,
//   `lib/models/saved-query-dispatch-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `./transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The query-route-backed operations both platforms implement. Shared with
 * `./transport/native-query-backend`, which imports this type rather than
 * duplicating it.
 */
export interface QueryTransport {
  /** Fetch all saved queries for a project. */
  fetchSavedQueryList(
    context: QueryRequestContext,
  ): Promise<ListQueriesResponse>;
  /** Write (create or overwrite) a saved query. */
  persistSavedQuery(
    context: QueryRequestContext,
    query: SavedQuery,
  ): Promise<WriteQueryResponse>;
  /** Delete a saved query by id. */
  removeSavedQuery(context: QueryRequestContext, id: string): Promise<void>;
  /** Evaluate a query AST inline and return matching resource IDs. */
  evaluateQueryAst(
    context: QueryRequestContext,
    definition: QueryAST,
  ): Promise<EvaluateQueryResponse>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `fetch`/`postJson` call verbatim; preserving it
 * exactly is what keeps the server build unchanged.
 */
export const httpQueryTransport: QueryTransport = {
  fetchSavedQueryList(context) {
    return postJson(
      "/api/project/query/saved",
      { action: "list", projectId: context.projectId },
      "Unable to load saved queries.",
    );
  },

  persistSavedQuery(context, query) {
    return postJson(
      "/api/project/query/saved",
      { action: "write", projectId: context.projectId, query },
      "Failed to save query.",
    );
  },

  removeSavedQuery(context, id) {
    return postJson(
      "/api/project/query/saved",
      { action: "delete", projectId: context.projectId, id },
      "Failed to delete query.",
    );
  },

  evaluateQueryAst(context, definition) {
    return postJson(
      "/api/project/query/evaluate",
      { projectId: context.projectId, definition },
      "Query evaluation failed.",
    );
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("./transport/native-query-backend")` specifier so Turbopack's
 * `resolveAlias` (`next.config.mjs`) can substitute a `node:*`-free web-stub
 * for it at build time.
 */
export const resolveQueryTransport: () => Promise<QueryTransport> =
  createTransport(httpQueryTransport, () =>
    import("./transport/native-query-backend").then(
      ({ createNativeQueryTransport }) => createNativeQueryTransport(),
    ),
  );

/**
 * Fetch all saved queries for a project.
 */
export async function fetchSavedQueryList(
  context: QueryRequestContext,
): Promise<ListQueriesResponse> {
  const transport = await resolveQueryTransport();
  return transport.fetchSavedQueryList(context);
}

/**
 * Write (create or overwrite) a saved query.
 */
export async function persistSavedQuery(
  context: QueryRequestContext,
  query: SavedQuery,
): Promise<WriteQueryResponse> {
  const transport = await resolveQueryTransport();
  return transport.persistSavedQuery(context, query);
}

/**
 * Delete a saved query by id.
 */
export async function removeSavedQuery(
  context: QueryRequestContext,
  id: string,
): Promise<void> {
  const transport = await resolveQueryTransport();
  await transport.removeSavedQuery(context, id);
}

/**
 * Evaluate a query AST inline and return matching resource IDs.
 */
export async function evaluateQueryAst(
  context: QueryRequestContext,
  definition: QueryAST,
): Promise<EvaluateQueryResponse> {
  const transport = await resolveQueryTransport();
  return transport.evaluateQueryAst(context, definition);
}
