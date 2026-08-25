/**
 * @module store/transport/native-mentions-backend
 *
 * **ADR-021 Phase 2 (Task 11).** The in-process implementation of
 * {@link MentionsTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/resource/:resourceId/mentions')` /
 * `fetch('/api/resource/:resourceId/mentioned-in')`, it invokes the *same*
 * transport-agnostic mentions core the HTTP routes use
 * (`lib/models/mentions-core.ts`). There is no server and no HTTP — the
 * exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/mentions.ts`'s dynamic import), because it pulls in the
 * server-side mentions core and storage layer, which must never enter the
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
 * **Project root resolution.** Unlike `resource-excerpts-core.ts`, the
 * mentions core takes a project *root* rather than a `projectId`, so this
 * backend resolves `projectId` -> project root itself via the shared
 * `resolveProjectRoot()` (`project-root-resolver.ts`), the same seam
 * `native-metadata-schema-backend.ts` uses.
 *
 * **Degrade-gracefully parity.** The HTTP transport's methods never throw —
 * any failure (network, non-2xx, malformed body) yields `[]`. This backend
 * mirrors that: any error, including an invalid `projectId`, is swallowed
 * and resolves to `[]`, matching `lib/api/mentions.ts`'s HTTP
 * implementation.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import { resolveProjectRoot } from "../../lib/models/project-root-resolver";
import {
  getResourceMentions as getResourceMentionsCore,
  getEntityMentionedIn as getEntityMentionedInCore,
} from "../../lib/models/mentions-core";
import type { MentionsTransport } from "../../lib/api/mentions";

/**
 * Builds the in-process mentions transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeMentionsTransport(
  deps: NativeBackendDeps = {},
): MentionsTransport {
  const run = createNativeRunner(deps);

  return {
    async getResourceMentions(projectId, resourceId) {
      return run(async () => {
        try {
          const projectRoot = resolveProjectRoot(projectId);
          if (!projectRoot) return [];
          return await getResourceMentionsCore(projectRoot, resourceId);
        } catch {
          // Mirrors the HTTP transport's degrade-gracefully parity.
          return [];
        }
      });
    },

    async getEntityMentionedIn(projectId, entityId) {
      return run(async () => {
        try {
          const projectRoot = resolveProjectRoot(projectId);
          if (!projectRoot) return [];
          return await getEntityMentionedInCore(projectRoot, entityId);
        } catch {
          // Mirrors the HTTP transport's degrade-gracefully parity.
          return [];
        }
      });
    },
  };
}
