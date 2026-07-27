import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  renameProjectCore,
} from "../../../../src/lib/models/project-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

async function handlePost(req: NextRequest): Promise<Response> {
  const body = await req.json();
  const { projectId, newName } = body as { projectId: string; newName: string };

  try {
    const projectData = await renameProjectCore(projectId, newName);
    return NextResponse.json({ success: true, data: projectData });
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    throw error;
  }
}

export const POST = withStorageContext(handlePost);
