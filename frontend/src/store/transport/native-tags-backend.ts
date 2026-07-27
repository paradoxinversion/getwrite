// Last Updated: 2026-07-26

/**
 * @module store/transport/native-tags-backend
 *
 * **ADR-021 Phase 2 (Task 4).** The in-process implementation of
 * {@link TagsTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/project/tags')`/`fetch('/api/project/tags/delete')`/
 * `fetch('/api/project/tags/assign')`, it invokes the *same*
 * transport-agnostic tags CRUD core the HTTP route uses
 * (`lib/models/tags-crud-core.ts`). There is no server and no HTTP — the
 * exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/tags.ts`'s dynamic import), because it pulls in the server-side
 * tags core and storage layer, which must never enter the web client
 * bundle.
 *
 * **Storage context binding.** Every operation runs through the shared
 * `createNativeRunner(deps)` helper (`native-runner.ts`): `deps.fs` (tests)
 * binds a one-off {@link runInStorageContext} scope over the injected fake;
 * in production it awaits the memoized native bootstrap
 * (`ensureNativeStorageContext()` — context bound + projects dir created) and
 * resolves against the ambient default {@link StorageContext}, with no
 * per-operation rebinding.
 *
 * **`list`/`listAssignments` degrade-to-`[]` parity.** The HTTP transport's
 * `list`/`listAssignments` never throw — a failed or 404 request resolves to
 * `[]`, matching `lib/api/tags.ts`'s original `listTags`/
 * `listTagAssignments` bodies. This backend preserves that by swallowing
 * any error the core throws and resolving to `[]` instead.
 *
 * **`create`/`remove`/`assign` fire-and-forget parity.** The HTTP
 * transport's `create`/`remove`/`assign` never inspect `fetch`'s response —
 * a failed request resolves silently. This backend preserves that by
 * swallowing any error the core throws, rather than rejecting.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import {
  assignTagCore,
  createTagCore,
  deleteTagCore,
  listTagAssignmentsCore,
  listTagsCore,
} from "../../lib/models/tags-crud-core";
import type { TagsTransport } from "../../lib/api/tags";

/**
 * Builds the in-process tags transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeTagsTransport(
  deps: NativeBackendDeps = {},
): TagsTransport {
  const run = createNativeRunner(deps);

  return {
    async list(projectId) {
      return run(async () => {
        try {
          return await listTagsCore(projectId);
        } catch {
          // Mirrors the HTTP transport's `!response.ok -> []` parity.
          return [];
        }
      });
    },

    async listAssignments(projectId, resourceId) {
      return run(async () => {
        try {
          return await listTagAssignmentsCore(projectId, resourceId);
        } catch {
          // Mirrors the HTTP transport's `!response.ok -> []` parity.
          return [];
        }
      });
    },

    async create(projectId, name, color) {
      await run(async () => {
        try {
          await createTagCore(projectId, name, color);
        } catch {
          // Mirrors the HTTP transport's fire-and-forget parity: a failed
          // create resolves silently rather than rejecting.
        }
      });
    },

    async remove(projectId, tagId) {
      await run(async () => {
        try {
          await deleteTagCore(projectId, tagId);
        } catch {
          // Mirrors the HTTP transport's fire-and-forget parity.
        }
      });
    },

    async assign(projectId, resourceId, tagId, assign) {
      await run(async () => {
        try {
          await assignTagCore(projectId, resourceId, tagId, assign);
        } catch {
          // Mirrors the HTTP transport's fire-and-forget parity.
        }
      });
    },
  };
}
