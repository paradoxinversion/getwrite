/**
 * @module app/api/project/tags/delete/route
 *
 * API endpoint for deleting a project-scoped tag and all its assignments.
 *
 * Route:
 * - `POST /api/project/tags/delete`
 *
 * Expected body:
 * - `{ projectId: string, tagId: string }`
 */
import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  deleteTagCore,
} from "../../../../../src/lib/models/tags-crud-core";
import { respondInvalidProjectId } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

interface DeleteTagRequestBody {
  projectId: string;
  tagId: string;
}

async function handlePost(req: NextRequest): Promise<Response> {
  let body: DeleteTagRequestBody;
  try {
    body = (await req.json()) as DeleteTagRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  try {
    const didDelete = await deleteTagCore(body.projectId, body.tagId);
    return NextResponse.json({ deleted: didDelete });
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    return NextResponse.json(
      { error: "Failed to delete tag", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
