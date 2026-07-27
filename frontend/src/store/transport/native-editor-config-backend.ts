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
 * **Storage context binding.** Every operation runs through the shared
 * `createNativeRunner(deps)` helper (`native-runner.ts`): `deps.fs` (tests)
 * binds a one-off {@link runInStorageContext} scope over the injected fake;
 * in production it awaits the memoized native bootstrap
 * (`ensureNativeStorageContext()` — context bound + projects dir created) and
 * resolves against the ambient default {@link StorageContext}, with no
 * per-operation rebinding.
 *
 * **Throw-on-failure parity.** Both HTTP transport methods
 * (`saveHeadings`/`saveBody`) throw on `!response.ok`, with the error
 * message read from the response body (falling back to a method-specific
 * generic message). This backend preserves that by letting the core's
 * thrown error (or the same fallback message) propagate to the caller —
 * both methods route through the same `updateEditorConfigCore`, mirroring
 * the route's single-handler-for-both-shapes design.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import { updateEditorConfigCore } from "../../lib/models/editor-config-core";
import type { EditorConfigTransport } from "../../lib/api/editor-config";

/**
 * Builds the in-process editor-config transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeEditorConfigTransport(
  deps: NativeBackendDeps = {},
): EditorConfigTransport {
  const run = createNativeRunner(deps);

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
