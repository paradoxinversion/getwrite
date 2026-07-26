/**
 * @module app/api/project/tags/route
 *
 * API endpoint for listing, creating, and querying project-scoped tags.
 *
 * Route:
 * - `POST /api/project/tags`
 *
 * Expected body (list all project tags):
 * - `{ action: "list", projectId: string }`
 *
 * Expected body (create tag):
 * - `{ action: "create", projectId: string, name: string, color?: string }`
 *
 * Expected body (get tag IDs assigned to a resource):
 * - `{ action: "assignments", projectId: string, resourceId: string }`
 */
import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  createTagCore,
  listTagAssignmentsCore,
  listTagsCore,
  resolveTagsProjectRootOrThrow,
} from "../../../../src/lib/models/tags-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

interface ListTagsRequest {
  action: "list";
  projectId: string;
}

interface CreateTagRequest {
  action: "create";
  projectId: string;
  name: string;
  color?: string;
}

interface AssignmentsRequest {
  action: "assignments";
  projectId: string;
  resourceId: string;
}

type TagsRequestBody = ListTagsRequest | CreateTagRequest | AssignmentsRequest;

async function handlePost(req: NextRequest): Promise<Response> {
  let body: TagsRequestBody;
  try {
    body = (await req.json()) as TagsRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  // Resolve/validate projectId up front, matching the pre-lift route's
  // order: an invalid projectId is reported even when `action` is also
  // unrecognized (the per-action core calls below re-resolve internally;
  // this call exists purely to preserve that ordering).
  try {
    resolveTagsProjectRootOrThrow(body.projectId);
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    throw error;
  }

  try {
    if (body.action === "list") {
      const tags = await listTagsCore(body.projectId);
      return NextResponse.json({ tags });
    }

    if (body.action === "create") {
      const tag = await createTagCore(body.projectId, body.name, body.color);
      return NextResponse.json({ tag });
    }

    if (body.action === "assignments") {
      const tagIds = await listTagAssignmentsCore(
        body.projectId,
        body.resourceId,
      );
      return NextResponse.json({ tagIds });
    }

    return NextResponse.json(
      {
        error: "Invalid action",
        details: "Expected 'list', 'create', or 'assignments'",
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Tags operation failed", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
