// Last Updated: 2026-07-26

/**
 * @module store/transport/native-export-backend
 *
 * **ADR-021 Phase 2 (Task 5).** The in-process implementation of
 * {@link ExportTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/export/text')`/`fetch('/api/export/markdown')`, it invokes
 * the *same* transport-agnostic export core the HTTP routes use
 * (`lib/models/export-core.ts`). There is no server and no HTTP — the exact
 * same logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/export.ts`'s dynamic import), because it pulls in the
 * server-side export core and storage layer, which must never enter the
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
 * **No JSON round-trip.** Unlike the HTTP transport, which parses a `Response`
 * body, `export-core.ts`'s functions already return the result shape
 * directly (FR1) — this backend just forwards it, and lets any thrown error
 * (including an invalid `projectId`) propagate to the caller.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import {
  exportMarkdownCore,
  exportTextCore,
} from "../../lib/models/export-core";
import type { ExportTransport } from "../../lib/api/export";

/**
 * Builds the in-process export transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeExportTransport(
  deps: NativeBackendDeps = {},
): ExportTransport {
  const run = createNativeRunner(deps);

  return {
    async text(body) {
      return run(() => exportTextCore(body));
    },
    async markdown(body) {
      return run(() => exportMarkdownCore(body));
    },
  };
}
