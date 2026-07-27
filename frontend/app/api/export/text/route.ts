import { NextResponse, NextRequest } from "next/server";
import type { ExportCoreBody } from "../../../../src/lib/models/export-core";
import { exportTextCore } from "../../../../src/lib/models/export-core";
import { InvalidProjectIdCoreError } from "../../../../src/lib/models/project-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

async function handlePost(req: NextRequest) {
  const body = (await req.json()) as ExportCoreBody;

  try {
    const resolved = await exportTextCore(body);
    return NextResponse.json(resolved);
  } catch (err) {
    if (err instanceof InvalidProjectIdCoreError)
      return respondInvalidProjectId();
    throw err;
  }
}

export const POST = withStorageContext(handlePost);
