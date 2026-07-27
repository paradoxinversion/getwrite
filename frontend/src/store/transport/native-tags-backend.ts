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
 * **Storage context binding.** Mirrors `native-project-backend.ts`:
 * `deps.fs` is a test-injection seam — when supplied, this module binds a
 * fresh, one-off {@link runInStorageContext} scope for that call. In
 * production, `deps.fs` is omitted and the ambient default
 * {@link StorageContext} installed once by `native-bootstrap.ts` is used
 * instead, with no per-operation rebinding. `nativeFilesystem()` remains a
 * defensive fallback for the (unsupported) case where no bootstrap has run
 * yet.
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
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { createRealCapacitorFilesystem } from "../../lib/models/capacitor-filesystem-real";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import {
  getStorageContext,
  runInStorageContext,
} from "../../lib/models/storage-context";
import { ensureNativeStorageContext } from "../../lib/models/native-bootstrap";
import {
  assignTagCore,
  createTagCore,
  deleteTagCore,
  listTagAssignmentsCore,
  listTagsCore,
} from "../../lib/models/tags-crud-core";
import type { TagsTransport } from "../../lib/api/tags";

/** Injectable dependencies — omitted in production, supplied by tests. */
export interface NativeTagsDeps {
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
 * Builds the in-process tags transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeTagsTransport(
  deps: NativeTagsDeps = {},
): TagsTransport {
  const projectsDir = deps.projectsDir ?? "/projects";

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (deps.fs) {
      // Explicit test injection: bind a fresh, one-off context for this
      // call only, matching how the project native backend tests exercise
      // this transport standalone, without any global native bootstrap
      // having run.
      const adapter = capacitorFsAdapter(deps.fs);
      return runInStorageContext({ tenantRoot: projectsDir, adapter }, fn);
    }

    // ADR-021 Phase 2: gate the production path on native bootstrap completing
    // (default context bound + projects dir created). A data fetch that races
    // ahead of app-startup bootstrap awaits that one memoized bootstrap here
    // instead of hitting an unbootstrapped filesystem — closing the
    // bootstrap-vs-first-fetch race. Never re-runs (memoized).
    await ensureNativeStorageContext();

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
