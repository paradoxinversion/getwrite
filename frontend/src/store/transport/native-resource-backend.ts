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
 * **Storage context binding.** Mirrors `native-project-backend.ts`:
 * `deps.fs` is a test-injection seam — when supplied, this module binds a
 * fresh, one-off {@link runInStorageContext} scope for that call. In
 * production, `deps.fs` is omitted and the ambient default
 * {@link StorageContext} installed once by `native-bootstrap.ts` is used
 * instead, with no per-operation rebinding. `nativeFilesystem()` remains a
 * defensive fallback for the (unsupported) case where no bootstrap has run
 * yet.
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
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { createRealCapacitorFilesystem } from "../../lib/models/capacitor-filesystem-real";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import {
  getStorageContext,
  runInStorageContext,
} from "../../lib/models/storage-context";
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

/** Injectable dependencies — omitted in production, supplied by tests. */
export interface NativeResourceDeps {
  /** The device filesystem. Production: the real `@capacitor/filesystem` plugin. */
  fs?: CapacitorFilesystemLike;
  /** On-device projects root (the native analogue of `GETWRITE_PROJECTS_DIR`). */
  projectsDir?: string;
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
  deps: NativeResourceDeps = {},
): ResourcesTransport {
  const projectsDir = deps.projectsDir ?? "/projects";

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (deps.fs) {
      // Explicit test injection: bind a fresh, one-off context for this
      // call only, matching how the project/revision native backend tests
      // exercise their transports standalone, without any global native
      // bootstrap having run.
      const adapter = capacitorFsAdapter(deps.fs);
      return runInStorageContext({ tenantRoot: projectsDir, adapter }, fn);
    }

    if (getStorageContext()) {
      // Production path: an ambient StorageContext is already active —
      // either the process-wide default installed once at native app
      // startup (native-bootstrap.ts), or an explicit scope some caller
      // already established. Resolve directly; do not rebind.
      return fn();
    }

    // Defensive fallback: no ambient context yet. Bind a one-off context
    // against the real plugin so the call still resolves against the real
    // device filesystem instead of silently falling through to io.ts's
    // Node `fs/promises` default, which is meaningless on Android.
    const adapter = capacitorFsAdapter(nativeFilesystem());
    return runInStorageContext({ tenantRoot: projectsDir, adapter }, fn);
  }

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
