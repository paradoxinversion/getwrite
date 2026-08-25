import { NextRequest, NextResponse } from "next/server";
import { getResourceMentions } from "../../../../../src/lib/models/mentions-core";
import { resolveProjectPath } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

/**
 * Lists the entities detected as mentioned within a resource (FR-9).
 *
 * GET /api/resource/:resourceId/mentions?projectId=<uuid>
 *
 * A resource's mentioned entities are looked up directly from the mention
 * index (keyed by `resourceId`), so this route only reads and never
 * triggers (re)detection. Returns `{ mentions: [] }` for a resource with no
 * detected mentions, or for a project with no mention index yet.
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const resourceId = (await params)["resource-id"];
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const resolved = resolveProjectPath(projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  const mentions = await getResourceMentions(projectPath, resourceId);
  return NextResponse.json({ mentions });
}

export const GET = withStorageContext(handleGet);
