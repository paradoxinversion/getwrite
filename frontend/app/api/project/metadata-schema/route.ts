/**
 * @module app/api/project/metadata-schema/route
 *
 * API endpoint for managing the dynamic metadata schema stored in project.json.
 *
 * Route:
 * - `POST /api/project/metadata-schema`
 *
 * All requests are action-discriminated via the `action` field in the body.
 * Every success response returns the full updated schema so Redux can replace
 * state without a re-fetch.
 *
 * Slug validation (`/^[a-z0-9-]+$/`) is applied here, in the `add-field`
 * handler only, so that persisted camelCase built-in keys (e.g. `storyDate`)
 * round-trip cleanly through `ProjectConfigSchema.safeParse()` without hitting
 * this guard.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  dispatchMetadataSchemaAction,
  fetchFieldValues,
  InvalidFieldKeyError,
  UnknownMetadataSchemaActionError,
} from "../../../../src/lib/models/metadata-schema-dispatch-core";
import type {
  TypeMigrationEntry,
  OptionsMigrationEntry,
} from "../../../../src/lib/models/metadata-schema";
import type {
  MetadataField,
  MetadataFieldType,
  MetadataGroup,
  MetadataSchema,
} from "../../../../src/lib/models/types";
import { resolveProjectPath } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

// ---------------------------------------------------------------------------
// Request shapes
// ---------------------------------------------------------------------------

interface AddFieldRequest {
  action: "add-field";
  projectId: string;
  groupId: string;
  field: MetadataField;
}

interface RemoveFieldRequest {
  action: "remove-field";
  projectId: string;
  groupId: string;
  fieldKey: string;
}

interface DeprecateFieldRequest {
  action: "deprecate-field";
  projectId: string;
  groupId: string;
  fieldKey: string;
}

interface ClearFieldRequest {
  action: "clear-field";
  projectId: string;
  groupId: string;
  fieldKey: string;
}

interface ReorderFieldsRequest {
  action: "reorder-fields";
  projectId: string;
  groupId: string;
  newKeyOrder: string[];
}

interface RenameFieldRequest {
  action: "rename-field";
  projectId: string;
  groupId: string;
  fieldKey: string;
  newLabel: string;
}

interface UpdateFieldOptionsRequest {
  action: "update-field-options";
  projectId: string;
  groupId: string;
  fieldKey: string;
  options: string[];
}

interface AddGroupRequest {
  action: "add-group";
  projectId: string;
  group: MetadataGroup;
}

interface RemoveGroupRequest {
  action: "remove-group";
  projectId: string;
  groupId: string;
}

interface ReorderGroupsRequest {
  action: "reorder-groups";
  projectId: string;
  newGroupIdOrder: string[];
}

interface RenameFieldKeyRequest {
  action: "rename-key";
  projectId: string;
  groupId: string;
  fieldKey: string;
  newKey: string;
}

interface ChangeFieldTypeRequest {
  action: "change-field-type";
  projectId: string;
  groupId: string;
  fieldKey: string;
  newType: MetadataFieldType;
}

interface UpdateRefPropertiesRequest {
  action: "update-ref-properties";
  projectId: string;
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
  projectId: string;
  groupId: string;
  fieldKey: string;
  newType: MetadataFieldType;
  newOptions: string[];
  migrations: Record<string, TypeMigrationEntry>;
}

interface UpdateFieldOptionsWithMigrationRequest {
  action: "update-field-options-with-migration";
  projectId: string;
  groupId: string;
  fieldKey: string;
  newOptions: string[];
  migrations: Record<string, OptionsMigrationEntry>;
}

type MetadataSchemaRequestBody =
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

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface SchemaResponse {
  schema: MetadataSchema;
}

interface ErrorResponse {
  error: string;
  details: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function okSchema(schema: MetadataSchema): NextResponse<SchemaResponse> {
  return NextResponse.json({ schema });
}

function invalidFieldKey(key: string): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: "Invalid field key",
      details: `Key "${key}" must match /^[a-z0-9-]+$/`,
    },
    { status: 400 },
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

async function handlePost(req: NextRequest): Promise<Response> {
  let body: MetadataSchemaRequestBody;
  try {
    body = (await req.json()) as MetadataSchemaRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  const resolved = resolveProjectPath(body.projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  try {
    const schema = await dispatchMetadataSchemaAction(projectPath, body);
    return okSchema(schema);
  } catch (error) {
    if (error instanceof InvalidFieldKeyError) {
      return invalidFieldKey(error.key);
    }

    if (error instanceof UnknownMetadataSchemaActionError) {
      return NextResponse.json(
        { error: "Invalid action", details: error.message },
        { status: 400 },
      );
    }

    const message = (error as Error).message;
    const isClientError =
      /locked/i.test(message) ||
      /not found/i.test(message) ||
      /already exists/i.test(message) ||
      /Invalid field key/i.test(message) ||
      /must contain exactly/i.test(message);

    return NextResponse.json(
      { error: "Metadata schema operation failed", details: message },
      { status: isClientError ? 400 : 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/project/metadata-schema?projectId=...&fieldKey=...
// Returns a serialized frequency map of distinct values for a single field.
// ---------------------------------------------------------------------------

export type { FieldValueEntry } from "../../../../src/lib/models/metadata-schema-dispatch-core";

async function handleGet(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");
  const fieldKey = searchParams.get("fieldKey");

  const resolved = resolveProjectPath(projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  if (!fieldKey) {
    return NextResponse.json(
      { error: "fieldKey is required" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchFieldValues(projectPath, fieldKey);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to enumerate field values",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
export const GET = withStorageContext(handleGet);
