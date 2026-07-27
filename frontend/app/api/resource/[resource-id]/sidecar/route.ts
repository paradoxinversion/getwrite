import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  updateSidecarCore,
} from "../../../../../src/lib/models/resource-crud-core";
import { respondInvalidProjectId } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

interface SidecarUpdateBody {
  projectId: string;
  updatedResource: Record<string, unknown>;
}

// Updates to resource metadata (notes, status, characters, locations, items, pov)
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const resourceId = (await params)["resource-id"];

  let body: SidecarUpdateBody;
  try {
    body = (await req.json()) as SidecarUpdateBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  try {
    await updateSidecarCore(body.projectId, resourceId, body.updatedResource);
    return NextResponse.json({ message: "Sidecar updated." });
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    throw error;
  }
}

export const POST = withStorageContext(handlePost);
