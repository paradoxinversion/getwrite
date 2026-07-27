import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  fetchResourceContentCore,
} from "../../../src/lib/models/resource-crud-core";
import { respondInvalidProjectId } from "../../../src/lib/models/project-path";
import { withStorageContext } from "../_tenant/with-storage-context";

interface ProjectResourcesRequestBody {
  projectId: string;
  resourceId: string;
}

// Fetch project resources from the filesystem
// Body expects a server-validated projectId (resolved to the on-disk project
// directory) plus a resourceId.
async function handlePost(req: NextRequest): Promise<Response> {
  let body: ProjectResourcesRequestBody;
  try {
    body = (await req.json()) as ProjectResourcesRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  try {
    const { resourceContent, revisions } = await fetchResourceContentCore(
      body.projectId,
      body.resourceId,
    );

    return NextResponse.json({
      message: "Project resources endpoint",
      resourceContent,
      revisions,
    });
  } catch (err) {
    if (err instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    console.error("Error fetching project resource:", err);
    return NextResponse.json(
      {
        message: "Error fetching project resource",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 404 },
    );
  }
}

export const POST = withStorageContext(handlePost);
