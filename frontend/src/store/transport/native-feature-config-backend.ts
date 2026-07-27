// Last Updated: 2026-07-25

/**
 * @module store/transport/native-feature-config-backend
 *
 * **ADR-021 Phase 1 (Task 5).** The in-process implementation of
 * {@link FeatureConfigTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/project/features')`, it invokes the *same* transport-agnostic
 * `updateFeatureConfig` helper the HTTP route uses
 * (`lib/models/project-features.ts`). There is no server and no HTTP — the
 * exact same business logic runs directly in the WebView process.
 *
 * This is the smallest of the Phase 1 native backends: `updateFeatureConfig`
 * is already the transport-agnostic core (no dispatch-core layer to lift, as
 * with revision/query/metadata-schema), so this module's only job is
 * `projectId -> projectRoot` resolution plus ambient `StorageContext`
 * binding.
 *
 * This module is imported *only* on the native path (see
 * `feature-config-transport-service.ts`'s dynamic import), because it pulls
 * in the server-side project-features helper and storage layer, which must
 * never enter the web client bundle.
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
import { updateFeatureConfig } from "../../lib/models/project-features";
import type {
  FeatureConfigResult,
  FeatureConfigUpdate,
  FeatureConfigTransport,
} from "../feature-config-transport-service";

/**
 * Resolves `projectId` to its on-disk project root via the shared plain
 * resolver, throwing (rather than returning a `Response`, which the HTTP
 * route does) when `projectId` is not a well-formed UUID.
 */
function resolveProjectRootOrThrow(projectId: string): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }
  return projectRoot;
}

/**
 * Builds the in-process feature-config transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeFeatureConfigTransport(
  deps: NativeBackendDeps = {},
): FeatureConfigTransport {
  const run = createNativeRunner(deps);

  return {
    async updateFeatureConfig(
      projectId: string,
      update: FeatureConfigUpdate,
    ): Promise<FeatureConfigResult> {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(projectId);
        return updateFeatureConfig(projectRoot, update);
      });
    },
  };
}
