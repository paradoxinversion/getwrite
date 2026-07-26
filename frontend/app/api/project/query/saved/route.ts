/**
 * @module app/api/project/query/saved
 *
 * Action-discriminated CRUD endpoint for saved queries.
 *
 * Route:
 * - `POST /api/project/query/saved`
 *
 * All requests carry an `action` field that selects the operation:
 *
 * - `list`   `{ action: "list",   projectId }` → `{ queries: SavedQuery[] }`
 * - `read`   `{ action: "read",   projectId, id }` → `{ query: SavedQuery | null }`
 * - `write`  `{ action: "write",  projectId, query }` → `{ query: SavedQuery }`
 * - `delete` `{ action: "delete", projectId, id }` → `{ deleted: boolean }`
 *
 * Pattern follows `POST /api/project/metadata-schema`.
 *
 * The dispatch logic itself lives in the transport-agnostic
 * `lib/models/saved-query-dispatch-core.ts` (ADR-021 Phase 1, Task 3),
 * reused unmodified by both this route and the native in-process transport
 * (`store/transport/native-query-backend.ts`).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  dispatchSavedQueryAction,
  InvalidSavedQueryError,
  UnknownSavedQueryActionError,
} from "../../../../../src/lib/models/saved-query-dispatch-core";
import { resolveProjectPath } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

// ─── Request shapes ───────────────────────────────────────────────────────────

interface ListRequest {
  action: "list";
  projectId: string;
}

interface ReadRequest {
  action: "read";
  projectId: string;
  id: string;
}

interface WriteRequest {
  action: "write";
  projectId: string;
  query: unknown;
}

interface DeleteRequest {
  action: "delete";
  projectId: string;
  id: string;
}

type SavedQueryRequestBody =
  | ListRequest
  | ReadRequest
  | WriteRequest
  | DeleteRequest;

// ─── Route handler ────────────────────────────────────────────────────────────

async function handlePost(req: NextRequest): Promise<Response> {
  let body: SavedQueryRequestBody;
  try {
    body = (await req.json()) as SavedQueryRequestBody;
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
    const result = await dispatchSavedQueryAction(projectPath, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnknownSavedQueryActionError) {
      return NextResponse.json(
        {
          error: "Invalid action",
          details: "Expected one of: list, read, write, delete",
        },
        { status: 400 },
      );
    }
    if (error instanceof InvalidSavedQueryError) {
      return NextResponse.json(
        { error: "Invalid saved query", details: error.message },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Operation failed";
    return NextResponse.json(
      { error: "Saved query operation failed", details: message },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
