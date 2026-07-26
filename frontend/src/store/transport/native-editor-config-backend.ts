// Last Updated: 2026-07-26

/**
 * @module store/transport/native-editor-config-backend
 *
 * **ADR-021 Phase 2 (Task 4).** The in-process implementation of
 * {@link EditorConfigTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/project/editor-config')`, it invokes the *same*
 * transport-agnostic editor config core the HTTP route uses
 * (`lib/models/editor-config-core.ts`). There is no server and no HTTP —
 * the exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/editor-config.ts`'s dynamic import), because it pulls in the
 * server-side editor config core and storage layer, which must never enter
 * the web client bundle.
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
 * **Throw-on-failure parity.** Both HTTP transport methods
 * (`saveHeadings`/`saveBody`) throw on `!response.ok`, with the error
 * message read from the response body (falling back to a method-specific
 * generic message). This backend preserves that by letting the core's
 * thrown error (or the same fallback message) propagate to the caller —
 * both methods route through the same `updateEditorConfigCore`, mirroring
 * the route's single-handler-for-both-shapes design.
 */
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { createRealCapacitorFilesystem } from "../../lib/models/capacitor-filesystem-real";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import {
  getStorageContext,
  runInStorageContext,
} from "../../lib/models/storage-context";
import { updateEditorConfigCore } from "../../lib/models/editor-config-core";
import type { EditorConfigTransport } from "../../lib/api/editor-config";

/** Injectable dependencies — omitted in production, supplied by tests. */
export interface NativeEditorConfigDeps {
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
 * Builds the in-process editor-config transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeEditorConfigTransport(
  deps: NativeEditorConfigDeps = {},
): EditorConfigTransport {
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
    async saveHeadings(projectId, headings) {
      return run(async () => {
        try {
          return await updateEditorConfigCore({ projectId, headings });
        } catch (error) {
          throw new Error(
            error instanceof Error && error.message
              ? error.message
              : "Failed to save heading settings.",
          );
        }
      });
    },

    async saveBody(projectId, body) {
      return run(async () => {
        try {
          return await updateEditorConfigCore({ projectId, body });
        } catch (error) {
          throw new Error(
            error instanceof Error && error.message
              ? error.message
              : "Failed to save body settings.",
          );
        }
      });
    },
  };
}
