// Last Updated: 2026-07-25

/**
 * @module metadata-schema-dispatch-core
 *
 * **ADR-021 Phase 1 (Task 4) — transport-agnostic metadata-schema core.** The
 * action-discriminated dispatch logic behind
 * `app/api/project/metadata-schema/route.ts`'s `POST` handler, plus the
 * `GET` handler's field-value enumeration, lifted so both can be reused by
 * the HTTP route (web/desktop) and the native in-process transport
 * (`store/transport/native-metadata-schema-backend.ts`) with byte-for-byte
 * identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. Every function operates on a plain
 * `projectRoot: string` and throws plain `Error`s (or the typed
 * {@link InvalidFieldKeyError} below); the route catches those errors and
 * maps them to its existing HTTP status codes, and the native backend lets
 * them propagate directly to the caller.
 *
 * Per FR3, the route's inline `SLUG_RE` validation (previously constructing
 * a `NextResponse` 400 directly) is reproduced here as a thrown
 * {@link InvalidFieldKeyError} — carrying the offending key so the route can
 * reconstruct its exact pre-refactor response shape/status, while the
 * error's `message` still matches the route's generic `/Invalid field
 * key/i` catch-all classification for any caller (e.g. native) that doesn't
 * special-case it.
 */
import {
  addField,
  removeField,
  deprecateField,
  clearField,
  reorderFields,
  renameField,
  updateFieldOptions,
  updateFieldOptionsWithMigration,
  updateRefProperties,
  changeFieldType,
  changeFieldTypeWithMigration,
  addGroup,
  removeGroup,
  reorderGroups,
  renameFieldKey,
} from "./metadata-schema";
import type {
  TypeMigrationEntry,
  OptionsMigrationEntry,
} from "./metadata-schema";
import {
  scanAllFieldValues,
  NULL_VALUE_KEY,
  MISSING_VALUE_KEY,
} from "./field-values";
import type {
  MetadataField,
  MetadataFieldType,
  MetadataGroup,
  MetadataSchema,
} from "./types";

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Thrown when a candidate field/group key fails `SLUG_RE`
 * (`/^[a-z0-9-]+$/`). Carries the offending `key` so callers that want the
 * pre-refactor HTTP response shape (see the route's `invalidFieldKey`
 * helper) can reconstruct it; `message` matches the route's `/Invalid field
 * key/i` catch-all classification regex for callers that don't.
 */
export class InvalidFieldKeyError extends Error {
  constructor(public readonly key: string) {
    super(`Invalid field key: "${key}". Must match /^[a-z0-9-]+$/`);
    this.name = "InvalidFieldKeyError";
  }
}

// ---------------------------------------------------------------------------
// Request shapes (mirrors the route's per-action request interfaces, minus
// `projectId` — the caller resolves `projectId -> projectRoot` itself, via
// `resolveProjectPath` on the HTTP side or `resolveProjectRoot` natively).
// ---------------------------------------------------------------------------

interface AddFieldRequest {
  action: "add-field";
  groupId: string;
  field: MetadataField;
}

interface RemoveFieldRequest {
  action: "remove-field";
  groupId: string;
  fieldKey: string;
}

interface DeprecateFieldRequest {
  action: "deprecate-field";
  groupId: string;
  fieldKey: string;
}

interface ClearFieldRequest {
  action: "clear-field";
  groupId: string;
  fieldKey: string;
}

interface ReorderFieldsRequest {
  action: "reorder-fields";
  groupId: string;
  newKeyOrder: string[];
}

interface RenameFieldRequest {
  action: "rename-field";
  groupId: string;
  fieldKey: string;
  newLabel: string;
}

interface UpdateFieldOptionsRequest {
  action: "update-field-options";
  groupId: string;
  fieldKey: string;
  options: string[];
}

interface AddGroupRequest {
  action: "add-group";
  group: MetadataGroup;
}

interface RemoveGroupRequest {
  action: "remove-group";
  groupId: string;
}

interface ReorderGroupsRequest {
  action: "reorder-groups";
  newGroupIdOrder: string[];
}

interface RenameFieldKeyRequest {
  action: "rename-key";
  groupId: string;
  fieldKey: string;
  newKey: string;
}

interface ChangeFieldTypeRequest {
  action: "change-field-type";
  groupId: string;
  fieldKey: string;
  newType: MetadataFieldType;
}

interface UpdateRefPropertiesRequest {
  action: "update-ref-properties";
  groupId: string;
  fieldKey: string;
  /** `null` clears the property; absent leaves it unchanged. */
  refFolder?: string | null;
  /** `null` clears the property; absent leaves it unchanged. */
  includeSubfolders?: boolean | null;
  /** `null` clears the property; absent leaves it unchanged. */
  maxSelections?: number | null;
}

interface ChangeFieldTypeWithMigrationRequest {
  action: "change-field-type-with-migration";
  groupId: string;
  fieldKey: string;
  newType: MetadataFieldType;
  newOptions: string[];
  migrations: Record<string, TypeMigrationEntry>;
}

interface UpdateFieldOptionsWithMigrationRequest {
  action: "update-field-options-with-migration";
  groupId: string;
  fieldKey: string;
  newOptions: string[];
  migrations: Record<string, OptionsMigrationEntry>;
}

export type MetadataSchemaDispatchRequest =
  | AddFieldRequest
  | RemoveFieldRequest
  | DeprecateFieldRequest
  | ClearFieldRequest
  | ReorderFieldsRequest
  | RenameFieldRequest
  | UpdateFieldOptionsRequest
  | AddGroupRequest
  | RemoveGroupRequest
  | ReorderGroupsRequest
  | RenameFieldKeyRequest
  | ChangeFieldTypeRequest
  | UpdateRefPropertiesRequest
  | ChangeFieldTypeWithMigrationRequest
  | UpdateFieldOptionsWithMigrationRequest;

/**
 * Thrown when `action` is not one of the 14 known metadata-schema actions.
 * Its message matches the route's pre-refactor "Invalid action" response
 * details, so a caller that special-cases it can reconstruct that response.
 */
export class UnknownMetadataSchemaActionError extends Error {
  constructor() {
    super(
      "Expected one of: add-field, remove-field, reorder-fields, " +
        "rename-field, update-field-options, update-ref-properties, " +
        "change-field-type, add-group, remove-group, reorder-groups, " +
        "rename-key",
    );
    this.name = "UnknownMetadataSchemaActionError";
  }
}

/**
 * Dispatches a single action-discriminated metadata-schema mutation against
 * `projectRoot`, returning the full updated {@link MetadataSchema}.
 *
 * Reproduces all 14 POST actions' exact bodies from the pre-refactor route
 * handler, including the `update-ref-properties` action's `"key" in body`
 * conditional-field-presence logic (each of `refFolder` / `includeSubfolders`
 * / `maxSelections` is forwarded only when the caller's request object
 * actually has that key — `undefined` and "absent" are distinct here).
 *
 * @throws {InvalidFieldKeyError} When `add-field`'s `field.key` or
 *   `rename-key`'s `newKey` fails `SLUG_RE`.
 * @throws {UnknownMetadataSchemaActionError} When `request.action` is not
 *   one of the 14 known actions.
 */
export async function dispatchMetadataSchemaAction(
  projectRoot: string,
  request: MetadataSchemaDispatchRequest,
): Promise<MetadataSchema> {
  switch (request.action) {
    case "add-field": {
      if (!SLUG_RE.test(request.field.key)) {
        throw new InvalidFieldKeyError(request.field.key);
      }
      return addField(projectRoot, request.groupId, request.field);
    }

    case "remove-field": {
      return removeField(projectRoot, request.groupId, request.fieldKey);
    }

    case "deprecate-field": {
      return deprecateField(projectRoot, request.groupId, request.fieldKey);
    }

    case "clear-field": {
      return clearField(projectRoot, request.groupId, request.fieldKey);
    }

    case "reorder-fields": {
      return reorderFields(projectRoot, request.groupId, request.newKeyOrder);
    }

    case "rename-field": {
      return renameField(
        projectRoot,
        request.groupId,
        request.fieldKey,
        request.newLabel,
      );
    }

    case "update-field-options": {
      return updateFieldOptions(
        projectRoot,
        request.groupId,
        request.fieldKey,
        request.options,
      );
    }

    case "add-group": {
      return addGroup(projectRoot, request.group);
    }

    case "remove-group": {
      return removeGroup(projectRoot, request.groupId);
    }

    case "reorder-groups": {
      return reorderGroups(projectRoot, request.newGroupIdOrder);
    }

    case "rename-key": {
      if (!SLUG_RE.test(request.newKey)) {
        throw new InvalidFieldKeyError(request.newKey);
      }
      return renameFieldKey(
        projectRoot,
        request.groupId,
        request.fieldKey,
        request.newKey,
      );
    }

    case "change-field-type": {
      return changeFieldType(
        projectRoot,
        request.groupId,
        request.fieldKey,
        request.newType,
      );
    }

    case "change-field-type-with-migration": {
      return changeFieldTypeWithMigration(
        projectRoot,
        request.groupId,
        request.fieldKey,
        request.newType,
        request.newOptions,
        request.migrations,
      );
    }

    case "update-field-options-with-migration": {
      return updateFieldOptionsWithMigration(
        projectRoot,
        request.groupId,
        request.fieldKey,
        request.newOptions,
        request.migrations,
      );
    }

    case "update-ref-properties": {
      const updates: {
        refFolder?: string | null;
        includeSubfolders?: boolean | null;
        maxSelections?: number | null;
      } = {};
      if ("refFolder" in request) updates.refFolder = request.refFolder;
      if ("includeSubfolders" in request)
        updates.includeSubfolders = request.includeSubfolders;
      if ("maxSelections" in request)
        updates.maxSelections = request.maxSelections;
      return updateRefProperties(
        projectRoot,
        request.groupId,
        request.fieldKey,
        updates,
      );
    }

    default:
      throw new UnknownMetadataSchemaActionError();
  }
}

// ---------------------------------------------------------------------------
// GET-equivalent: field-value enumeration
// ---------------------------------------------------------------------------

/** A single distinct value's aggregated frequency, as returned to callers. */
export interface FieldValueEntry {
  /** Canonical string key (use `nullKey` / `missingKey` sentinels). */
  canonicalKey: string;
  count: number;
  /** One representative value for display and type introspection. */
  sample: unknown;
}

export interface FetchFieldValuesResult {
  values: FieldValueEntry[];
  nullKey: string;
  missingKey: string;
}

/**
 * Enumerates the distinct values (with counts) for `fieldKey` across every
 * resource sidecar in `projectRoot`. The transport-agnostic counterpart of
 * the route's `GET` handler.
 */
export async function fetchFieldValues(
  projectRoot: string,
  fieldKey: string,
): Promise<FetchFieldValuesResult> {
  const map = await scanAllFieldValues(projectRoot, fieldKey);
  const values: FieldValueEntry[] = Array.from(
    map.entries(),
    ([canonicalKey, entry]) => ({
      canonicalKey,
      count: entry.count,
      sample: entry.sample,
    }),
  );
  return { values, nullKey: NULL_VALUE_KEY, missingKey: MISSING_VALUE_KEY };
}
