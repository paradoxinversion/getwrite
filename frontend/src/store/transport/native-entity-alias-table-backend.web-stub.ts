/**
 * @module store/transport/native-entity-alias-table-backend.web-stub
 *
 * **ADR-021 seam — web-build substitute.** Mirrors
 * `native-mentions-backend.web-stub.ts`. Turbopack cannot statically prove
 * that `lib/api/entity-alias-table.ts`'s
 * `await import("../../store/transport/native-entity-alias-table-backend")`
 * branch is unreachable in the hosted/desktop build (the branch's guard is
 * a runtime env comparison, and Turbopack resolves dynamic `import()`
 * targets into the module graph regardless of surrounding control flow).
 * The real `native-entity-alias-table-backend.ts` transitively imports
 * `node:path` and the storage layer via the shared alias-table model, none
 * of which Turbopack's client/SSR chunking context supports — hence the
 * substitution.
 *
 * This stub is never actually invoked: `resolveEntityAliasTableTransport()`
 * only calls into the native branch when
 * `NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`, which is never true for the
 * hosted/desktop builds this alias applies to. It exists solely to give
 * Turbopack a real, `node:*`-free module to resolve in place of the native
 * backend, satisfying the same export shape.
 *
 * Tests and `tsc` resolve the *real* `native-entity-alias-table-backend.ts`
 * directly (this alias is a Turbopack-only resolution rule, not a
 * TypeScript path or module remap), so this stub does not affect type
 * coverage or test behavior.
 *
 * **Wiring note (entity-highlighting Task 5):** this file exists ahead of
 * Task 5 to keep it structurally consistent with the real backend created
 * in Task 4, but the `next.config.mjs` `turbopack.resolveAlias` entry that
 * actually substitutes it in for the literal specifier
 * `../../store/transport/native-entity-alias-table-backend` still needs to
 * be added by Task 5 — see that task's "Done when".
 */
import type { EntityAliasTableTransport } from "../../lib/api/entity-alias-table";

/**
 * Same export shape as the real module's factory, so Turbopack's substitute
 * module is structurally compatible. Throws if ever actually reached, which
 * would only happen if the build-time exclusion above stopped applying.
 */
export function createNativeEntityAliasTableTransport(): EntityAliasTableTransport {
  throw new Error(
    "native-entity-alias-table-backend.web-stub: the native entity-alias-" +
      "table transport was reached in a web/desktop build. This stub " +
      "replaces the real native backend via next.config.mjs's " +
      "turbopack.resolveAlias and should never be invoked — see this " +
      "file's module doc.",
  );
}
