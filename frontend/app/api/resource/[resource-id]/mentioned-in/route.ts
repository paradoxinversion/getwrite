import { NextRequest, NextResponse } from "next/server";
import { getEntityMentionedIn } from "../../../../../src/lib/models/mentions-core";
import { resolveProjectPath } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

/**
 * Lists every resource mentioning an entity, with one snippet per
 * occurrence (FR-10).
 *
 * GET /api/resource/:resourceId/mentioned-in?projectId=<uuid>
 *
 * The `:resourceId` segment here names the *entity* resource whose mentions
 * are being looked up — reusing the `resource/:resourceId` route family
 * because an entity is an ordinary resource distinguished only by sidecar
 * metadata (FR-1), not a separate route namespace. Returns
 * `{ mentionedIn: [] }` when the entity has no detected mentions.
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const entityId = (await params)["resource-id"];
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const resolved = resolveProjectPath(projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  const mentionedIn = await getEntityMentionedIn(projectPath, entityId);
  return NextResponse.json({ mentionedIn });
}

export const GET = withStorageContext(handleGet);
