/**
 * @module app/api/project/preferences/route
 *
 * API endpoint for updating user preferences persisted in `project.metadata`.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  saveProjectPreferencesCore,
} from "../../../../src/lib/models/project-preferences-core";
import type { ProjectUserPreferences } from "../../../../src/lib/user-preferences";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

interface UpdateProjectPreferencesBody {
  /** Server-validated project identifier (UUID). */
  projectId: string;
  /** Partial preference updates to merge into metadata. */
  preferences: Partial<ProjectUserPreferences>;
}

/**
 * Updates project metadata user preferences in `project.json`.
 *
 * @param req - Incoming Next.js request.
 * @returns Updated metadata payload or an error response.
 */
async function handlePost(req: NextRequest): Promise<Response> {
  try {
    const { projectId, preferences } =
      (await req.json()) as UpdateProjectPreferencesBody;

    if (!preferences) {
      return NextResponse.json(
        { error: "Missing projectId or preferences" },
        { status: 400 },
      );
    }

    const result = await saveProjectPreferencesCore(projectId, preferences);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    const message =
      error instanceof Error ? error.message : "Failed to update preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withStorageContext(handlePost);
