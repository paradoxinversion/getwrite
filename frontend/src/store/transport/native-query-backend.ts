// Last Updated: 2026-07-25

/**
 * @module store/transport/native-query-backend
 *
 * **ADR-021 Phase 1 (Task 3).** The in-process implementation of
 * {@link QueryTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/project/query/evaluate')` /
 * `fetch('/api/project/query/saved')`, it invokes the *same*
 * transport-agnostic query cores the HTTP routes use
 * (`lib/models/query-evaluate-core.ts`,
 * `lib/models/saved-query-dispatch-core.ts`). There is no server and no
 * HTTP — the exact same business logic runs directly in the WebView
 * process.
 *
 * This module is imported *only* on the native path (see
 * `query-transport-service.ts`'s dynamic import), because it pulls in the
 * server-side query cores and storage layer, which must never enter the web
 * client bundle.
 *
 * **Storage context binding.** Every operation runs through the shared
 * `createNativeRunner(deps)` helper (`native-runner.ts`): `deps.fs` (tests)
 * binds a one-off {@link runInStorageContext} scope over the injected fake;
 * in production it awaits the memoized native bootstrap
 * (`ensureNativeStorageContext()` — context bound + projects dir created) and
 * resolves against the ambient default {@link StorageContext}, with no
 * per-operation rebinding.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import { resolveProjectRoot } from "../../lib/models/project-root-resolver";
import { executeEvaluate } from "../../lib/models/query-evaluate-core";
import { dispatchSavedQueryAction } from "../../lib/models/saved-query-dispatch-core";
import type {
  QueryTransport,
  EvaluateQueryResponse,
  ListQueriesResponse,
  WriteQueryResponse,
} from "../query-transport-service";

/**
 * Resolves `projectId` to its on-disk project root via the shared plain
 * resolver, throwing (rather than returning a `Response`, which the HTTP
 * routes do) when `projectId` is not a well-formed UUID.
 */
function resolveProjectRootOrThrow(projectId: string): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }
  return projectRoot;
}

/**
 * Builds the in-process query transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeQueryTransport(
  deps: NativeBackendDeps = {},
): QueryTransport {
  const run = createNativeRunner(deps);

  return {
    async fetchSavedQueryList(context): Promise<ListQueriesResponse> {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        const result = await dispatchSavedQueryAction(projectRoot, {
          action: "list",
        });
        return result as ListQueriesResponse;
      });
    },

    async persistSavedQuery(context, query): Promise<WriteQueryResponse> {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        const result = await dispatchSavedQueryAction(projectRoot, {
          action: "write",
          query,
        });
        return result as WriteQueryResponse;
      });
    },

    async removeSavedQuery(context, id): Promise<void> {
      await run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        await dispatchSavedQueryAction(projectRoot, { action: "delete", id });
      });
    },

    async evaluateQueryAst(
      context,
      definition,
    ): Promise<EvaluateQueryResponse> {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        const ids = await executeEvaluate(projectRoot, definition);
        return { ids };
      });
    },
  };
}
