// Last Updated: 2026-07-26

/**
 * @module store/transport/native-compile-backend
 *
 * **ADR-021 Phase 2 (Task 5).** The in-process implementation of
 * {@link CompileTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/compile/pdf')`/`docx`/`text`/`markdown`, it invokes the
 * *same* transport-agnostic compile core the HTTP routes use
 * (`lib/models/compile-core.ts`). There is no server and no HTTP — the exact
 * same rendering logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `lib/api/compile.ts`'s dynamic import), because it pulls in the
 * server-side compile core and storage layer, which must never enter the
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
 * **No header parsing.** Unlike the HTTP transport, which parses
 * `Content-Disposition`/`X-Compile-Warning` headers out of a `Response`,
 * `compile-core.ts`'s functions already return the normalized
 * `{arrayBuffer/text/markdown, filename, ...}` shape directly (FR1) — this
 * backend just forwards it, and lets any thrown error (including an invalid
 * `projectId`) propagate to the caller, since there is no HTTP status code
 * to translate.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import {
  compileDocxCore,
  compileMarkdownCore,
  compilePdfCore,
  compileTextCore,
} from "../../lib/models/compile-core";
import type { CompileTransport } from "../../lib/api/compile";

/**
 * Builds the in-process compile transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeCompileTransport(
  deps: NativeBackendDeps = {},
): CompileTransport {
  const run = createNativeRunner(deps);

  return {
    async pdf(body) {
      return run(() => compilePdfCore(body));
    },
    async docx(body) {
      return run(() => compileDocxCore(body));
    },
    async text(body) {
      return run(() => compileTextCore(body));
    },
    async markdown(body) {
      return run(() => compileMarkdownCore(body));
    },
  };
}
