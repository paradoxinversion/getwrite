import { NextRequest } from "next/server";
import type { CompileBody } from "../../../../src/lib/export/types";
import { compilePdfCore } from "../../../../src/lib/models/compile-core";
import { InvalidProjectIdCoreError } from "../../../../src/lib/models/project-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

async function handlePost(req: NextRequest) {
  const body = (await req.json()) as CompileBody;

  let resolved;
  try {
    resolved = await compilePdfCore(body);
  } catch (err) {
    if (err instanceof InvalidProjectIdCoreError)
      return respondInvalidProjectId();
    throw err;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${resolved.filename}"`,
  };
  if (resolved.warning === "font-fallback") {
    headers["X-Compile-Warning"] = "font-fallback";
  }

  return new Response(new Uint8Array(resolved.arrayBuffer), { headers });
}

export const POST = withStorageContext(handlePost);
