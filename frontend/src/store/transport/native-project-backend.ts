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
 * **Storage context binding.** Mirrors `native-revision-backend.ts`:
 * `deps.fs` is a test-injection seam — when supplied, this module binds a
 * fresh, one-off {@link runInStorageContext} scope for that call. In
 * production, `deps.fs` is omitted and the ambient default
 * {@link StorageContext} installed once by `native-bootstrap.ts` (FR2) is
 * used instead, with no per-operation rebinding. `nativeFilesystem()`
 * remains a defensive fallback for the (unsupported) case where no bootstrap
 * has run yet.
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
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { createRealCapacitorFilesystem } from "../../lib/models/capacitor-filesystem-real";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import {
  getStorageContext,
  runInStorageContext,
} from "../../lib/models/storage-context";
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

/** Injectable dependencies — omitted in production, supplied by tests. */
export interface NativeProjectDeps {
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
 * Builds the in-process projects transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeProjectsTransport(
  deps: NativeProjectDeps = {},
): ProjectsTransport {
  const projectsDir = deps.projectsDir ?? "/projects";

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (deps.fs) {
      // Explicit test injection: bind a fresh, one-off context for this
      // call only, matching how the revision native backend tests exercise
      // this transport standalone, without any global native bootstrap
      // having run.
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
