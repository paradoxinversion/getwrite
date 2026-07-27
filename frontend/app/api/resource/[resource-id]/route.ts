import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  copyResourceCore,
  deleteResourceCore,
} from "../../../../src/lib/models/resource-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

interface ResourceActionBody {
  projectId: string;
  action: "delete" | "copy";
  newName?: string;
}

// Updates to resource metadata (notes, status, characters, locations, items, pov)
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const resourceId = (await params)["resource-id"];

  let body: ResourceActionBody;
  try {
    body = (await req.json()) as ResourceActionBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  const { action } = body;

  try {
    switch (action) {
      case "delete": {
        await deleteResourceCore(body.projectId, resourceId);
        return NextResponse.json({ message: "Resource deleted successfully" });
      }
      case "copy": {
        const newResource = await copyResourceCore(
          body.projectId,
          resourceId,
          body.newName ?? "Copy",
        );
        return NextResponse.json({ success: true, resource: newResource });
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    throw error;
  }
}

export const POST = withStorageContext(handlePost);
