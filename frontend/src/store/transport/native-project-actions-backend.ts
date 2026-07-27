// Last Updated: 2026-07-26

/**
 * @module store/transport/native-project-actions-backend
 *
 * **ADR-021 Phase 2 (Task 2).** The in-process implementation of
 * {@link ProjectActionsTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/project/rename')`/`fetch('/api/project/delete')`, it invokes
 * the *same* transport-agnostic project CRUD core the HTTP routes use
 * (`lib/models/project-crud-core.ts`). There is no server and no HTTP — the
 * exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `project-actions-controller.ts`'s dynamic import), because it pulls in the
 * server-side project core and storage layer, which must never enter the
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
  deleteProjectCore,
  renameProjectCore,
} from "../../lib/models/project-crud-core";
import type { ProjectActionsTransport } from "../project-actions-controller";

/**
 * Builds the in-process project-actions transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeProjectActionsTransport(
  deps: NativeBackendDeps = {},
): ProjectActionsTransport {
  const run = createNativeRunner(deps);

  return {
    async rename(projectId, newName) {
      await run(() => renameProjectCore(projectId, newName));
    },

    async delete(projectId) {
      await run(() => deleteProjectCore(projectId));
    },
  };
}
