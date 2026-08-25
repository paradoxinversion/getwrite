# State Management

GetWrite uses Redux Toolkit for client-side state. State is loaded on mount from the filesystem via API routes — there is no real-time sync or optimistic update layer. All mutations go through an API call followed by an explicit Redux dispatch.

---

## Store Setup

**`frontend/src/store/store.ts`** — Configures the Redux store with three slices:

```
store.projects   → projectsSlice
store.resources  → resourcesSlice
store.revisions  → revisionsSlice
```

**`frontend/src/store/hooks.ts`** — Re-exports typed hooks for use in components:

- `useAppDispatch()` — typed `dispatch` (avoids `any` cast)
- `useAppSelector(selector)` — typed `useSelector` bound to `RootState`

**`ClientProvider.tsx`** — Wraps the Next.js app with the Redux `<Provider>` and triggers the initial `GET /api/projects` load on mount, dispatching `setProjects` to populate the store.

---

## Slices

### `projectsSlice` — `frontend/src/store/projectsSlice.ts`

Manages project-level state: the set of known projects and which one is active.

**State shape:**

```ts
interface ProjectsState {
  selectedProjectId: string | null;
  projects: Record<string, StoredProject>;
}

interface StoredProject {
  id: string;
  name?: string;
  rootPath: string;
  folders?: Folder[];
  resources?: ResourceMeta[];
  metadata?: Record<string, MetadataValue>;
}
```

**Key actions:**

| Action                 | Description                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `setProject`           | Upserts a single project record by ID                                                  |
| `setProjects`          | Replaces multiple project records from `GET /api/projects` response                    |
| `setSelectedProjectId` | Sets the active project ID (or `null`)                                                 |
| `renameProject`        | Updates `name` in the slice (after `POST /api/project/rename`)                         |
| `deleteProject`        | Removes project from slice; clears `selectedProjectId` if needed                       |
| `addResource`          | Appends a resource to a project's resource list (deprecated — prefer `resourcesSlice`) |
| `removeResource`       | Removes a resource from a project's resource list                                      |

**Key selectors:**

| Selector                         | Returns                               |
| -------------------------------- | ------------------------------------- |
| `selectProject(state, id)`       | Normalized `StoredProject` or `null`  |
| `selectSelectedProjectId(state)` | Currently active project ID or `null` |

`selectProject` is memoized per project ID using the raw stored-project reference as the cache key to avoid unnecessary re-renders.

---

### `resourcesSlice` — `frontend/src/store/resourcesSlice.ts`

Manages the resources and folders loaded for the currently active project, and tracks which resource is selected for editing.

**State shape:**

```ts
interface ResourcesState {
  selectedResourceId: string | null;
  resources: AnyResource[];
  folders: Folder[];
}
```

**Key actions:**

| Action                  | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `setResources`          | Replaces the full resource list (called after project load) |
| `setFolders`            | Replaces the full folder list                               |
| `setSelectedResourceId` | Sets the active resource ID                                 |
| `addResource`           | Appends a resource or folder (dispatched after creation)    |
| `updateResource`        | Merges a partial update into one resource by ID             |
| `updateResources`       | Batch merges partial updates into multiple resources        |
| `updateFolder`          | Merges a partial update into one folder by ID               |
| `updateFolders`         | Batch merges partial updates into multiple folders          |

The `persistReorder` async thunk calls `POST /api/projects/[projectId]/reorder` to persist folder/resource order changes from the Organizer view.

**Key selectors:**

| Selector                           | Returns                                      |
| ---------------------------------- | -------------------------------------------- |
| `selectResource(state)`            | Currently selected resource or `null`        |
| `selectResources(state)`           | All loaded resources (not including folders) |
| `selectFolders(state)`             | All loaded folders (not including resources) |
| `selectFoldersAndResources(state)` | Combined array via `createSelector`          |
| `selectResourceById(state, id)`    | Resource by UUID or `null`                   |
| `selectFolderById(state, id)`      | Folder by UUID or `null`                     |
| `selectItemById(state, id)`        | Any resource or folder by UUID (memoized)    |

---

### `revisionsSlice` — `frontend/src/store/revisionsSlice.ts`

Manages revision state for the currently selected resource: the list of revisions, which is selected for preview, loading/saving flags, and error messages.

**State shape:**

```ts
interface RevisionsState {
  resourceId: string | null; // resource whose revisions are loaded
  requestedResourceId: string | null; // in-flight request guard
  currentRevisionId: string | null; // selected/viewed revision
  currentRevisionContent: string | null; // preview content
  revisions: RevisionEntry[]; // all known revisions
  isLoading: boolean;
  isSaving: boolean;
  fetchingRevisionId: string | null;
  deletingRevisionId: string | null;
  errorMessage: string;
}
```

`RevisionEntry` is a normalized shape defined in `revision-normalization.ts` — it is the UI-facing representation of a filesystem `Revision` object.

**Key async thunks (dispatched by components):**

| Thunk                                     | API call                                         |
| ----------------------------------------- | ------------------------------------------------ |
| `loadRevisionsForSelectedResource`        | `GET /api/resource/revision/[id]?projectId=...`  |
| `saveRevisionForSelectedResource`         | `POST /api/resource/revision/[id]`               |
| `deleteRevisionForSelectedResource`       | `DELETE /api/resource/revision/[id]`             |
| `fetchRevisionContentForSelectedResource` | `GET /api/resource/revision/[id]?revisionId=...` |
| `setCanonicalRevisionForSelectedResource` | `PATCH /api/resource/revision/[id]`              |

**Key synchronous actions:**

| Action                   | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `clearRevisions`         | Resets all revision state (called on resource deselect) |
| `setCurrentRevisionId`   | Sets the viewed revision without a network call         |
| `setCanonicalRevisionId` | Client-side canonical update (optimistic)               |

**Key selectors:**

| Selector                       | Returns                                          |
| ------------------------------ | ------------------------------------------------ |
| `selectRevisionsState`         | Raw `RevisionsState`                             |
| `selectVisibleRevisions`       | Revisions only when they match selected resource |
| `selectCurrentRevisionId`      | Active revision UUID or `null`                   |
| `selectCurrentRevisionContent` | Preview content string or `null`                 |
| `selectIsLoadingRevisions`     | Loading flag                                     |
| `selectIsSavingRevision`       | Saving flag                                      |
| `selectFetchingRevisionId`     | In-flight preview fetch revision ID              |
| `selectDeletingRevisionId`     | In-flight delete revision ID                     |
| `selectRevisionsErrorMessage`  | Latest error string                              |

**Staleness guard**: when `setSelectedResourceId` is dispatched from `resourcesSlice`, the revisions slice resets immediately via an `extraReducer`. Pending async results are ignored if `requestedResourceId` doesn't match the resolved `resourceId`.

---

## Supporting Store Files

### `revision-canonical-guards.ts`

Provides pure functions used inside `revisionsSlice` to enforce the canonical invariant:

- `applyCanonicalRevision(entries, revisionId)` — marks one entry canonical, clears all others
- `isStaleCanonicalUpdate(stateResourceId, payloadResourceId)` — returns `true` when a PATCH result belongs to a resource that is no longer selected (prevents stale updates)

### `revision-normalization.ts`

Translates raw API revision data into `RevisionEntry` objects:

- `parseRevisionEntries(data)` — normalizes a list of raw revisions
- `toRevisionEntry(revision, displayName?)` — wraps a single revision into UI-ready form
- `mergeRevisionEntry(entries, entry)` — upserts a revision into the list
- `removeRevisionEntry(entries, revisionId)` — removes by ID
- `resolveCurrentRevisionId(entries)` — finds the canonical entry ID

### `revision-transport-service.ts`

Transport-level operations for revisions. Resolves the project context from Redux state and, on web/desktop, calls the revision API routes; as of ADR-021 Phase 1 the same public functions resolve to an in-process native backend instead of `fetch` when running as a native Capacitor build (see `store/transport/create-transport.ts`):

- `resolveRevisionRequestContext(state, resourceId)` — extracts `projectId` (via `selectActiveProjectDirectoryId`, the active project's on-disk directory basename — not `project.id`) and `resourceId`
- `fetchRevisionList(context)` — `GET /api/resource/revision/[id]`
- `fetchRevisionContent(context, revisionId)` — `GET /api/resource/revision/[id]?revisionId=...`
- `createRevision(context, revisionName)` — `POST /api/resource/revision/[id]`
- `removeRevision(context, revisionId)` — `DELETE /api/resource/revision/[id]`
- `persistCanonicalRevision(context, revisionId)` — `PATCH /api/resource/revision/[id]`

### `project-actions-controller.ts`

Coordinates multi-step project-level operations that require both API calls and Redux dispatches (e.g., creating a project then populating both `projectsSlice` and `resourcesSlice`).

---

## Data Flow: Load on Mount

```
ClientProvider mounts
  → fetch GET /api/projects
  → dispatch setProjects([{ project, folders, resources }])
  → projectsSlice.projects populated
```

When the user selects a project:

```
User selects project
  → dispatch setSelectedProjectId(id)
  → POST /api/project { projectId }
  → dispatch setResources(resources)
  → dispatch setFolders(folders)
  → resourcesSlice populated
```

When the user selects a resource:

```
User selects resource
  → dispatch setSelectedResourceId(resourceId)
  → revisionsSlice resets (extraReducer)
  → dispatch loadRevisionsForSelectedResource({ resourceId })
  → GET /api/resource/revision/[id]?projectId=...
  → dispatch fulfilled → revisionsSlice.revisions populated
```
