// Last Updated: 2026-07-26

/**
 * @module store/transport/native-preferences-backend
 *
 * **ADR-021 Phase 2 (Task 4).** The in-process implementation of
 * {@link PreferencesTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/project/preferences')`/`fetch('/api/project/revision-settings')`,
 * it invokes the *same* transport-agnostic project preferences core the HTTP
 * routes use (`lib/models/project-preferences-core.ts`). There is no server
 * and no HTTP — the exact same business logic runs directly in the WebView
 * process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/preferences.ts`'s dynamic import), because it pulls in the
 * server-side preferences core and storage layer, which must never enter
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
 * **`savePreferences` fire-and-forget parity.** The HTTP transport's
 * `savePreferences` never inspects `fetch`'s response — a failed request
 * resolves silently. This backend preserves that by swallowing any error
 * the core throws, rather than rejecting.
 *
 * **`saveRevisionSettings` throw-on-failure parity.** The HTTP transport's
 * `saveRevisionSettings` throws on `!response.ok`, with the error message
 * read from the response body. This backend preserves that by letting the
 * core's thrown error (or a generic fallback message, matching the HTTP
 * transport's `body?.error ?? "Failed to save default revision name."`
 * fallback) propagate to the caller.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import {
  saveProjectPreferencesCore,
  saveRevisionSettingsCore,
} from "../../lib/models/project-preferences-core";
import type { PreferencesTransport } from "../../lib/api/preferences";

/**
 * Builds the in-process preferences transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativePreferencesTransport(
  deps: NativeBackendDeps = {},
): PreferencesTransport {
  const run = createNativeRunner(deps);

  return {
    async savePreferences(projectId, preferences) {
      await run(async () => {
        try {
          await saveProjectPreferencesCore(projectId, preferences);
        } catch {
          // Mirrors the HTTP transport's fire-and-forget parity: a failed
          // save resolves silently rather than rejecting.
        }
      });
    },

    async saveRevisionSettings(projectId, defaultRevisionName) {
      return run(async () => {
        try {
          const saved = await saveRevisionSettingsCore(
            projectId,
            defaultRevisionName,
          );
          return { defaultRevisionName: saved };
        } catch (error) {
          // Mirrors the HTTP transport's throw-on-failure parity, including
          // its generic fallback message when the underlying error has no
          // message of its own.
          throw new Error(
            error instanceof Error && error.message
              ? error.message
              : "Failed to save default revision name.",
          );
        }
      });
    },
  };
}
