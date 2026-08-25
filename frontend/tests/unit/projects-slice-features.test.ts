/**
 * Unit tests for the feature-toggle / Organizer card-body slice wiring (Task 4).
 *
 * Covers: setProjects hydration of `features`/`organizerCardBody` from project
 * config, the absent-flag-as-disabled selectors (a newly created project reports
 * all four features off), and the `updateProjectFeatures` /
 * `updateProjectOrganizerCardBody` thunks (transport call + store update).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import projectsReducer, {
  setProjects,
  setSelectedProjectId,
  updateProjectFeatures,
  updateProjectOrganizerCardBody,
  selectActiveProjectFeatures,
  selectActiveProjectOrganizerCardBody,
  selectActiveProjectDirectoryId,
  getProjectDirectoryId,
  selectTimelineEnabled,
  selectPovEnabled,
  selectSynopsisEnabled,
  selectNotesEnabled,
  selectEntitiesEnabled,
  buildStoredProject,
} from "../../src/store/projectsSlice";
import type { Project } from "../../src/lib/models/types";

function makeStore() {
  return configureStore({ reducer: { projects: projectsReducer } });
}

function seedProject(
  store: ReturnType<typeof makeStore>,
  config?: Record<string, unknown>,
) {
  store.dispatch(
    setProjects([
      {
        project: {
          id: "project-1",
          name: "Project One",
          rootPath: "/tmp/project-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          ...(config ? { config: config as never } : {}),
        },
        folders: [],
        resources: [],
      },
    ]),
  );
  store.dispatch(setSelectedProjectId("project-1"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("projectsSlice — feature config hydration (Task 4)", () => {
  it("hydrates features and organizerCardBody from project config via setProjects", () => {
    const store = makeStore();
    seedProject(store, {
      editorConfig: {},
      features: { timeline: true, pov: true },
      organizerCardBody: { source: "text-excerpt", excerptLength: 100 },
    });

    const state = store.getState();
    expect(state.projects.projects["project-1"].features).toEqual({
      timeline: true,
      pov: true,
    });
    expect(state.projects.projects["project-1"].organizerCardBody).toEqual({
      source: "text-excerpt",
      excerptLength: 100,
    });
  });

  it("leaves features/organizerCardBody undefined when the project has none", () => {
    const store = makeStore();
    seedProject(store);
    const state = store.getState();
    expect(state.projects.projects["project-1"].features).toBeUndefined();
    expect(
      state.projects.projects["project-1"].organizerCardBody,
    ).toBeUndefined();
  });
});

describe("projectsSlice — feature selectors (absent = disabled)", () => {
  it("reports all five features disabled for a project with no features", () => {
    const store = makeStore();
    seedProject(store);
    const state = store.getState();
    expect(selectTimelineEnabled(state)).toBe(false);
    expect(selectPovEnabled(state)).toBe(false);
    expect(selectSynopsisEnabled(state)).toBe(false);
    expect(selectNotesEnabled(state)).toBe(false);
    expect(selectEntitiesEnabled(state)).toBe(false);
    expect(selectActiveProjectFeatures(state)).toEqual({});
    expect(selectActiveProjectOrganizerCardBody(state)).toBeNull();
  });

  it("returns a stable empty-features reference (no re-render churn)", () => {
    const store = makeStore();
    seedProject(store); // no features block
    const state = store.getState();
    expect(selectActiveProjectFeatures(state)).toBe(
      selectActiveProjectFeatures(state),
    );
  });

  it("reflects enabled features and the card-body config", () => {
    const store = makeStore();
    seedProject(store, {
      editorConfig: {},
      features: { timeline: true, synopsis: true },
      organizerCardBody: { source: "field", fieldKey: "synopsis" },
    });
    const state = store.getState();
    expect(selectTimelineEnabled(state)).toBe(true);
    expect(selectSynopsisEnabled(state)).toBe(true);
    expect(selectPovEnabled(state)).toBe(false);
    expect(selectNotesEnabled(state)).toBe(false);
    expect(selectEntitiesEnabled(state)).toBe(false);
    expect(selectActiveProjectOrganizerCardBody(state)).toEqual({
      source: "field",
      fieldKey: "synopsis",
    });
  });

  it("reflects the entities feature when enabled", () => {
    const store = makeStore();
    seedProject(store, { editorConfig: {}, features: { entities: true } });
    const state = store.getState();
    expect(selectEntitiesEnabled(state)).toBe(true);
  });

  it("returns disabled/empty when no project is selected", () => {
    const store = makeStore();
    const state = store.getState();
    expect(selectTimelineEnabled(state)).toBe(false);
    expect(selectActiveProjectFeatures(state)).toEqual({});
    expect(selectActiveProjectOrganizerCardBody(state)).toBeNull();
  });
});

describe("projectsSlice — selectActiveProjectDirectoryId (FR12 basename-vs-id)", () => {
  it("returns the rootPath-derived directory basename, NOT project.id, when they differ", () => {
    // Two independently generated UUIDs: the directory name on disk
    // (rootPath's trailing segment) and project.json's own internal `id`.
    // These are never guaranteed to match — this is the exact landmine
    // FR12 exists to prevent.
    const directoryUuid = "aaaaaaaa-1111-4111-8111-111111111111";
    const internalProjectJsonId = "bbbbbbbb-2222-4222-8222-222222222222";

    const store = makeStore();
    store.dispatch(
      setProjects([
        {
          project: {
            id: internalProjectJsonId,
            name: "Mismatched Project",
            rootPath: `/tmp/projects/${directoryUuid}`,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          folders: [],
          resources: [],
        },
      ]),
    );
    store.dispatch(setSelectedProjectId(internalProjectJsonId));

    const state = store.getState();
    expect(selectActiveProjectDirectoryId(state)).toBe(directoryUuid);
    expect(selectActiveProjectDirectoryId(state)).not.toBe(
      internalProjectJsonId,
    );
  });

  it("returns null when no project is selected", () => {
    const store = makeStore();
    expect(selectActiveProjectDirectoryId(store.getState())).toBeNull();
  });

  it("returns null when the selected project has no rootPath", () => {
    const store = makeStore();
    seedProject(store);
    store.dispatch(setSelectedProjectId("nonexistent-project-id"));
    expect(selectActiveProjectDirectoryId(store.getState())).toBeNull();
  });
});

describe("getProjectDirectoryId (basename extraction helper)", () => {
  it("extracts the trailing POSIX path segment", () => {
    expect(getProjectDirectoryId("/a/b/c/project-uuid")).toBe("project-uuid");
  });

  it("extracts the trailing Windows path segment", () => {
    expect(getProjectDirectoryId("C:\\projects\\project-uuid")).toBe(
      "project-uuid",
    );
  });

  it("strips a trailing slash before extracting the segment", () => {
    expect(getProjectDirectoryId("/a/b/project-uuid/")).toBe("project-uuid");
  });
});

describe("projectsSlice — updateProjectFeatures thunk", () => {
  it("posts the features to the route and updates the store on success", async () => {
    const store = makeStore();
    seedProject(store);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            features: { timeline: true },
            organizerCardBody: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await store.dispatch(
      updateProjectFeatures({
        projectId: "project-1",
        features: { timeline: true },
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith("/api/project/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        features: { timeline: true },
      }),
    });

    const state = store.getState();
    expect(selectTimelineEnabled(state)).toBe(true);
  });

  it("rejects when the route returns an error", async () => {
    const store = makeStore();
    seedProject(store);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );

    const result = await store.dispatch(
      updateProjectFeatures({
        projectId: "project-1",
        features: { timeline: true },
      }),
    );

    expect(result.type).toBe("projects/updateProjectFeatures/rejected");
    expect(selectTimelineEnabled(store.getState())).toBe(false);
  });
});

describe("projectsSlice — updateProjectOrganizerCardBody thunk", () => {
  it("posts the card-body config and updates the store on success", async () => {
    const store = makeStore();
    seedProject(store);

    const body = { source: "text-excerpt" as const, excerptLength: 80 };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ features: {}, organizerCardBody: body }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await store.dispatch(
      updateProjectOrganizerCardBody({
        projectId: "project-1",
        organizerCardBody: body,
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith("/api/project/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "project-1", organizerCardBody: body }),
    });

    expect(selectActiveProjectOrganizerCardBody(store.getState())).toEqual(
      body,
    );
  });
});

describe("buildStoredProject", () => {
  function makeProject(config?: Project["config"]): Project {
    return {
      id: "proj-1",
      name: "Proj",
      createdAt: "2024-01-01T00:00:00.000Z",
      rootPath: "/tmp/proj-1",
      ...(config ? { config } : {}),
    };
  }

  it("carries features and organizerCardBody from project config (fixes reopen persistence)", () => {
    const stored = buildStoredProject(
      makeProject({
        editorConfig: {},
        features: { timeline: true, timelineView: true, notes: true },
        organizerCardBody: { source: "text-excerpt", excerptLength: 100 },
      }),
      [],
      [],
    );
    expect(stored.features).toEqual({
      timeline: true,
      timelineView: true,
      notes: true,
    });
    expect(stored.organizerCardBody).toEqual({
      source: "text-excerpt",
      excerptLength: 100,
    });
  });

  it("carries statuses and metadataSchema", () => {
    const stored = buildStoredProject(
      makeProject({
        editorConfig: {},
        statuses: ["draft", "done"],
        metadataSchema: { groups: [] },
      }),
      [],
      [],
    );
    expect(stored.statuses).toEqual(["draft", "done"]);
    expect(stored.metadataSchema).toEqual({ groups: [] });
  });

  it("leaves features/organizerCardBody undefined for a project with no config", () => {
    const stored = buildStoredProject(makeProject(), [], []);
    expect(stored.features).toBeUndefined();
    expect(stored.organizerCardBody).toBeUndefined();
  });

  it("maps resources to the minimal ResourceMeta shape with defaults", () => {
    const stored = buildStoredProject(
      makeProject({ editorConfig: {} }),
      [],
      [
        { id: "r1", name: "Scene", folderId: "f1", userMetadata: { pov: "A" } },
        { id: "r2" },
      ],
    );
    expect(stored.resources).toEqual([
      { id: "r1", name: "Scene", folderId: "f1", userMetadata: { pov: "A" } },
      { id: "r2", name: "", folderId: null, userMetadata: {} },
    ]);
  });
});
