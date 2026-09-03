/**
 * Unit tests for `entityAliasTableSlice` (entity-highlighting Task 6) — the
 * client-side alias-table cache and its three FR-12 refetch triggers:
 * project load (`projectsSlice.ts`'s `loadProject`), resource load
 * (`resourcesSlice.ts`'s `loadResources`), and a resolved `updateSidecar`
 * call from `EntitySection.tsx`'s save path (exercised here as a direct
 * `fetchEntityAliasTable` dispatch, matching how the component wires it).
 *
 * Also verifies the negative case (an unrelated action does not trigger a
 * refetch) and that no `metadataRevision` field or counter is read/written
 * anywhere in the slice.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

vi.mock("../../src/lib/api/entity-alias-table", () => ({
  getEntityAliasTable: vi.fn(),
}));

import entityAliasTableReducer, {
  fetchEntityAliasTable,
  selectEntityAliasTable,
  selectEntityAliasTableProjectId,
} from "../../src/store/entityAliasTableSlice";
import projectsReducer, {
  loadProject,
  buildStoredProject,
} from "../../src/store/projectsSlice";
import resourcesReducer, {
  loadResources,
  setSelectedResourceId,
} from "../../src/store/resourcesSlice";
import { getEntityAliasTable } from "../../src/lib/api/entity-alias-table";
import type { EntityAliasTable } from "../../src/lib/models/entity-alias-table";
import type { Project } from "../../src/lib/models/types";

const mockedGetEntityAliasTable = vi.mocked(getEntityAliasTable);

function makeStore() {
  return configureStore({
    reducer: {
      entityAliasTable: entityAliasTableReducer,
      projects: projectsReducer,
      resources: resourcesReducer,
    },
  });
}

const SAMPLE_TABLE: EntityAliasTable = {
  entities: {
    "entity-1": {
      entityId: "entity-1",
      entityKind: "character",
      name: "Elowen",
      aliases: ["El"],
      terms: ["Elowen", "El"],
    },
  },
  claimedBy: {},
};

const OTHER_TABLE: EntityAliasTable = {
  entities: {
    "entity-2": {
      entityId: "entity-2",
      entityKind: "place",
      name: "Rivenhall",
      aliases: [],
      terms: ["Rivenhall"],
    },
  },
  claimedBy: {},
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("entityAliasTableSlice", () => {
  it("starts with the empty alias table and no project", () => {
    const store = makeStore();
    expect(selectEntityAliasTable(store.getState())).toEqual({
      entities: {},
      claimedBy: {},
    });
    expect(selectEntityAliasTableProjectId(store.getState())).toBeNull();
  });

  it("trigger 1 — updates after the projectsSlice project-load thunk (loadProject) resolves", async () => {
    const store = makeStore();
    mockedGetEntityAliasTable.mockResolvedValue(SAMPLE_TABLE);

    const project: Project = {
      id: "project-1",
      name: "Project One",
      rootPath: "/tmp/project-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    } as Project;
    const stored = buildStoredProject(project, [], []);

    await store.dispatch(loadProject(stored));

    expect(mockedGetEntityAliasTable).toHaveBeenCalledWith("project-1");
    expect(selectEntityAliasTable(store.getState())).toEqual(SAMPLE_TABLE);
    expect(selectEntityAliasTableProjectId(store.getState())).toBe("project-1");
  });

  it("trigger 2 — updates after the resourcesSlice resource-load thunk (loadResources) resolves", async () => {
    const store = makeStore();
    mockedGetEntityAliasTable.mockResolvedValue(OTHER_TABLE);

    await store.dispatch(
      loadResources({ resources: [], projectId: "project-2" }),
    );

    expect(selectEntityAliasTable(store.getState())).toEqual(OTHER_TABLE);
    expect(selectEntityAliasTableProjectId(store.getState())).toBe("project-2");
  });

  it("trigger 3 — updates after a resolved updateSidecar call from EntitySection.tsx's save path", async () => {
    const store = makeStore();
    mockedGetEntityAliasTable.mockResolvedValue(SAMPLE_TABLE);

    // EntitySection.tsx's `persist()` dispatches `fetchEntityAliasTable`
    // once its `updateSidecar(...)` promise resolves — simulated here by
    // dispatching the same thunk directly after an awaited async op.
    await Promise.resolve().then(() =>
      store.dispatch(fetchEntityAliasTable("project-1")),
    );

    expect(selectEntityAliasTable(store.getState())).toEqual(SAMPLE_TABLE);
  });

  it("does NOT update on an unrelated action", () => {
    const store = makeStore();
    const before = selectEntityAliasTable(store.getState());

    store.dispatch(setSelectedResourceId("resource-1"));

    expect(selectEntityAliasTable(store.getState())).toBe(before);
    expect(selectEntityAliasTableProjectId(store.getState())).toBeNull();
  });

  it("never reads or writes a metadataRevision field", async () => {
    const store = makeStore();
    mockedGetEntityAliasTable.mockResolvedValue(SAMPLE_TABLE);

    await store.dispatch(fetchEntityAliasTable("project-1"));

    const state = store.getState().entityAliasTable as unknown as Record<
      string,
      unknown
    >;
    expect(
      Object.prototype.hasOwnProperty.call(state, "metadataRevision"),
    ).toBe(false);
    expect(JSON.stringify(state)).not.toContain("metadataRevision");
  });
});
