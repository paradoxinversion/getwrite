import type { NextRequest } from "next/server";
import {
  ReorderProjectNotFoundError,
  reorderResourcesCore,
} from "../../../../../src/lib/models/resource-crud-core";
import { withStorageContext } from "../../../_tenant/with-storage-context";

async function reorder(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const projectId = (await params)["projectId"];
  const body = await req.json().catch(() => ({}));
  const folderOrder: Array<{
    id: string;
    orderIndex: number;
    folderId?: string | null;
  }> = body.folderOrder ?? [];
  const resourceOrder: Array<{
    id: string;
    orderIndex: number;
    folderId?: string | null;
  }> = body.resourceOrder ?? [];

  try {
    await reorderResourcesCore(projectId, {
      folderOrder,
      resourceOrder,
      projectRootOverride: body.projectRoot,
    });
  } catch (err) {
    if (err instanceof ReorderProjectNotFoundError) {
      return new Response(JSON.stringify({ error: "project not found" }), {
        status: 404,
      });
    }
    throw err;
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

export const POST = withStorageContext(reorder);

export const GET = withStorageContext(() => new Response(null, { status: 200 }));
