// Last Updated: 2026-07-26

/**
 * @module store/transport/native-project-types-backend.web-stub
 *
 * **ADR-021 seam — web-build substitute.** Mirrors
 * `native-project-backend.web-stub.ts`. Turbopack cannot statically prove
 * that `lib/api/project-types.ts`'s
 * `await import("../../store/transport/native-project-types-backend")`
 * branch is unreachable in the hosted/desktop build (the branch's guard is
 * a runtime env comparison, and Turbopack resolves dynamic `import()`
 * targets into the module graph regardless of surrounding control flow —
 * see `frontend/next.config.mjs`'s `turbopack.resolveAlias` entry that
 * points the literal specifier
 * `../../store/transport/native-project-types-backend` at this file for
 * `next build`/`next dev`).
 *
 * The real `native-project-types-backend.ts` is itself `node:*`-free (the
 * static registry it wraps has zero filesystem access), but this
 * substitution still applies for consistency with every other native
 * backend's exclusion mechanism and to keep the dynamic-import discipline
 * uniform across the transport-collapse seam.
 *
 * This stub is never actually invoked: `resolveProjectTypesTransport()`
 * only calls into the native branch when
 * `NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`, which is never true for the
 * hosted/desktop builds this alias applies to.
 *
 * Tests and `tsc` resolve the *real* `native-project-types-backend.ts`
 * directly (this alias is a Turbopack-only resolution rule, not a
 * TypeScript path or module remap), so this stub does not affect type
 * coverage or test behavior.
 */
import type { ProjectTypesTransport } from "../../lib/api/project-types";

/**
 * Same export shape as the real module's factory, so Turbopack's substitute
 * module is structurally compatible. Throws if ever actually reached, which
 * would only happen if the build-time exclusion above stopped applying.
 */
export function createNativeProjectTypesTransport(): ProjectTypesTransport {
  throw new Error(
    "native-project-types-backend.web-stub: the native project-types " +
      "transport was reached in a web/desktop build. This stub replaces " +
      "the real native backend via next.config.mjs's " +
      "turbopack.resolveAlias and should never be invoked — see this " +
      "file's module doc.",
  );
}
