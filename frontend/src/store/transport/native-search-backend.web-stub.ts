// Last Updated: 2026-07-25

/**
 * @module store/transport/native-search-backend.web-stub
 *
 * **ADR-021 seam — web-build substitute.** Turbopack cannot statically prove
 * that `search-transport.ts`'s `await import("./native-search-backend")`
 * branch is unreachable in the hosted/desktop build (the branch's guard is a
 * runtime env comparison, and Turbopack resolves dynamic `import()` targets
 * into the module graph regardless of surrounding control flow — see
 * `frontend/next.config.mjs`'s `turbopack.resolveAlias` entry that points the
 * literal specifier `./native-search-backend` at this file for `next build`/
 * `next dev`). The real `native-search-backend.ts` transitively imports
 * `node:fs`, `node:path`, and `node:async_hooks` via the shared search core
 * and storage layer, none of which Turbopack's client/SSR chunking context
 * supports — hence the substitution.
 *
 * This stub is never actually invoked: `resolveSearchTransport()` only calls
 * into the native branch when `NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`,
 * which is never true for the hosted/desktop builds this alias applies to.
 * It exists solely to give Turbopack a real, `node:*`-free module to resolve
 * in place of the native backend, satisfying the same export shape.
 *
 * Tests and `tsc` resolve the *real* `native-search-backend.ts` directly
 * (this alias is a Turbopack-only resolution rule, not a TypeScript path or
 * module remap), so this stub does not affect type coverage or test
 * behavior — see `frontend/tests/unit/transport-collapse.spike.test.ts` and
 * `frontend/tests/unit/native-search-backend-web-exclusion.test.ts`.
 */
import type { SearchTransport } from "./search-transport";

/**
 * Same export shape as the real module's factory, so Turbopack's substitute
 * module is structurally compatible. Throws if ever actually reached, which
 * would only happen if the build-time exclusion above stopped applying.
 */
export function createNativeSearchTransport(): SearchTransport {
  throw new Error(
    "native-search-backend.web-stub: the native search transport was " +
      "reached in a web/desktop build. This stub replaces the real native " +
      "backend via next.config.mjs's turbopack.resolveAlias and should " +
      "never be invoked — see this file's module doc.",
  );
}
