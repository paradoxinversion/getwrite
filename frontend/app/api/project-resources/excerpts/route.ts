/**
 * @module app/api/project-resources/excerpts/route
 *
 * Batch endpoint returning short text excerpts for a bounded set of resources
 * (e.g. the cards visible in one Organizer folder), read straight from each
 * `content.txt`. Scoped + on-demand so it stays off the project load path.
 *
 * Route: `POST /api/project-resources/excerpts`
 * Body:    `{ projectId: string; resourceIds: string[]; maxChars?: number }`
 * Success: `{ excerpts: Record<string, string> }` (only resources with content)
 * Failure: `{ error: string }`
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchResourceExcerptsCore } from "../../../../src/lib/models/resource-excerpts-core";
import { InvalidProjectIdCoreError } from "../../../../src/lib/models/resource-crud-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

interface ExcerptsBody {
  projectId: string;
  resourceIds: string[];
  maxChars?: number;
}

/** Upper bound on resourceIds per request — far above any one folder's children. */
const MAX_RESOURCE_IDS = 1000;

async function handlePost(req: NextRequest): Promise<Response> {
  let body: ExcerptsBody;
  try {
    body = (await req.json()) as ExcerptsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { resourceIds, maxChars } = body;
  if (!Array.isArray(resourceIds)) {
    return NextResponse.json(
      { error: "resourceIds must be an array." },
      { status: 400 },
    );
  }
  if (resourceIds.length > MAX_RESOURCE_IDS) {
    return NextResponse.json(
      { error: `Too many resourceIds (max ${MAX_RESOURCE_IDS}).` },
      { status: 400 },
    );
  }

  try {
    const excerpts = await fetchResourceExcerptsCore(
      body.projectId,
      resourceIds,
      maxChars,
    );
    return NextResponse.json({ excerpts });
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    const message =
      error instanceof Error ? error.message : "Failed to read excerpts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withStorageContext(handlePost);
