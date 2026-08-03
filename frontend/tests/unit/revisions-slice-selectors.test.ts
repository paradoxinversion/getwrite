import { describe, expect, it } from "vitest";

import {
  selectCurrentRevisionContent,
  selectCurrentRevisionId,
  selectDeletingRevisionId,
  selectFetchingRevisionId,
  selectIsLoadingRevisions,
  selectIsSavingRevision,
  selectRevisionsErrorMessage,
  selectVisibleRevisions,
  type RevisionEntry,
  type RevisionsState,
} from "../../src/store/revisionsSlice";
import type { RootState } from "../../src/store/store";

function createRevisionEntry(overrides: Partial<RevisionEntry>): RevisionEntry {
  const versionNumber = overrides.versionNumber ?? 1;
  const resourceId = overrides.resourceId ?? "resource-1";
  const revisionId = overrides.id ?? `revision-${versionNumber}`;

  return {
    id: revisionId,
    resourceId,
    versionNumber,
    createdAt: `2026-03-21T12:00:0${versionNumber}.000Z`,
    filePath: `/tmp/${revisionId}.json`,
    isCanonical: versionNumber === 1,
    displayName: `Revision v${versionNumber}`,
    ...overrides,
  };
}

function createRootState(overrides?: {
  revisions?: Partial<RevisionsState>;
  selectedResourceId?: string | null;
}): RootState {
  return {
    projects: {
      selectedProjectId: "project-1",
      projects: {
        "project-1": {
          id: "project-1",
          name: "Project One",
          rootPath: "/tmp/project-1",
          folders: [],
          resources: [],
        },
      },
    },
    resources: {
      selectedResourceId: overrides?.selectedResourceId ?? "resource-1",
      resources: [],
      folders: [],
    },
    revisions: {
      resourceId: "resource-1",
      requestedResourceId: null,
      currentRevisionId: "revision-2",
      currentRevisionContent: "Rendered preview",
      revisions: [
        createRevisionEntry({ id: "revision-2", versionNumber: 2 }),
        createRevisionEntry({ id: "revision-1", versionNumber: 1 }),
      ],
      isLoading: true,
      isSaving: false,
      fetchingRevisionId: "revision-2",
      deletingRevisionId: "revision-1",
      errorMessage: "warning",
      ...overrides?.revisions,
    },
    editorConfig: { headings: {} },
    search: {
      requestedProjectId: null,
      requestedQuery: "",
      results: [],
      isLoading: false,
      errorMessage: "",
    },
    queries: {
      projectId: null,
      requestedProjectId: null,
      savedQueries: {},
      isLoadingQueries: false,
      isEvaluating: false,
      evaluatingForProjectId: null,
      activeQueryDefinition: null,
      activeQueryIds: [],
      savingQueryId: null,
      deletingQueryId: null,
      errorMessage: "",
    },
    crypto: {
      status: "absent",
      encryptedProjectIds: [],
      isUnlocking: false,
      isConverting: false,
      errorMessage: "",
    },
  } as RootState;
}

describe("store/revisionsSlice selectors (T008)", () => {
  it("returns visible revisions only when the selected resource matches the loaded revision state", () => {
    const matchingState = createRootState();
    const visible = selectVisibleRevisions(matchingState);

    expect(visible.map((revision) => revision.id)).toEqual([
      "revision-2",
      "revision-1",
    ]);
    expect(selectVisibleRevisions(matchingState)).toBe(visible);

    const staleState = createRootState({ selectedResourceId: "resource-9" });
    expect(selectVisibleRevisions(staleState)).toEqual([]);
  });

  it("exposes the current revision and status flags through stable selectors", () => {
    const state = createRootState();

    expect(selectCurrentRevisionId(state)).toBe("revision-2");
    expect(selectCurrentRevisionContent(state)).toBe("Rendered preview");
    expect(selectIsLoadingRevisions(state)).toBe(true);
    expect(selectIsSavingRevision(state)).toBe(false);
    expect(selectFetchingRevisionId(state)).toBe("revision-2");
    expect(selectDeletingRevisionId(state)).toBe("revision-1");
    expect(selectRevisionsErrorMessage(state)).toBe("warning");
  });
});
