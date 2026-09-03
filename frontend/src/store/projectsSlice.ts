// Last Updated: 2026-03-11

/**
 * @module projectsSlice
 *
 * Redux Toolkit slice responsible for project-level state:
 * - the map of known projects keyed by project ID
 * - the currently selected project ID
 *
 * This slice intentionally stores a lightweight project projection used by
 * shell-level UI concerns (project selection, project-scoped resource lists),
 * while resource editing details are maintained in `resourcesSlice`.
 */
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Project } from "../lib/models";
import { DEFAULT_METADATA_SCHEMA } from "../lib/models/default-metadata-schema";
import type {
  MetadataField,
  MetadataFieldType,
  MetadataGroup,
  MetadataSchema,
  MetadataValue,
  ProjectFeatureFlags,
  OrganizerCardBodyConfig,
} from "../lib/models/types";
import type {
  TypeMigrationEntry,
  OptionsMigrationEntry,
} from "../lib/models/metadata-schema";
import {
  postFeatureConfig,
  type FeatureConfigResult,
} from "./feature-config-transport-service";
import {
  resolveMetadataSchemaRequestContext,
  postAddField,
  postRemoveField,
  postDeprecateField,
  postClearField,
  postReorderFields,
  postRenameField,
  postUpdateFieldOptions,
  postUpdateFieldOptionsWithMigration,
  postUpdateRefProperties,
  postChangeFieldType,
  postChangeFieldTypeWithMigration,
  postAddGroup,
  postRemoveGroup,
  postReorderGroups,
  postRenameFieldKey,
  type MetadataSchemaRequestContext,
} from "./metadata-schema-transport-service";

/**
 * Minimal folder shape persisted within a stored project record.
 */
type Folder = { id: string; slug?: string; name?: string; orderIndex?: number };

/**
 * Minimal resource metadata shape persisted within a stored project record.
 */
type ResourceMeta = {
  /** Stable unique resource identifier. */
  id: string;
  /** Human-readable resource name shown in lists. */
  name: string;
  /** Parent folder ID, or `null`/`undefined` for top-level resources. */
  folderId?: string | null;
  /** User-set metadata blob associated with the resource. */
  userMetadata?: Record<string, unknown>;
};

/**
 * Project record stored in the `projects` slice dictionary.
 */
export interface StoredProject {
  /** Stable unique project identifier. */
  id: string;
  /** Optional display name for the project. */
  name?: string;
  /** Absolute project root path on disk. */
  rootPath: string;
  /** Folder entries known for this project. */
  folders?: Folder[];
  /** Resource entries known for this project. */
  resources?: ResourceMeta[];
  /** Optional project-level metadata persisted in project.json. */
  metadata?: Record<string, MetadataValue>;
  /** Ordered list of status values configured for this project. */
  statuses?: string[];
  /** Active metadata field schema. Defaults to DEFAULT_METADATA_SCHEMA when not persisted on disk. */
  metadataSchema?: MetadataSchema;
  /** Per-feature opt-in flags. Absent (or an absent flag) means the feature is disabled. */
  features?: ProjectFeatureFlags;
  /** Organizer card-body source configuration; absent means none configured. */
  organizerCardBody?: OrganizerCardBodyConfig;
}

/**
 * Maps a loaded project (from the create/open flows) into the `StoredProject`
 * shape held in this slice. Centralizing the mapping keeps those call sites
 * from drifting — notably from silently dropping `features` /
 * `organizerCardBody`, which previously made feature toggles fail to persist
 * across a project reopen (the open flow rebuilt the project without them).
 *
 * @param project - Loaded project record (carries `config`).
 * @param folders - Folder descriptors for the project.
 * @param resources - Resource records reduced to {@link StoredProject}'s
 *   minimal `ResourceMeta` shape.
 * @returns The `StoredProject` to dispatch via `setProject`.
 */
export function buildStoredProject(
  project: Project,
  folders: Folder[],
  resources: ReadonlyArray<{
    id: string;
    name?: string;
    folderId?: string | null;
    userMetadata?: Record<string, unknown>;
  }>,
): StoredProject {
  return {
    id: project.id,
    name: project.name,
    rootPath: project.rootPath ?? "",
    folders,
    resources: resources.map((r) => ({
      id: r.id,
      name: r.name ?? "",
      folderId: r.folderId ?? null,
      userMetadata: r.userMetadata ?? {},
    })),
    metadata: project.metadata,
    statuses: project.config?.statuses ?? [],
    metadataSchema: project.config?.metadataSchema,
    features: project.config?.features,
    organizerCardBody: project.config?.organizerCardBody,
  };
}

/**
 * Normalizes legacy persisted project shapes to the runtime StoredProject shape
 * used by the UI. This accepts the historical `{ resources?: ResourceMeta[] }`
 * shape and ensures `resources` items have a `metadata` object and folders
 * are present as an array. Keep this small and conservative so it is safe to
 * remove once the app no longer persists the legacy shape.
 */
export function normalizeStoredProject(p: StoredProject): StoredProject {
  if (!p) return p;
  // If resources are already full canonical resource objects (contain `name`),
  // assume they're migrated and return as-is to preserve display fields.
  if (Array.isArray(p.resources) && p.resources.length > 0) {
    const first = p.resources[0] as any;
    if (first && typeof first.name === "string") {
      return { ...p, folders: p.folders ?? [] };
    }
  }

  const resources = Array.isArray(p.resources)
    ? p.resources.map((r) => ({
        id: r.id,
        name: r.name ?? "",
        userMetadata: r.userMetadata ?? {},
      }))
    : p.resources;
  const folders = p.folders ?? [];

  return { ...p, resources, folders };
}

/**
 * Root state shape managed by this slice.
 */
export interface ProjectsState {
  /** ID of the currently active project, or `null` when none is selected. */
  selectedProjectId: string | null;
  /** Dictionary of stored projects keyed by project ID. */
  projects: Record<string, StoredProject>;
}

// ---------------------------------------------------------------------------
// Async thunks — metadata schema CRUD
// ---------------------------------------------------------------------------
// All thunks share the same contract:
//   1. Resolve project context (guard: project not found or rootPath missing)
//   2. Call the transport service
//   3. Return { projectId, schema } on success; rejectWithValue on failure
// State is updated in extraReducers.fulfilled inside the slice below.

function getSchemaThunkErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Metadata schema operation failed.";
}

interface SchemaActionResult {
  projectId: string;
  schema: MetadataSchema;
}

/**
 * Factory for the 15 metadata-schema thunks that share identical boilerplate:
 * resolve context → guard → call transport → return { projectId, schema }.
 */
function makeSchemaThunk<Args extends { projectId: string }>(
  typePrefix: string,
  transportFn: (
    context: MetadataSchemaRequestContext,
    args: Args,
  ) => Promise<MetadataSchema>,
) {
  return createAsyncThunk<
    SchemaActionResult,
    Args,
    { state: any; rejectValue: string }
  >(typePrefix, async (args, thunkApi) => {
    const context = resolveMetadataSchemaRequestContext(
      thunkApi.getState(),
      args.projectId,
    );
    if ("error" in context) return thunkApi.rejectWithValue(context.error);
    try {
      const schema = await transportFn(context, args);
      return { projectId: args.projectId, schema };
    } catch (error) {
      return thunkApi.rejectWithValue(getSchemaThunkErrorMessage(error));
    }
  });
}

export const addMetadataField = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  field: MetadataField;
}>("projects/addMetadataField", (ctx, { groupId, field }) =>
  postAddField(ctx, groupId, field),
);

export const removeMetadataField = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
}>("projects/removeMetadataField", (ctx, { groupId, fieldKey }) =>
  postRemoveField(ctx, groupId, fieldKey),
);

export const deprecateMetadataField = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
}>("projects/deprecateMetadataField", (ctx, { groupId, fieldKey }) =>
  postDeprecateField(ctx, groupId, fieldKey),
);

export const clearMetadataField = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
}>("projects/clearMetadataField", (ctx, { groupId, fieldKey }) =>
  postClearField(ctx, groupId, fieldKey),
);

export const reorderMetadataFields = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  newKeyOrder: string[];
}>("projects/reorderMetadataFields", (ctx, { groupId, newKeyOrder }) =>
  postReorderFields(ctx, groupId, newKeyOrder),
);

export const renameMetadataField = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
  newLabel: string;
}>("projects/renameMetadataField", (ctx, { groupId, fieldKey, newLabel }) =>
  postRenameField(ctx, groupId, fieldKey, newLabel),
);

export const updateMetadataFieldOptions = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
  options: string[];
}>(
  "projects/updateMetadataFieldOptions",
  (ctx, { groupId, fieldKey, options }) =>
    postUpdateFieldOptions(ctx, groupId, fieldKey, options),
);

export const updateMetadataFieldOptionsWithMigration = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
  newOptions: string[];
  migrations: Record<string, OptionsMigrationEntry>;
}>(
  "projects/updateMetadataFieldOptionsWithMigration",
  (ctx, { groupId, fieldKey, newOptions, migrations }) =>
    postUpdateFieldOptionsWithMigration(
      ctx,
      groupId,
      fieldKey,
      newOptions,
      migrations,
    ),
);

export const addMetadataGroup = makeSchemaThunk<{
  projectId: string;
  group: MetadataGroup;
}>("projects/addMetadataGroup", (ctx, { group }) => postAddGroup(ctx, group));

export const removeMetadataGroup = makeSchemaThunk<{
  projectId: string;
  groupId: string;
}>("projects/removeMetadataGroup", (ctx, { groupId }) =>
  postRemoveGroup(ctx, groupId),
);

export const reorderMetadataGroups = makeSchemaThunk<{
  projectId: string;
  newGroupIdOrder: string[];
}>("projects/reorderMetadataGroups", (ctx, { newGroupIdOrder }) =>
  postReorderGroups(ctx, newGroupIdOrder),
);

export const renameMetadataFieldKey = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
  newKey: string;
}>("projects/renameMetadataFieldKey", (ctx, { groupId, fieldKey, newKey }) =>
  postRenameFieldKey(ctx, groupId, fieldKey, newKey),
);

export const changeMetadataFieldType = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
  newType: MetadataFieldType;
}>("projects/changeMetadataFieldType", (ctx, { groupId, fieldKey, newType }) =>
  postChangeFieldType(ctx, groupId, fieldKey, newType),
);

export const changeMetadataFieldTypeWithMigration = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
  newType: MetadataFieldType;
  newOptions: string[];
  migrations: Record<string, TypeMigrationEntry>;
}>(
  "projects/changeMetadataFieldTypeWithMigration",
  (ctx, { groupId, fieldKey, newType, newOptions, migrations }) =>
    postChangeFieldTypeWithMigration(
      ctx,
      groupId,
      fieldKey,
      newType,
      newOptions,
      migrations,
    ),
);

export const updateMetadataRefProperties = makeSchemaThunk<{
  projectId: string;
  groupId: string;
  fieldKey: string;
  updates: {
    refFolder?: string | null;
    includeSubfolders?: boolean | null;
    maxSelections?: number | null;
  };
}>(
  "projects/updateMetadataRefProperties",
  (ctx, { groupId, fieldKey, updates }) =>
    postUpdateRefProperties(ctx, groupId, fieldKey, updates),
);

// ---------------------------------------------------------------------------
// Async thunks — feature configuration (toggles + Organizer card body)
// ---------------------------------------------------------------------------
// Persist `config.features` / `config.organizerCardBody` via the lock-protected
// `/api/project/features` route (does NOT bump metadataRevision), then mirror
// the returned, persisted config into the store in extraReducers.fulfilled.

interface FeatureConfigActionResult {
  projectId: string;
  result: FeatureConfigResult;
}

function getFeatureConfigErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Feature configuration update failed.";
}

/**
 * Factory for the feature-config thunks that share the same resolve → guard →
 * postFeatureConfig → return { projectId, result } pattern.
 */
function makeFeatureConfigThunk<Args extends { projectId: string }>(
  typePrefix: string,
  buildBody: (args: Args) => Parameters<typeof postFeatureConfig>[1],
) {
  return createAsyncThunk<
    FeatureConfigActionResult,
    Args,
    { state: any; rejectValue: string }
  >(typePrefix, async (args, thunkApi) => {
    const context = resolveMetadataSchemaRequestContext(
      thunkApi.getState(),
      args.projectId,
    );
    if ("error" in context) return thunkApi.rejectWithValue(context.error);
    try {
      const result = await postFeatureConfig(
        context.projectId,
        buildBody(args),
      );
      return { projectId: args.projectId, result };
    } catch (error) {
      return thunkApi.rejectWithValue(getFeatureConfigErrorMessage(error));
    }
  });
}

export const updateProjectFeatures = makeFeatureConfigThunk<{
  projectId: string;
  features: ProjectFeatureFlags;
}>("projects/updateProjectFeatures", ({ features }) => ({ features }));

export const updateProjectOrganizerCardBody = makeFeatureConfigThunk<{
  projectId: string;
  organizerCardBody: OrganizerCardBodyConfig;
}>("projects/updateProjectOrganizerCardBody", ({ organizerCardBody }) => ({
  organizerCardBody,
}));

/**
 * Initial state for the `projects` slice.
 */
const initialState: ProjectsState = { selectedProjectId: null, projects: {} };

/**
 * `projects` slice definition.
 */
const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    /**
     * Upserts a single project record by ID.
     *
     * @param state - Current slice state draft.
     * @param action - Payload containing a full stored project snapshot.
     */
    setProject(state, action: PayloadAction<StoredProject>) {
      state.projects[action.payload.id] = {
        ...action.payload,
        metadataSchema:
          action.payload.metadataSchema ?? DEFAULT_METADATA_SCHEMA,
      };
      return state;
    },
    /**
     * Replaces/updates multiple project records from canonical project views.
     *
     * @param state - Current slice state draft.
     * @param action - Array of project view payloads containing canonical
     *   project metadata plus folder/resource arrays.
     */
    setProjects(
      state,
      action: PayloadAction<
        { project: Project; folders: Folder[]; resources: ResourceMeta[] }[]
      >,
    ) {
      action.payload.forEach((p) => {
        // Single source of truth for the Project -> StoredProject mapping (also
        // used by the create/open flows). Keep the list path's historical
        // default-schema fallback on top.
        const stored = buildStoredProject(p.project, p.folders, p.resources);
        state.projects[p.project.id] = {
          ...stored,
          metadataSchema: stored.metadataSchema ?? DEFAULT_METADATA_SCHEMA,
        };
      });
      return state;
    },
    /**
     * Sets the currently selected project ID.
     *
     * @param state - Current slice state draft.
     * @param action - Selected project ID, or `null` to clear selection.
     */
    setSelectedProjectId(state, action: PayloadAction<string | null>) {
      state.selectedProjectId = action.payload;
      return state;
    },
    /**
     * Updates a stored project's display name.
     *
     * @param state - Current slice state draft.
     * @param action - Target project ID and next display name.
     */
    renameProject(
      state,
      action: PayloadAction<{ projectId: string; newName: string }>,
    ) {
      const { projectId, newName } = action.payload;
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      state.projects[projectId] = { ...project, name: newName };
      return state;
    },
    /**
     * Removes a stored project by ID and clears selection when needed.
     *
     * @param state - Current slice state draft.
     * @param action - Project identifier to remove.
     */
    deleteProject(state, action: PayloadAction<{ projectId: string }>) {
      const { projectId } = action.payload;
      if (!(projectId in state.projects)) {
        return state;
      }

      delete state.projects[projectId];
      if (state.selectedProjectId === projectId) {
        state.selectedProjectId = null;
      }

      return state;
    },
    /**
     * Appends a resource to a project's `resources` array.
     *
     * @deprecated
     * Prefer resource mutations in `resourcesSlice` and project refresh
     * flows that avoid duplicating source-of-truth state.
     *
     * @param state - Current slice state draft.
     * @param action - Target project ID and resource payload to append.
     */
    addResource(
      state,
      action: PayloadAction<{ projectId: string; resource: ResourceMeta }>,
    ) {
      const { projectId, resource } = action.payload;
      const proj = state.projects[projectId] ?? {
        id: projectId,
        folders: [],
        resources: [],
      };
      proj.resources = proj.resources
        ? [...proj.resources, resource]
        : [resource];
      state.projects[projectId] = proj;
      return state;
    },
    /**
     * Removes a resource from a project's `resources` array by ID.
     *
     * @param state - Current slice state draft.
     * @param action - Target project/resource identifiers.
     */
    removeResource(
      state,
      action: PayloadAction<{ projectId: string; resourceId: string }>,
    ) {
      const { projectId, resourceId } = action.payload;
      const proj = state.projects[projectId];
      if (!proj || !proj.resources) return;
      proj.resources = proj.resources.filter((r) => r.id !== resourceId);
      state.projects[projectId] = proj;
      return state;
    },
    /**
     * Replaces only the `metadataSchema` field on a stored project.
     * Dispatched by schema CRUD thunks on API success; can also be
     * dispatched directly when the caller already has the updated schema.
     *
     * @param state - Current slice state draft.
     * @param action - Target project ID and the replacement schema.
     */
    updateProjectMetadataSchema(
      state,
      action: PayloadAction<{ projectId: string; schema: MetadataSchema }>,
    ) {
      const { projectId, schema } = action.payload;
      const project = state.projects[projectId];
      if (!project) return state;
      state.projects[projectId] = { ...project, metadataSchema: schema };
      return state;
    },
  },
  extraReducers: (builder) => {
    const schemaThunks = [
      addMetadataField,
      removeMetadataField,
      deprecateMetadataField,
      clearMetadataField,
      reorderMetadataFields,
      renameMetadataField,
      updateMetadataFieldOptions,
      updateMetadataFieldOptionsWithMigration,
      updateMetadataRefProperties,
      changeMetadataFieldType,
      changeMetadataFieldTypeWithMigration,
      addMetadataGroup,
      removeMetadataGroup,
      reorderMetadataGroups,
      renameMetadataFieldKey,
    ] as const;

    for (const thunk of schemaThunks) {
      builder.addCase(thunk.fulfilled, (state, action) => {
        const { projectId, schema } = action.payload;
        const project = state.projects[projectId];
        if (!project) return state;
        state.projects[projectId] = { ...project, metadataSchema: schema };
        return state;
      });
    }

    // Feature-config thunks share fulfilled handling: mirror the persisted
    // config (both blocks) back into the stored project. A `null`
    // organizerCardBody from the route normalizes to `undefined` (= none).
    const featureConfigThunks = [
      updateProjectFeatures,
      updateProjectOrganizerCardBody,
    ] as const;

    for (const thunk of featureConfigThunks) {
      builder.addCase(thunk.fulfilled, (state, action) => {
        const { projectId, result } = action.payload;
        const project = state.projects[projectId];
        if (!project) return state;
        state.projects[projectId] = {
          ...project,
          features: result.features,
          organizerCardBody: result.organizerCardBody ?? undefined,
        };
        return state;
      });
    }
  },
});

export const {
  setProject,
  setProjects,
  setSelectedProjectId,
  renameProject,
  deleteProject,
  addResource,
  removeResource,
  updateProjectMetadataSchema,
} = projectsSlice.actions;
export default projectsSlice.reducer;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Per-project normalization cache used by {@link selectProject}.
 */
const selectProjectCache: Map<
  string,
  { raw: any; result: StoredProject | null }
> = new Map();

/**
 * Selects a normalized project record for `projectId`.
 *
 * The selector memoizes the normalized value per project ID using the raw
 * stored-project object reference as cache key. This avoids allocating a new
 * normalized object every call and reduces unnecessary re-renders in
 * components that subscribe to project data.
 *
 * @param state - Redux root state (typed as `any` here to avoid store-cycle
 *   imports).
 * @param projectId - Project ID to fetch.
 * @returns Normalized stored project, or `null` if missing.
 */
export const selectProject = (
  state: any,
  projectId: string,
): StoredProject | null => {
  const raw = state?.projects?.projects?.[projectId] ?? null;
  if (!raw) return null;
  // Memoize normalized results per projectId to avoid allocating a new
  // normalized object on every selector call which can trigger
  // unnecessary re-renders and effect loops in components consuming
  // the selector (e.g., ResourceTree). Use the raw stored project
  // reference as the cache key so cached results are reused until the
  // stored project reference changes.
  // NOTE: keep this cache conservative and per-process; it does not
  // attempt to detect deep equality — replacing the stored project in
  // the Redux state (the common case when mutating) will update the
  // raw reference and refresh the cache entry.
  const existing = selectProjectCache.get(projectId);
  if (existing && existing.raw === raw) return existing.result;
  const result = normalizeStoredProject(raw);
  selectProjectCache.set(projectId, { raw, result });
  return result;
};

/**
 * Selects the currently selected project ID.
 *
 * @param state - Redux root state (typed as `any` to avoid circular imports).
 * @returns Selected project ID, or `null` if no project is active.
 */
export const selectSelectedProjectId = (state: any): string | null => {
  return state?.projects?.selectedProjectId ?? null;
};

/**
 * Selects the ordered statuses array for the currently active project.
 *
 * @param state - Redux root state (typed as `any` to avoid circular imports).
 * @returns Array of status strings configured for the active project, or `[]`.
 */
export const selectActiveProjectStatuses = (state: any): string[] => {
  const id = state?.projects?.selectedProjectId;
  return state?.projects?.projects?.[id]?.statuses ?? [];
};

/**
 * Selects the metadata schema for the currently active project.
 * Falls back to DEFAULT_METADATA_SCHEMA when no project is selected or the
 * stored project has no schema (should not occur after Task 3 injection, but
 * kept as a safety net for callers operating before a project is loaded).
 *
 * @param state - Redux root state (typed as `any` to avoid circular imports).
 * @returns The active project's MetadataSchema.
 */
export const selectActiveProjectMetadataSchema = (
  state: any,
): MetadataSchema => {
  const id = state?.projects?.selectedProjectId;
  return (
    state?.projects?.projects?.[id]?.metadataSchema ?? DEFAULT_METADATA_SCHEMA
  );
};

export const selectActiveProjectRootPath = (state: any): string | null => {
  const id = state?.projects?.selectedProjectId;
  return state?.projects?.projects?.[id]?.rootPath ?? null;
};

/**
 * Derives the on-disk project *directory basename* (e.g. the trailing path
 * segment of `rootPath`) from an absolute project root path.
 *
 * Implemented as plain string splitting rather than importing Node's `path`
 * module: this slice is bundled into the client, and `path.basename` isn't
 * safe to pull into client code. Handles both POSIX (`/`) and Windows
 * (`\`) separators and trailing slashes.
 *
 * @param rootPath - Absolute project root path (e.g. `.../projects/<uuid>`).
 * @returns The trailing path segment, or `""` if `rootPath` has none.
 */
export function getProjectDirectoryId(rootPath: string): string {
  const trimmed = rootPath.replace(/[\\/]+$/, "");
  const segments = trimmed.split(/[\\/]/);
  return segments[segments.length - 1] ?? "";
}

/**
 * Selects the *directory basename* of the active project's on-disk root —
 * i.e. `path.basename(rootPath)` — which is the `projectId` every
 * tenant-scoped API route (ADR-017/018) expects.
 *
 * IMPORTANT — this is deliberately **not** the active project's `id` field
 * (`StoredProject.id`, mirrored from `project.json`'s internal `id`). A
 * project's on-disk directory name and its `project.json`'s internal `id`
 * are two independently generated UUIDs and are not guaranteed to match.
 * Sending `project.id` where a route expects the directory basename is a
 * silent failure — wrong-or-missing directory, not an auth error. Every
 * client call site that needs to send a tenant-scoped `projectId` to one of
 * the migrated API routes must go through this selector (or
 * {@link getProjectDirectoryId} directly, for callers with a project record
 * that isn't the Redux-selected active project) rather than reading
 * `project.id` or inlining `path.basename(...)`.
 *
 * @param state - Redux root state (typed as `any` to avoid circular imports).
 * @returns The active project's directory basename, or `null` when no
 *   project is selected or it has no `rootPath`.
 */
export const selectActiveProjectDirectoryId = (state: any): string | null => {
  const rootPath = selectActiveProjectRootPath(state);
  return rootPath ? getProjectDirectoryId(rootPath) : null;
};

/**
 * Stable empty feature map returned when a project has no `features` block, so
 * `useSelector(selectActiveProjectFeatures)` keeps a constant reference and
 * doesn't re-render consumers on every unrelated dispatch.
 */
const EMPTY_FEATURES: ProjectFeatureFlags = Object.freeze({});

/**
 * Selects the raw feature-toggle map for the active project. Returns a shared
 * empty object when no project is selected or the project has no `features`
 * block, so an absent flag reads as disabled.
 *
 * @param state - Redux root state (typed as `any` to avoid circular imports).
 */
export const selectActiveProjectFeatures = (
  state: any,
): ProjectFeatureFlags => {
  const id = state?.projects?.selectedProjectId;
  return state?.projects?.projects?.[id]?.features ?? EMPTY_FEATURES;
};

/**
 * Returns whether a single feature is enabled for the active project. An absent
 * project, `features` block, or flag all read as `false`.
 *
 * @param state - Redux root state.
 * @param feature - Feature flag key to test.
 */
export const selectIsFeatureEnabled = (
  state: any,
  feature: keyof ProjectFeatureFlags,
): boolean => {
  return selectActiveProjectFeatures(state)[feature] === true;
};

/** Whether the story-timeline metadata fields are enabled for the active project. */
export const selectTimelineEnabled = (state: any): boolean =>
  selectIsFeatureEnabled(state, "timeline");

/** Whether the Timeline view/tab is enabled for the active project (independent of the date fields). */
export const selectTimelineViewEnabled = (state: any): boolean =>
  selectIsFeatureEnabled(state, "timelineView");

/** Whether the POV feature is enabled for the active project. */
export const selectPovEnabled = (state: any): boolean =>
  selectIsFeatureEnabled(state, "pov");

/** Whether the Synopsis feature is enabled for the active project. */
export const selectSynopsisEnabled = (state: any): boolean =>
  selectIsFeatureEnabled(state, "synopsis");

/** Whether the Notes feature is enabled for the active project. */
export const selectNotesEnabled = (state: any): boolean =>
  selectIsFeatureEnabled(state, "notes");

/** Whether the entity metadata UI is enabled for the active project. */
export const selectEntitiesEnabled = (state: any): boolean =>
  selectIsFeatureEnabled(state, "entities");

/** Whether view-layer inline entity highlighting is enabled for the active project. */
export const selectEntityHighlightingEnabled = (state: any): boolean =>
  selectIsFeatureEnabled(state, "entityHighlighting");

/**
 * Selects the Organizer card-body configuration for the active project, or
 * `null` when none is configured.
 *
 * @param state - Redux root state (typed as `any` to avoid circular imports).
 */
export const selectActiveProjectOrganizerCardBody = (
  state: any,
): OrganizerCardBodyConfig | null => {
  const id = state?.projects?.selectedProjectId;
  return state?.projects?.projects?.[id]?.organizerCardBody ?? null;
};
