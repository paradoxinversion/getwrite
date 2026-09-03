/**
 * @module store/transport/native-entity-alias-table-backend
 *
 * **entity-highlighting Task 5 seam, created early (Task 4).** The
 * in-process implementation of {@link EntityAliasTableTransport} for a
 * native (Capacitor) build: instead of
 * `fetch('/api/project/:projectId/entity-alias-table')`, it invokes the
 * *same* transport-agnostic model function the HTTP route uses
 * (`lib/models/entity-alias-table.ts`'s `buildEntityAliasTable`). There is
 * no server and no HTTP — the exact same business logic runs directly in
 * the WebView process. Mirrors `native-mentions-backend.ts`'s structure.
 *
 * This module exists now (rather than only in Task 5) because Vite/Turbopack
 * resolve a dynamic `import()`'s literal specifier into the module graph
 * regardless of whether the runtime branch that reaches it is taken — so
 * `lib/api/entity-alias-table.ts`'s dynamic import needs a real module at
 * this path to be transformable at all, including in the web/desktop test
 * suite. Task 5 remains responsible for the `next.config.mjs`
 * `turbopack.resolveAlias` substitution and the formal native/web parity
 * test (`entity-alias-table-transport.test.ts` only covers the HTTP path).
 *
 * This module is imported *only* on the native path (see
 * `lib/api/entity-alias-table.ts`'s dynamic import), because it pulls in
 * the server-side alias-table core and storage layer, which must never
 * enter the web client bundle.
 *
 * **Storage context binding.** Every operation runs through the shared
 * `createNativeRunner(deps)` helper (`native-runner.ts`): `deps.fs` (tests)
 * binds a one-off {@link runInStorageContext} scope over the injected fake;
 * in production it awaits the memoized native bootstrap
 * (`ensureNativeStorageContext()` — context bound + projects dir created)
 * and resolves against the ambient default {@link StorageContext}, with no
 * per-operation rebinding.
 *
 * **Project root resolution.** Like `native-mentions-backend.ts`, this
 * backend resolves `projectId` -> project root itself via the shared
 * `resolveProjectRoot()` (`project-root-resolver.ts`), since
 * `buildEntityAliasTable` takes a project root rather than a `projectId`.
 *
 * **Degrade-gracefully parity.** The HTTP transport's method never
 * throws — any failure (network, non-2xx, malformed body) yields
 * `{ entities: {}, claimedBy: {} }`. This backend mirrors that: any error,
 * including an invalid `projectId`, is swallowed and resolves to the same
 * empty table, matching `lib/api/entity-alias-table.ts`'s HTTP
 * implementation.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import { resolveProjectRoot } from "../../lib/models/project-root-resolver";
import { buildEntityAliasTable } from "../../lib/models/entity-alias-table";
import type { EntityAliasTableTransport } from "../../lib/api/entity-alias-table";

/** The empty alias table returned on any read failure. */
const EMPTY_ALIAS_TABLE = { entities: {}, claimedBy: {} };

/**
 * Builds the in-process entity-alias-table transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeEntityAliasTableTransport(
  deps: NativeBackendDeps = {},
): EntityAliasTableTransport {
  const run = createNativeRunner(deps);

  return {
    async getEntityAliasTable(projectId) {
      return run(async () => {
        try {
          const projectRoot = resolveProjectRoot(projectId);
          if (!projectRoot) return EMPTY_ALIAS_TABLE;
          return await buildEntityAliasTable(projectRoot);
        } catch {
          // Mirrors the HTTP transport's degrade-gracefully parity.
          return EMPTY_ALIAS_TABLE;
        }
      });
    },
  };
}
