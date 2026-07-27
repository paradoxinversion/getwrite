/**
 * @module app/api/resource/[resource-id]/rename/route
 *
 * Renames a resource by updating the `name` field in its sidecar metadata file.
 *
 * Route:
 * - `POST /api/resource/[resource-id]/rename` — rename the resource
 *
 * POST expected body: `{ projectId: string; newName: string }`
 * Success payload: `{ resource: Record<string, MetadataValue> }`
 * Failure payload: `{ error: string }`
 */

import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  renameFolderCore,
  renameResourceSidecarCore,
} from "../../../../../src/lib/models/resource-crud-core";
import type { MetadataValue } from "../../../../../src/lib/models/types";
import { respondInvalidProjectId } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

interface RenameResourceBody {
  projectId: string;
  newName: string;
  resourceType?: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const resourceId = (await params)["resource-id"];

  let body: RenameResourceBody;
  try {
    body = (await req.json()) as RenameResourceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { projectId, newName, resourceType } = body;

  if (!newName || typeof newName !== "string" || !newName.trim()) {
    return NextResponse.json(
      { error: "Missing required field: newName." },
      { status: 400 },
    );
  }

  if (resourceType === "folder") {
    try {
      const updated = await renameFolderCore(
        projectId,
        resourceId,
        newName.trim(),
      );
      if (updated === null) {
        return NextResponse.json(
          { error: "Resource not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({
        resource: updated as Record<string, MetadataValue>,
      });
    } catch (error) {
      if (error instanceof InvalidProjectIdCoreError) {
        return respondInvalidProjectId();
      }
      return NextResponse.json(
        { error: errorMessage(error, "Failed to rename folder.") },
        { status: 500 },
      );
    }
  }

  try {
    const updatedData = await renameResourceSidecarCore(
      projectId,
      resourceId,
      newName.trim(),
    );

    if (updatedData === null) {
      return NextResponse.json(
        { error: "Resource not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ resource: updatedData });
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    return NextResponse.json(
      { error: errorMessage(error, "Failed to rename resource.") },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
