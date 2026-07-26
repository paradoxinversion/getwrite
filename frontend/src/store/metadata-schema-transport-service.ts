import type {
  MetadataField,
  MetadataFieldType,
  MetadataGroup,
  MetadataSchema,
} from "../lib/models/types";
import type {
  TypeMigrationEntry,
  OptionsMigrationEntry,
} from "../lib/models/metadata-schema";
import type { FieldValueEntry } from "../../app/api/project/metadata-schema/route";
import { getProjectDirectoryId } from "./projectsSlice";
import { createTransport } from "./transport/create-transport";

export interface MetadataSchemaRequestContext {
  projectId: string;
}

/**
 * Resolves the project context needed for metadata schema requests.
 *
 * `lookupProjectId` is the Redux-internal `projects.projects` map key
 * (mirrored from `project.json`'s `id` field) — it is used only to look up
 * the stored project record, never sent to the API. The `projectId` returned
 * in the context is that project's on-disk directory basename, derived from
 * its `rootPath` via {@link getProjectDirectoryId} (the same derivation
 * `selectActiveProjectDirectoryId` uses for the active project), which is
 * what every tenant-scoped metadata-schema route (ADR-017/018) actually
 * expects. Per FR12, a project's on-disk directory name and its
 * `project.json` `id` are two independently generated UUIDs — sending the
 * wrong one is a silent failure, not an auth error.
 *
 * State is typed as `any` to match the pattern in projectsSlice.ts and avoid
 * a circular import from ./store.
 */
export function resolveMetadataSchemaRequestContext(
  state: any,
  lookupProjectId: string,
): MetadataSchemaRequestContext | { error: string } {
  const project = state?.projects?.projects?.[lookupProjectId];
  if (!project) {
    return { error: "Project not found." };
  }
  if (!project.rootPath) {
    return { error: "Selected project is missing a root path." };
  }
  return { projectId: getProjectDirectoryId(project.rootPath) };
}

interface SchemaResponse {
  schema: MetadataSchema;
}

function getApiErrorMessage(errorBody: unknown, fallback: string): string {
  const body = errorBody as Record<string, unknown> | null | undefined;
  if (body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

async function postToMetadataSchemaRoute(
  body: object,
): Promise<MetadataSchema> {
  const response = await fetch("/api/project/metadata-schema", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      getApiErrorMessage(errorBody, "Metadata schema operation failed."),
    );
  }

  const data = (await response.json()) as SchemaResponse;
  return data.schema;
}

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 1, Task 4)
//
// One MetadataSchemaTransport contract with two implementations selected by
// the build-time runtime, mirroring revision-transport-service.ts /
// query-transport-service.ts:
//
// - Web/hosted/desktop -> httpMetadataSchemaTransport, which carries the
//   original `fetch('/api/project/metadata-schema')` calls byte-for-byte.
// - Native (Capacitor) -> an in-process backend
//   (`./transport/native-metadata-schema-backend`), dynamically imported
//   only when `runtime === "native"`, reusing the shared
//   `lib/models/metadata-schema-dispatch-core.ts` instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `./transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The metadata-schema-route-backed operations both platforms implement.
 * Shared with `./transport/native-metadata-schema-backend`, which imports
 * this type rather than duplicating it.
 */
export interface MetadataSchemaTransport {
  addField(
    context: MetadataSchemaRequestContext,
    groupId: string,
    field: MetadataField,
  ): Promise<MetadataSchema>;

  removeField(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
  ): Promise<MetadataSchema>;

  deprecateField(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
  ): Promise<MetadataSchema>;

  clearField(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
  ): Promise<MetadataSchema>;

  reorderFields(
    context: MetadataSchemaRequestContext,
    groupId: string,
    newKeyOrder: string[],
  ): Promise<MetadataSchema>;

  renameField(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
    newLabel: string,
  ): Promise<MetadataSchema>;

  updateFieldOptions(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
    options: string[],
  ): Promise<MetadataSchema>;

  addGroup(
    context: MetadataSchemaRequestContext,
    group: MetadataGroup,
  ): Promise<MetadataSchema>;

  removeGroup(
    context: MetadataSchemaRequestContext,
    groupId: string,
  ): Promise<MetadataSchema>;

  reorderGroups(
    context: MetadataSchemaRequestContext,
    newGroupIdOrder: string[],
  ): Promise<MetadataSchema>;

  renameFieldKey(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
    newKey: string,
  ): Promise<MetadataSchema>;

  changeFieldType(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
    newType: MetadataFieldType,
  ): Promise<MetadataSchema>;

  updateRefProperties(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
    updates: {
      refFolder?: string | null;
      includeSubfolders?: boolean | null;
      maxSelections?: number | null;
    },
  ): Promise<MetadataSchema>;

  changeFieldTypeWithMigration(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
    newType: MetadataFieldType,
    newOptions: string[],
    migrations: Record<string, TypeMigrationEntry>,
  ): Promise<MetadataSchema>;

  updateFieldOptionsWithMigration(
    context: MetadataSchemaRequestContext,
    groupId: string,
    fieldKey: string,
    newOptions: string[],
    migrations: Record<string, OptionsMigrationEntry>,
  ): Promise<MetadataSchema>;

  /** Fetch aggregated field values for a metadata field. */
  fetchFieldValues(
    projectId: string,
    fieldKey: string,
  ): Promise<FieldValueEntry[]>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `postToMetadataSchemaRoute`/`fetch` call
 * verbatim; preserving it exactly is what keeps the server build unchanged.
 */
export const httpMetadataSchemaTransport: MetadataSchemaTransport = {
  addField(context, groupId, field) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "add-field",
      projectId,
      groupId,
      field,
    });
  },

  removeField(context, groupId, fieldKey) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "remove-field",
      projectId,
      groupId,
      fieldKey,
    });
  },

  deprecateField(context, groupId, fieldKey) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "deprecate-field",
      projectId,
      groupId,
      fieldKey,
    });
  },

  clearField(context, groupId, fieldKey) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "clear-field",
      projectId,
      groupId,
      fieldKey,
    });
  },

  reorderFields(context, groupId, newKeyOrder) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "reorder-fields",
      projectId,
      groupId,
      newKeyOrder,
    });
  },

  renameField(context, groupId, fieldKey, newLabel) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "rename-field",
      projectId,
      groupId,
      fieldKey,
      newLabel,
    });
  },

  updateFieldOptions(context, groupId, fieldKey, options) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "update-field-options",
      projectId,
      groupId,
      fieldKey,
      options,
    });
  },

  addGroup(context, group) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({ action: "add-group", projectId, group });
  },

  removeGroup(context, groupId) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "remove-group",
      projectId,
      groupId,
    });
  },

  reorderGroups(context, newGroupIdOrder) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "reorder-groups",
      projectId,
      newGroupIdOrder,
    });
  },

  renameFieldKey(context, groupId, fieldKey, newKey) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "rename-key",
      projectId,
      groupId,
      fieldKey,
      newKey,
    });
  },

  changeFieldType(context, groupId, fieldKey, newType) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "change-field-type",
      projectId,
      groupId,
      fieldKey,
      newType,
    });
  },

  updateRefProperties(context, groupId, fieldKey, updates) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "update-ref-properties",
      projectId,
      groupId,
      fieldKey,
      ...updates,
    });
  },

  changeFieldTypeWithMigration(
    context,
    groupId,
    fieldKey,
    newType,
    newOptions,
    migrations,
  ) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "change-field-type-with-migration",
      projectId,
      groupId,
      fieldKey,
      newType,
      newOptions,
      migrations,
    });
  },

  updateFieldOptionsWithMigration(
    context,
    groupId,
    fieldKey,
    newOptions,
    migrations,
  ) {
    const { projectId } = context;
    return postToMetadataSchemaRoute({
      action: "update-field-options-with-migration",
      projectId,
      groupId,
      fieldKey,
      newOptions,
      migrations,
    });
  },

  async fetchFieldValues(projectId, fieldKey) {
    const params = new URLSearchParams({ projectId, fieldKey });
    const response = await fetch(
      `/api/project/metadata-schema?${params.toString()}`,
    );
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        getApiErrorMessage(errorBody, "Failed to enumerate field values."),
      );
    }
    const data = (await response.json()) as { values?: FieldValueEntry[] };
    return data.values ?? [];
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("./transport/native-metadata-schema-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveMetadataSchemaTransport: () => Promise<MetadataSchemaTransport> =
  createTransport(httpMetadataSchemaTransport, () =>
    import("./transport/native-metadata-schema-backend").then(
      ({ createNativeMetadataSchemaTransport }) =>
        createNativeMetadataSchemaTransport(),
    ),
  );

export async function postAddField(
  context: MetadataSchemaRequestContext,
  groupId: string,
  field: MetadataField,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.addField(context, groupId, field);
}

export async function postRemoveField(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.removeField(context, groupId, fieldKey);
}

export async function postDeprecateField(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.deprecateField(context, groupId, fieldKey);
}

export async function postClearField(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.clearField(context, groupId, fieldKey);
}

export async function postReorderFields(
  context: MetadataSchemaRequestContext,
  groupId: string,
  newKeyOrder: string[],
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.reorderFields(context, groupId, newKeyOrder);
}

export async function postRenameField(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
  newLabel: string,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.renameField(context, groupId, fieldKey, newLabel);
}

export async function postUpdateFieldOptions(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
  options: string[],
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.updateFieldOptions(context, groupId, fieldKey, options);
}

export async function postAddGroup(
  context: MetadataSchemaRequestContext,
  group: MetadataGroup,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.addGroup(context, group);
}

export async function postRemoveGroup(
  context: MetadataSchemaRequestContext,
  groupId: string,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.removeGroup(context, groupId);
}

export async function postReorderGroups(
  context: MetadataSchemaRequestContext,
  newGroupIdOrder: string[],
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.reorderGroups(context, newGroupIdOrder);
}

export async function postChangeFieldType(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
  newType: MetadataFieldType,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.changeFieldType(context, groupId, fieldKey, newType);
}

export async function postRenameFieldKey(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
  newKey: string,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.renameFieldKey(context, groupId, fieldKey, newKey);
}

export async function postUpdateRefProperties(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
  updates: {
    refFolder?: string | null;
    includeSubfolders?: boolean | null;
    maxSelections?: number | null;
  },
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.updateRefProperties(context, groupId, fieldKey, updates);
}

export async function postUpdateFieldOptionsWithMigration(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
  newOptions: string[],
  migrations: Record<string, OptionsMigrationEntry>,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.updateFieldOptionsWithMigration(
    context,
    groupId,
    fieldKey,
    newOptions,
    migrations,
  );
}

export async function postChangeFieldTypeWithMigration(
  context: MetadataSchemaRequestContext,
  groupId: string,
  fieldKey: string,
  newType: MetadataFieldType,
  newOptions: string[],
  migrations: Record<string, TypeMigrationEntry>,
): Promise<MetadataSchema> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.changeFieldTypeWithMigration(
    context,
    groupId,
    fieldKey,
    newType,
    newOptions,
    migrations,
  );
}

/**
 * Fetch aggregated field values for a metadata field.
 *
 * @param projectId - The project's on-disk directory basename (per FR12,
 *   distinct from `project.json`'s internal `id` — source via
 *   `selectActiveProjectDirectoryId` / `getProjectDirectoryId`).
 * @param fieldKey - The metadata field key to enumerate values for.
 */
export async function fetchFieldValues(
  projectId: string,
  fieldKey: string,
): Promise<FieldValueEntry[]> {
  const transport = await resolveMetadataSchemaTransport();
  return transport.fetchFieldValues(projectId, fieldKey);
}
