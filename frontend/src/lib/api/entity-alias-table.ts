/**
 * @module api/entity-alias-table
 *
 * Client transport for the project's entity alias table (`specs/features/
 * entity-highlighting.md`, Task 4): every declared entity's matchable terms
 * (name + aliases) plus which normalized terms are claimed by more than one
 * entity (FR-14). Degrades gracefully: any failure yields the empty table
 * `{ entities: {}, claimedBy: {} }`, matching how `lib/api/mentions.ts`
 * degrades on read failure.
 */
import { createTransport } from "../../store/transport/create-transport";
import type { EntityAliasTable } from "../models/entity-alias-table";

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021)
//
// One EntityAliasTableTransport contract with two implementations selected
// by the build-time runtime, mirroring lib/api/mentions.ts:
//
// - Web/hosted/desktop -> httpEntityAliasTableTransport, which carries the
//   original `fetch(...)` call against the Task 3 HTTP route.
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-entity-alias-table-backend`), dynamically
//   imported only when `runtime === "native"`, reusing the shared
//   `buildEntityAliasTable` (`../models/entity-alias-table.ts`) instead of
//   HTTP. That native backend is a later task (Task 5) and does not exist
//   yet — this module only reserves its literal specifier.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The entity-alias-table-route-backed operation both platforms implement.
 * Shared with `../../store/transport/native-entity-alias-table-backend`
 * (Task 5), which will import this type rather than duplicating it.
 */
export interface EntityAliasTableTransport {
  /**
   * Fetches the project's entity alias table. Degrades gracefully: any
   * failure yields `{ entities: {}, claimedBy: {} }` rather than throwing.
   */
  getEntityAliasTable(projectId: string): Promise<EntityAliasTable>;
}

/** The empty alias table returned on any read failure. */
const EMPTY_ALIAS_TABLE: EntityAliasTable = { entities: {}, claimedBy: {} };

/**
 * HTTP transport — the hosted/desktop path. The method body below is the
 * original `fetch` call against the Task 3 route, including a
 * degrade-gracefully try/catch.
 */
export const httpEntityAliasTableTransport: EntityAliasTableTransport = {
  async getEntityAliasTable(projectId) {
    try {
      const response = await fetch(
        `/api/project/${encodeURIComponent(projectId)}/entity-alias-table`,
      );
      if (!response.ok) return EMPTY_ALIAS_TABLE;
      return (await response.json()) as EntityAliasTable;
    } catch {
      return EMPTY_ALIAS_TABLE;
    }
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-entity-alias-table-backend")`
 * specifier so Turbopack's `resolveAlias` (`next.config.mjs`) can substitute
 * a `node:*`-free web-stub for it at build time.
 */
export const resolveEntityAliasTableTransport: () => Promise<EntityAliasTableTransport> =
  createTransport(httpEntityAliasTableTransport, () =>
    import("../../store/transport/native-entity-alias-table-backend").then(
      ({ createNativeEntityAliasTableTransport }) =>
        createNativeEntityAliasTableTransport(),
    ),
  );

/**
 * Fetches the project's entity alias table (FR-14).
 *
 * @param projectId - The project's on-disk directory basename.
 * @returns The alias table, or `{ entities: {}, claimedBy: {} }` on any
 *   failure.
 */
export async function getEntityAliasTable(
  projectId: string,
): Promise<EntityAliasTable> {
  const transport = await resolveEntityAliasTableTransport();
  return transport.getEntityAliasTable(projectId);
}
