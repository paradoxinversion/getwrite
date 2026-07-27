// Last Updated: 2026-07-26

/**
 * @module native-bootstrap.web-stub
 *
 * **ADR-021 Phase 2 — web-build substitute.** Turbopack cannot statically
 * prove that `components/native/NativeBootstrap.tsx`'s
 * `import("../../src/lib/models/native-bootstrap")` branch is unreachable in
 * the hosted/desktop build (the branch's guard is a runtime env comparison,
 * and Turbopack resolves dynamic `import()` targets into the module graph
 * regardless of surrounding control flow — see `frontend/next.config.mjs`'s
 * `turbopack.resolveAlias` entry that points the literal specifier
 * `../../src/lib/models/native-bootstrap` at this file for `next build`/
 * `next dev`). The real `native-bootstrap.ts` transitively imports
 * `capacitor-filesystem-real.ts` and `storage-context.ts`, which pull in
 * `node:async_hooks` (via `storage-context.ts`'s `AsyncLocalStorage` use),
 * unsupported in Turbopack's client/SSR chunking context — hence the
 * substitution. This mirrors the established pattern from
 * `native-search-backend.web-stub.ts` and the Phase 1 transport backends'
 * `.web-stub.ts` siblings.
 *
 * This stub is never actually invoked: `NativeBootstrap.tsx` only reaches
 * the dynamic import when `NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`, which
 * is never true for the hosted/desktop builds this alias applies to. It
 * exists solely to give Turbopack a real, `node:*`-free module to resolve in
 * place of the native bootstrap, satisfying the same export shape.
 *
 * Tests and `tsc` resolve the *real* `native-bootstrap.ts` directly (this
 * alias is a Turbopack-only resolution rule, not a TypeScript path or module
 * remap), so this stub does not affect type coverage or test behavior.
 */

/**
 * Same export shape as the real module's function, so Turbopack's
 * substitute module is structurally compatible. Throws if ever actually
 * reached, which would only happen if the build-time exclusion above
 * stopped applying.
 */
export async function bootstrapNativeStorageContext(): Promise<void> {
  throw new Error(
    "native-bootstrap.web-stub: the native storage-context bootstrap was " +
      "reached in a web/desktop build. This stub replaces the real native " +
      "bootstrap via next.config.mjs's turbopack.resolveAlias and should " +
      "never be invoked — see this file's module doc.",
  );
}

/**
 * Same export shape as the real module's {@link ensureNativeStorageContext}
 * (awaited by native transport backends). Never invoked on web/desktop for the
 * same reason as above.
 */
export const ensureNativeStorageContext = bootstrapNativeStorageContext;
