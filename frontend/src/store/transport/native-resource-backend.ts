// Last Updated: 2026-07-26

/**
 * @module store/transport/native-resource-backend
 *
 * **ADR-021 Phase 2 (Task 3).** The in-process implementation of
 * {@link ResourcesTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/resource')`/`fetch('/api/resource/upload')`/etc., it invokes
 * the *same* transport-agnostic resource CRUD core the HTTP routes use
 * (`lib/models/resource-crud-core.ts`), plus (for the two revision-backed
 * operations) the already-lifted revision core
 * (`lib/models/revision-core.ts`). There is no server and no HTTP — the
 * exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/resources.ts`'s dynamic import), because it pulls in the
 * server-side resource core and storage layer, which must never enter the
 * web client bundle.
 *
 * **Storage context binding.** Every operation runs through the shared
 * `createNativeRunner(deps)` helper (`native-runner.ts`): `deps.fs` (tests)
 * binds a one-off {@link runInStorageContext} scope over the injected fake;
 * in production it awaits the memoized native bootstrap
 * (`ensureNativeStorageContext()` — context bound + projects dir created) and
 * resolves against the ambient default {@link StorageContext}, with no
 * per-operation rebinding.
 *
 * **`renameResource` boolean-return parity.** The HTTP transport's
 * `renameResource` returns `response.ok` — any non-2xx (missing newName,
 * not-found, or an internal error) resolves to `false`, never a thrown
 * error. This backend mirrors that: any error from the rename cores
 * (including an invalid `projectId`) is swallowed and resolves to `false`,
 * matching `lib/api/resources.ts`'s original `renameResource` body.
 *
 * **`fetchResourceContent`/`fetchRevisionContent` null-on-failure parity.**
 * Both HTTP methods return `null` instead of throwing when the underlying
 * request fails (`!response.ok`). This backend mirrors that for the same
 * failure classes their cores can raise, so callers see identical
 * degrade-gracefully behavior on both platforms.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import {
  copyResourceCore,
  createResourceCore,
  deleteResourceCore,
  fetchResourceContentCore,
  renameFolderCore,
  renameResourceSidecarCore,
  reorderResourcesCore,
  updateSidecarCore,
  uploadMediaResourceCore,
} from "../../lib/models/resource-crud-core";
import type { CreateResourceOpts } from "../../lib/models/resource-factory";
import type { AnyResource } from "../../lib/models/types";
import {
  readRevision,
  resolveRevisionProjectRoot,
  updateRevisionInPlace,
} from "../../lib/models/revision-core";
import type {
  ResourcesTransport,
  ResourceContentResponse,
} from "../../lib/api/resources";

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
 * Builds the in-process resources transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeResourcesTransport(
  deps: NativeBackendDeps = {},
): ResourcesTransport {
  const run = createNativeRunner(deps);

  return {
    async create(projectId, resourceData) {
      return run(async () => {
        const resource = await createResourceCore(
          projectId,
          resourceData as unknown as CreateResourceOpts,
        );
        return { resource };
      });
    },

    async uploadMedia(projectId, input) {
      return run(async () => {
        const resource = await uploadMediaResourceCore(projectId, input);
        return { resource };
      });
    },

    async copy(resourceId, newName, projectId) {
      return run(async () => {
        const resource = await copyResourceCore(projectId, resourceId, newName);
        return { resource: resource as unknown as AnyResource };
      });
    },

    async remove(resourceId, projectId) {
      await run(async () => {
        await deleteResourceCore(projectId, resourceId);
      });
    },

    async updateSidecar(resourceId, projectId, updatedResource) {
      await run(async () => {
        await updateSidecarCore(
          projectId,
          resourceId,
          updatedResource as unknown as Record<string, unknown>,
        );
      });
    },

    async rename(resourceId, projectId, newName, resourceType) {
      return run(async () => {
        try {
          const trimmed = newName.trim();
          if (!trimmed) return false;

          const updated =
            resourceType === "folder"
              ? await renameFolderCore(projectId, resourceId, trimmed)
              : await renameResourceSidecarCore(projectId, resourceId, trimmed);

          return updated !== null;
        } catch {
          // Mirrors the HTTP transport's boolean-return parity: any
          // failure (invalid projectId, not-found, or an internal error)
          // resolves to `false` rather than rejecting.
          return false;
        }
      });
    },

    async fetchContent(projectId, resourceId) {
      return run(async () => {
        try {
          const result = await fetchResourceContentCore(projectId, resourceId);
          return result as unknown as ResourceContentResponse;
        } catch {
          // Mirrors the HTTP transport's `!response.ok -> null` parity.
          return null;
        }
      });
    },

    async fetchRevisionContent(resourceId, projectId, revisionId) {
      return run(async () => {
        try {
          const projectRoot = resolveProjectRootOrThrow(projectId);
          const { content } = await readRevision(
            projectRoot,
            resourceId,
            revisionId,
          );
          return content;
        } catch {
          // Mirrors the HTTP transport's `!response.ok -> null` parity.
          return null;
        }
      });
    },

    async patchRevisionContent(resourceId, projectId, revisionId, content) {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(projectId);
        const updated = await updateRevisionInPlace(
          projectRoot,
          resourceId,
          revisionId,
          content,
        );
        return { updatedAt: updated.updatedAt };
      });
    },

    async reorder(projectId, payload, projectRoot) {
      await run(async () => {
        await reorderResourcesCore(projectId, {
          folderOrder: payload.folderOrder.map((f) => ({
            id: f.id,
            orderIndex: f.orderIndex ?? 0,
            folderId: f.folderId,
          })),
          resourceOrder: payload.resourceOrder.map((r) => ({
            id: r.id,
            orderIndex: r.orderIndex ?? 0,
            folderId: r.folderId,
          })),
          projectRootOverride: projectRoot,
        });
      });
    },
  };
}
