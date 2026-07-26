/**
 * @module app/api/project/editor-config/route
 *
 * API endpoint for updating project editor configuration persisted in `project.json`.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  InvalidProjectIdCoreError,
  updateEditorConfigCore,
} from "../../../../src/lib/models/editor-config-core";
import type { EditorHeadingMap } from "../../../../src/lib/editor-heading-settings";
import type { EditorBodyConfig } from "../../../../src/lib/editor-body-settings";
import { respondInvalidProjectId } from "../../../../src/lib/models/project-path";
import { withStorageContext } from "../../_tenant/with-storage-context";

interface UpdateProjectEditorConfigBody {
  projectId: string;
  headings?: EditorHeadingMap;
  body?: EditorBodyConfig;
}

async function handlePost(req: NextRequest): Promise<Response> {
  try {
    const {
      projectId,
      headings,
      body: bodyConfig,
    } = (await req.json()) as UpdateProjectEditorConfigBody;

    const result = await updateEditorConfigCore({
      projectId,
      headings,
      body: bodyConfig,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidProjectIdCoreError) {
      return respondInvalidProjectId();
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update project editor config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withStorageContext(handlePost);
