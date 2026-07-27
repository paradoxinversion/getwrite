// Last Updated: 2026-07-25

/**
 * @module store/transport/native-revision-backend
 *
 * **ADR-021 Phase 1 (Task 2).** The in-process implementation of
 * {@link RevisionTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/resource/revision/:resourceId')`, it invokes the *same*
 * transport-agnostic revision core the HTTP route uses
 * (`lib/models/revision-core.ts`). There is no server and no HTTP — the exact
 * same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `revision-transport-service.ts`'s dynamic import), because it pulls in the
 * server-side revision core and storage layer, which must never enter the
 * web client bundle.
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
import {
  createRevision,
  deleteRevision,
  readRevision,
  resolveRevisionProjectRoot,
  setCanonicalRevision,
  updateRevisionInPlace,
} from "../../lib/models/revision-core";
import type { RevisionTransport } from "../revision-transport-service";

/**
 * Resolves `projectId` to its on-disk project root via the shared plain
 * resolver, throwing (rather than returning a `Response`, which the HTTP
 * route does) when `projectId` is not a well-formed UUID.
 */
function resolveProjectRootOrThrow(projectId: string): string {
  const projectRoot = resolveRevisionProjectRoot(projectId);
  if (!projectRoot) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }
  return projectRoot;
}

/**
 * Builds the in-process revision transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeRevisionTransport(
  deps: NativeBackendDeps = {},
): RevisionTransport {
  const run = createNativeRunner(deps);

  return {
    async create(context, revisionName) {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        return createRevision(projectRoot, context.resourceId, {
          isCanonical: false,
          metadata: { name: revisionName },
        });
      });
    },

    async read(context, revisionId) {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        return readRevision(projectRoot, context.resourceId, revisionId);
      });
    },

    async updateInPlace(context, revisionId, content) {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        return updateRevisionInPlace(
          projectRoot,
          context.resourceId,
          revisionId,
          content,
        );
      });
    },

    async setCanonical(context, revisionId) {
      await run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        await setCanonicalRevision(projectRoot, context.resourceId, revisionId);
      });
    },

    async delete(context, revisionId) {
      await run(async () => {
        const projectRoot = resolveProjectRootOrThrow(context.projectId);
        await deleteRevision(projectRoot, context.resourceId, revisionId);
      });
    },
  };
}
