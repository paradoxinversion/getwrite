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
 * **Storage context binding.** Mirrors `native-project-backend.ts`:
 * `deps.fs` is a test-injection seam — when supplied, this module binds a
 * fresh, one-off {@link runInStorageContext} scope for that call. In
 * production, `deps.fs` is omitted and the ambient default
 * {@link StorageContext} installed once by `native-bootstrap.ts` is used
 * instead, with no per-operation rebinding. `nativeFilesystem()` remains a
 * defensive fallback for the (unsupported) case where no bootstrap has run
 * yet.
 *
 * **No header parsing.** Unlike the HTTP transport, which parses
 * `Content-Disposition`/`X-Compile-Warning` headers out of a `Response`,
 * `compile-core.ts`'s functions already return the normalized
 * `{arrayBuffer/text/markdown, filename, ...}` shape directly (FR1) — this
 * backend just forwards it, and lets any thrown error (including an invalid
 * `projectId`) propagate to the caller, since there is no HTTP status code
 * to translate.
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
  compileDocxCore,
  compileMarkdownCore,
  compilePdfCore,
  compileTextCore,
} from "../../lib/models/compile-core";
import type { CompileTransport } from "../../lib/api/compile";

/** Injectable dependencies — omitted in production, supplied by tests. */
export interface NativeCompileDeps {
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
 * Builds the in-process compile transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeCompileTransport(
  deps: NativeCompileDeps = {},
): CompileTransport {
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
