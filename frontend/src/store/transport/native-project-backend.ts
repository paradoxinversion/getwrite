// Last Updated: 2026-07-26

/**
 * @module store/transport/native-project-backend
 *
 * **ADR-021 Phase 2 (Task 2).** The in-process implementation of
 * {@link ProjectsTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/projects')`/`fetch('/api/project')`/etc., it invokes the
 * *same* transport-agnostic project CRUD core the HTTP routes use
 * (`lib/models/project-crud-core.ts`). There is no server and no HTTP — the
 * exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/projects.ts`'s dynamic import), because it pulls in the
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
 *
 * **`reindex` fire-and-forget parity.** The HTTP transport's `reindex`
 * never inspects `fetch`'s response — a failed or 404 reindex resolves
 * silently, matching `lib/api/projects.ts`'s original `reindexProject`
 * body and its `void reindexProject(...)` call site
 * (`components/SearchBar/SearchBar.tsx`). This backend preserves that by
 * swallowing any error the core throws, rather than rejecting.
 *
 * **`create` divergence (ADR-021 Phase 2, Task 5, FR15).** `create` calls
 * `createProjectCoreNative`, not `createProjectCore` — the HTTP-path core
 * resolves `projectType` via `getProjectType`'s `node:fs` scan of a
 * repo-relative template directory that does not exist on-device.
 * `createProjectCoreNative` is byte-for-byte the same otherwise, resolving
 * `projectType` from the static, build-time-imported template registry
 * (`lib/models/project-types-static.ts`) instead. See that function's doc
 * comment in `project-crud-core.ts` for the full rationale.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import {
  createProjectCoreNative,
  listProjectsCore,
  loadProjectCore,
  reindexProjectByInternalIdCore,
} from "../../lib/models/project-crud-core";
import type {
  ProjectApiEntry,
  ProjectsTransport,
} from "../../lib/api/projects";

/**
 * Builds the in-process projects transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeProjectsTransport(
  deps: NativeBackendDeps = {},
): ProjectsTransport {
  const run = createNativeRunner(deps);

  return {
    async list() {
      return run(async () => {
        const entries = await listProjectsCore();
        return entries as unknown as ProjectApiEntry[];
      });
    },

    async open(projectId) {
      return run(async () => {
        const loaded = await loadProjectCore(projectId);
        return loaded as unknown as ProjectApiEntry;
      });
    },

    async create(name, projectType) {
      return run(async () => {
        // ADR-021 Phase 2 (Task 5, FR15): uses the native-safe static
        // template registry (`project-types-static.ts`) rather than
        // `createProjectCore`, which resolves `projectType` via
        // `getProjectType`'s `node:fs` scan of a repo-relative directory
        // that does not exist on-device. See `createProjectCoreNative`'s
        // doc comment for the full rationale.
        const result = await createProjectCoreNative(name, projectType);
        return result as unknown as ProjectApiEntry;
      });
    },

    async reindex(projectId) {
      await run(async () => {
        try {
          await reindexProjectByInternalIdCore(projectId);
        } catch {
          // Mirrors the HTTP transport's fire-and-forget parity: a failed
          // or not-found reindex resolves silently rather than rejecting.
        }
      });
    },
  };
}
