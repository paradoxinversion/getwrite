import { NextResponse } from "next/server";
import { CreateResourceOpts } from "../../../src/lib/models";
import {
  InvalidProjectIdCoreError,
  createResourceCore,
} from "../../../src/lib/models/resource-crud-core";
import { respondInvalidProjectId } from "../../../src/lib/models/project-path";
import { withStorageContext } from "../_tenant/with-storage-context";

interface SaveResourceBody {
  projectId: string;
  resourceData: CreateResourceOpts;
}

async function handlePost(req: Request): Promise<Response> {
  let body: SaveResourceBody;
  try {
    body = (await req.json()) as SaveResourceBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  try {
    const resource = await createResourceCore(
      body.projectId,
      body.resourceData,
    );
    return NextResponse.json({ success: true, resource });
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    return NextResponse.json(
      { error: "Failed to save resource", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
