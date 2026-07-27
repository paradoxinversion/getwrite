import { NextRequest, NextResponse } from "next/server";
import {
  ProjectNotFoundByInternalIdError,
  reindexProjectByInternalIdCore,
} from "../../../../../src/lib/models/project-crud-core";
import { withStorageContext } from "../../../_tenant/with-storage-context";

interface ReindexResponse {
  queued: number;
}

interface ErrorResponse {
  error: string;
}

async function reindex(
  _req: NextRequest,
  { params }: { params: Promise<{ "project-id": string }> },
): Promise<NextResponse<ReindexResponse | ErrorResponse>> {
  const projectId = (await params)["project-id"];

  try {
    const result = await reindexProjectByInternalIdCore(projectId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ProjectNotFoundByInternalIdError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

export const POST = withStorageContext(reindex);

export const dynamic = "force-dynamic";
