import { NextRequest, NextResponse } from "next/server";
import {
  deleteProjectCore,
  InvalidProjectIdCoreError,
} from "../../../../src/lib/models/project-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

async function handlePost(req: NextRequest): Promise<Response> {
  const body = await req.json();
  const { projectId } = body as { projectId: string };

  try {
    await deleteProjectCore(projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    throw error;
  }
}

export const POST = withStorageContext(handlePost);
