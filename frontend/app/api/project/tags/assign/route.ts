/**
 * @module app/api/project/tags/assign/route
 *
 * API endpoint for assigning or unassigning a tag from a resource.
 *
 * Route:
 * - `POST /api/project/tags/assign`
 *
 * Expected body:
 * - `{ projectId: string, resourceId: string, tagId: string, assign: boolean }`
 */
import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  assignTagCore,
} from "../../../../../src/lib/models/tags-crud-core";
import { respondInvalidProjectId } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

interface AssignTagRequestBody {
  projectId: string;
  resourceId: string;
  tagId: string;
  assign: boolean;
}

async function handlePost(req: NextRequest): Promise<Response> {
  let body: AssignTagRequestBody;
  try {
    body = (await req.json()) as AssignTagRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  try {
    await assignTagCore(
      body.projectId,
      body.resourceId,
      body.tagId,
      body.assign,
    );
    return NextResponse.json({});
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    return NextResponse.json(
      {
        error: "Failed to update tag assignment",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
