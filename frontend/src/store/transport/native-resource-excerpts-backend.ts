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
 * **Storage context binding.** Mirrors `native-resource-backend.ts`:
 * `deps.fs` is a test-injection seam — when supplied, this module binds a
 * fresh, one-off {@link runInStorageContext} scope for that call. In
 * production, `deps.fs` is omitted and the ambient default
 * {@link StorageContext} installed once by `native-bootstrap.ts` is used
 * instead, with no per-operation rebinding. `nativeFilesystem()` remains a
 * defensive fallback for the (unsupported) case where no bootstrap has run
 * yet.
 *
 * **Degrade-gracefully parity.** The HTTP transport's `fetch` never throws —
 * any failure (network, non-2xx, malformed body) yields `{}`. This backend
 * mirrors that: any error from the excerpts core (including an invalid
 * `projectId`) is swallowed and resolves to `{}`, matching
 * `lib/api/resource-excerpts.ts`'s original `fetchResourceExcerpts` body.
 */
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { createRealCapacitorFilesystem } from "../../lib/models/capacitor-filesystem-real";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import {
  getStorageContext,
  runInStorageContext,
} from "../../lib/models/storage-context";
import { fetchResourceExcerptsCore } from "../../lib/models/resource-excerpts-core";
import type { ResourceExcerptsTransport } from "../../lib/api/resource-excerpts";

/** Injectable dependencies — omitted in production, supplied by tests. */
export interface NativeResourceExcerptsDeps {
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
 * Builds the in-process resource-excerpts transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeResourceExcerptsTransport(
  deps: NativeResourceExcerptsDeps = {},
): ResourceExcerptsTransport {
  const projectsDir = deps.projectsDir ?? "/projects";

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (deps.fs) {
      // Explicit test injection: bind a fresh, one-off context for this
      // call only, matching how the other native backend tests exercise
      // their transports standalone, without any global native bootstrap
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
