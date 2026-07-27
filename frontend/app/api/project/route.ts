/**
 * @module app/api/project/route
 *
 * API endpoint for loading a project from disk, including folder descriptors
 * and resource sidecar metadata/plaintext.
 *
 * Route:
 * - `POST /api/project`
 *
 * Expected body:
 * - `{ projectId: string }`
 *
 * Success payload:
 * - `{ project, folders, resources }`
 *
 * Failure payload:
 * - `{ error: string, details: string }` with HTTP 500
 */
import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  loadProjectCore,
} from "../../../src/lib/models/project-crud-core";
import { withStorageContext } from "../_tenant/with-storage-context";
import { respondInvalidProjectId } from "../../../src/lib/models/project-path";

/**
 * Loads a project and related entities from the local filesystem.
 *
 * @param req - Next.js request containing `{ projectId }` JSON body.
 * @returns JSON response with project data on success, or error payload with
 *   HTTP 500 on failure.
 */
async function handlePost(req: NextRequest): Promise<Response> {
  try {
    const { projectId } = (await req.json()) as { projectId: string };

    return NextResponse.json(await loadProjectCore(projectId));
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    return NextResponse.json(
      { error: "Failed to load project", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
