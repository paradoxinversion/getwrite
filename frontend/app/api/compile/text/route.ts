import { NextResponse, NextRequest } from "next/server";
import type { CompileBody } from "../../../../src/lib/export/types";
import { compileTextCore } from "../../../../src/lib/models/compile-core";
import { InvalidProjectIdCoreError } from "../../../../src/lib/models/project-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

async function handlePost(req: NextRequest) {
  const body = (await req.json()) as CompileBody;

  try {
    const resolved = await compileTextCore(body);
    return NextResponse.json(resolved);
  } catch (err) {
    if (err instanceof InvalidProjectIdCoreError)
      return respondInvalidProjectId();
    throw err;
  }
}

export const POST = withStorageContext(handlePost);
