/**
 * @module app/api/project/revision-settings/route
 *
 * API endpoint for updating the default revision name setting persisted in `project.json`.
 *
 * Route:
 * - `POST /api/project/revision-settings` — sets `config.defaultRevisionName`
 *
 * POST body: `{ projectId: string; defaultRevisionName: string }`
 * Success:   `{ defaultRevisionName: string }`
 * Failure:   `{ error: string }`
 */

import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  resolvePreferencesProjectRootOrThrow,
  saveRevisionSettingsCore,
} from "../../../../src/lib/models/project-preferences-core";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

interface UpdateRevisionSettingsBody {
  projectId: string;
  defaultRevisionName: string;
}

async function handlePost(req: NextRequest): Promise<Response> {
  let body: UpdateRevisionSettingsBody;
  try {
    body = (await req.json()) as UpdateRevisionSettingsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { projectId, defaultRevisionName } = body;

  // Resolve/validate projectId up front, matching the pre-lift route's
  // order: an invalid projectId is reported before the
  // `defaultRevisionName` type check.
  try {
    resolvePreferencesProjectRootOrThrow(projectId);
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    throw error;
  }

  if (typeof defaultRevisionName !== "string") {
    return NextResponse.json(
      { error: "Missing required field: defaultRevisionName." },
      { status: 400 },
    );
  }

  try {
    const saved = await saveRevisionSettingsCore(
      projectId,
      defaultRevisionName,
    );
    return NextResponse.json({ defaultRevisionName: saved });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update revision settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const POST = withStorageContext(handlePost);
