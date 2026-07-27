"use client";

/**
 * @module NativeBootstrap
 *
 * **ADR-021 Phase 2 (FR6).** Client-side call site for
 * `bootstrapNativeStorageContext()` (`src/lib/models/native-bootstrap.ts`,
 * introduced in Phase 0 but never wired to a call site until now).
 *
 * Why a client component and not a direct call in the root layout's server
 * component body: `bootstrapNativeStorageContext()` dynamically imports the
 * real `@capacitor/filesystem` plugin, which only exists inside the
 * Capacitor WebView at runtime on-device — it is not available (and must
 * never run) during `next build`'s static export/prerender step, which
 * happens in a plain Node process with no WebView. The native build is also
 * a static export (`output: "export"`, see `next.config.mjs`), so there is
 * no Next server on device to await anything in a server component body
 * against in the first place — "app startup" for a WebView-hosted static
 * export is effectively page load / hydration time on the client. Mounting
 * this as a client component with a `useEffect` that fires once on mount is
 * therefore the correct call site: it runs exactly when the exported HTML
 * hydrates in the WebView, never during the Node-side build.
 *
 * Guarded twice against ever entering the web/desktop bundle's module graph:
 * 1. The `useEffect` body's own runtime check
 *    (`NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`) — a build-time-inlined
 *    literal, so it's dead code on web/desktop.
 * 2. The `import("../../src/lib/models/native-bootstrap")` call is a
 *    *dynamic* import (never static), matching the dynamic-import-only
 *    discipline `native-search-backend.ts` and its sibling native transport
 *    backends established in Phases 0–1. Turbopack still resolves dynamic
 *    `import()` targets into the module graph regardless of the surrounding
 *    runtime guard's reachability, so `next.config.mjs`'s
 *    `turbopack.resolveAlias` carries an entry substituting a `node:*`-free
 *    stub (`native-bootstrap.web-stub.ts`) for this exact specifier on
 *    web/desktop builds — the same pattern as every other native backend's
 *    web-stub.
 *
 * `bootstrapNativeStorageContext()` is itself idempotent-guarded (a
 * module-scoped memoized `bootstrapPromise`), so this component being mounted
 * for the lifetime of the root layout (it never unmounts on client-side
 * navigation, since the root layout doesn't remount between routes) never
 * re-runs a successful bootstrap. A *failed* bootstrap is not memoized, so the
 * first native transport call's `ensureNativeStorageContext()` gate retries it.
 */
import { useEffect } from "react";

/**
 * Mounts once under the root layout on the native runtime and calls
 * {@link bootstrapNativeStorageContext} exactly once, at hydration time.
 *
 * @returns `null` — this component only performs a side effect.
 */
export default function NativeBootstrap(): null {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_GETWRITE_RUNTIME !== "native") {
      return;
    }

    void import("../../src/lib/models/native-bootstrap")
      .then(({ bootstrapNativeStorageContext }) =>
        bootstrapNativeStorageContext(),
      )
      .catch(() => {
        // Warm-start only. A failure here is not fatal: it clears the memo (see
        // native-bootstrap.ts), so the first native transport call's
        // ensureNativeStorageContext() gate retries lazily. Swallow to avoid an
        // unhandled promise rejection.
      });
  }, []);

  return null;
}
