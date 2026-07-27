// Last Updated: 2026-07-26

/**
 * @module store/transport/native-resource-excerpts-backend
 *
 * **ADR-021 Phase 2 (Task 3).** The in-process implementation of
 * {@link ResourceExcerptsTransport} for a native (Capacitor) build: instead
 * of `fetch('/api/project-resources/excerpts')`, it invokes the *same*
 * transport-agnostic excerpts core the HTTP route uses
 * (`lib/models/resource-excerpts-core.ts`). There is no server and no HTTP —
 * the exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/resource-excerpts.ts`'s dynamic import), because it pulls in the
 * server-side excerpts core and storage layer, which must never enter the
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
 * **Degrade-gracefully parity.** The HTTP transport's `fetch` never throws —
 * any failure (network, non-2xx, malformed body) yields `{}`. This backend
 * mirrors that: any error from the excerpts core (including an invalid
 * `projectId`) is swallowed and resolves to `{}`, matching
 * `lib/api/resource-excerpts.ts`'s original `fetchResourceExcerpts` body.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import { fetchResourceExcerptsCore } from "../../lib/models/resource-excerpts-core";
import type { ResourceExcerptsTransport } from "../../lib/api/resource-excerpts";

/**
 * Builds the in-process resource-excerpts transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeResourceExcerptsTransport(
  deps: NativeBackendDeps = {},
): ResourceExcerptsTransport {
  const run = createNativeRunner(deps);

  return {
    async fetch(projectId, resourceIds, maxChars) {
      return run(async () => {
        try {
          return await fetchResourceExcerptsCore(
            projectId,
            resourceIds,
            maxChars,
          );
        } catch {
          // Mirrors the HTTP transport's degrade-gracefully parity.
          return {};
        }
      });
    },
  };
}
