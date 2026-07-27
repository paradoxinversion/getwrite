// Last Updated: 2026-07-26

/**
 * @module store/transport/native-tags-backend.web-stub
 *
 * **ADR-021 seam — web-build substitute.** Mirrors
 * `native-project-backend.web-stub.ts`. Turbopack cannot statically prove
 * that `lib/api/tags.ts`'s
 * `await import("../../store/transport/native-tags-backend")` branch is
 * unreachable in the hosted/desktop build (the branch's guard is a runtime
 * env comparison, and Turbopack resolves dynamic `import()` targets into the
 * module graph regardless of surrounding control flow — see
 * `frontend/next.config.mjs`'s `turbopack.resolveAlias` entry that points
 * the literal specifier `../../store/transport/native-tags-backend` at this
 * file for `next build`/`next dev`). The real `native-tags-backend.ts`
 * transitively imports `node:path` and the storage layer via the shared
 * tags CRUD core, none of which Turbopack's client/SSR chunking context
 * supports — hence the substitution.
 *
 * This stub is never actually invoked: `resolveTagsTransport()` only calls
 * into the native branch when `NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`,
 * which is never true for the hosted/desktop builds this alias applies to.
 * It exists solely to give Turbopack a real, `node:*`-free module to resolve
 * in place of the native backend, satisfying the same export shape.
 *
 * Tests and `tsc` resolve the *real* `native-tags-backend.ts` directly (this
 * alias is a Turbopack-only resolution rule, not a TypeScript path or module
 * remap), so this stub does not affect type coverage or test behavior.
 */
import type { TagsTransport } from "../../lib/api/tags";

/**
 * Same export shape as the real module's factory, so Turbopack's substitute
 * module is structurally compatible. Throws if ever actually reached, which
 * would only happen if the build-time exclusion above stopped applying.
 */
export function createNativeTagsTransport(): TagsTransport {
  throw new Error(
    "native-tags-backend.web-stub: the native tags transport was reached " +
      "in a web/desktop build. This stub replaces the real native backend " +
      "via next.config.mjs's turbopack.resolveAlias and should never be " +
      "invoked — see this file's module doc.",
  );
}
