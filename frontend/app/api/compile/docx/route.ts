import { NextRequest } from "next/server";
import type { CompileBody } from "../../../../src/lib/export/types";
import { compileDocxCore } from "../../../../src/lib/models/compile-core";
import { InvalidProjectIdCoreError } from "../../../../src/lib/models/project-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

async function handlePost(req: NextRequest) {
  const body = (await req.json()) as CompileBody;

  let resolved;
  try {
    resolved = await compileDocxCore(body);
  } catch (err) {
    if (err instanceof InvalidProjectIdCoreError)
      return respondInvalidProjectId();
    throw err;
  }

  return new Response(new Uint8Array(resolved.arrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${resolved.filename}"`,
    },
  });
}

export const POST = withStorageContext(handlePost);
