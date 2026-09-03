/**
 * @module entityAliasTableSlice
 *
 * Client-side cache of the active project's entity alias table
 * (`specs/features/entity-highlighting.md`, Task 6). Holds the most recently
 * fetched `EntityAliasTable` (Task 4's `getEntityAliasTable` transport) so
 * the entity-highlighting decoration extension (Task 9) can read it without
 * re-fetching on every keystroke.
 *
 * Per FR-12/OQ-4, this cache is refreshed only by an explicit refetch —
 * there is no server-side push signal (no `metadataRevision`-based counter
 * is read or written here). The three refetch triggers are wired at their
 * call sites, not in this module:
 *
 * 1. Project load — `projectsSlice.ts`'s `loadProject` thunk.
 * 2. Resource load — `resourcesSlice.ts`'s `loadResources` thunk.
 * 3. A resolved `updateSidecar` call from `EntitySection.tsx`'s save path.
 *
 * This intentionally does not compensate for cross-tab staleness (e.g. via
 * `storage` events) — an accepted limitation per OQ-4.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getEntityAliasTable } from "../lib/api/entity-alias-table";
import type { EntityAliasTable } from "../lib/models/entity-alias-table";

/** The empty alias table used before any successful fetch. */
const EMPTY_ALIAS_TABLE: EntityAliasTable = { entities: {}, claimedBy: {} };

/**
 * State held by this slice: the last-fetched alias table, the project it
 * was fetched for, and the in-flight status of the most recent fetch.
 */
export interface EntityAliasTableState {
  /** The project's on-disk directory basename the cached table belongs to. */
  projectId: string | null;
  /** Cached alias table; the empty table before any fetch resolves. */
  table: EntityAliasTable;
  /** Status of the most recently dispatched fetch. */
  status: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: EntityAliasTableState = {
  projectId: null,
  table: EMPTY_ALIAS_TABLE,
  status: "idle",
};

/**
 * Fetches the alias table for `projectId` via Task 4's transport
 * (`getEntityAliasTable`, which degrades gracefully to the empty table on
 * any failure — this thunk never rejects on a transport-level failure).
 *
 * @param projectId - The project's on-disk directory basename.
 */
export const fetchEntityAliasTable = createAsyncThunk<
  { projectId: string; table: EntityAliasTable },
  string
>("entityAliasTable/fetch", async (projectId) => {
  const table = await getEntityAliasTable(projectId);
  return { projectId, table };
});

const entityAliasTableSlice = createSlice({
  name: "entityAliasTable",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEntityAliasTable.pending, (state) => {
        state.status = "loading";
        return state;
      })
      .addCase(fetchEntityAliasTable.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.projectId = action.payload.projectId;
        state.table = action.payload.table;
        return state;
      })
      .addCase(fetchEntityAliasTable.rejected, (state) => {
        state.status = "failed";
        return state;
      });
  },
});

export default entityAliasTableSlice.reducer;

/**
 * Selects the currently cached entity alias table (the empty table before
 * any fetch has resolved).
 *
 * @param state - Redux root state (typed as `any` to avoid circular
 *   imports, matching the pattern used by other slice selectors in this
 *   store, e.g. `projectsSlice.ts`'s `selectActiveProjectFeatures`).
 */
export const selectEntityAliasTable = (state: any): EntityAliasTable => {
  return state?.entityAliasTable?.table ?? EMPTY_ALIAS_TABLE;
};

/**
 * Selects the project ID the cached alias table was fetched for, or `null`
 * if no fetch has resolved yet.
 *
 * @param state - Redux root state (typed as `any` to avoid circular
 *   imports).
 */
export const selectEntityAliasTableProjectId = (state: any): string | null => {
  return state?.entityAliasTable?.projectId ?? null;
};
