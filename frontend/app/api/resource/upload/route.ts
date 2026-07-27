import { NextResponse } from "next/server";

import { resolveProjectPath } from "../../../../src/lib/models/project-path";
import {
  MediaUploadValidationError,
  uploadMediaResourceCore,
} from "../../../../src/lib/models/resource-crud-core";
import { validateMediaFile } from "../../../../src/lib/models/media-validation";
import { withStorageContext } from "../../_tenant/with-storage-context";

/**
 * Creates an image/audio resource from a multipart upload.
 *
 * Expects `multipart/form-data` with `file` (the binary), `projectId`, and
 * optional `title` and `folderId`. The file is validated, type-specific
 * metadata is extracted, and the resource plus its binary are persisted.
 */
async function handlePost(req: Request): Promise<Response> {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const projectId = form.get("projectId");
    const title = form.get("title");
    const folderIdRaw = form.get("folderId");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A 'file' field is required." },
        { status: 400 },
      );
    }

    const resolved = resolveProjectPath(
      typeof projectId === "string" ? projectId : "",
    );
    if (resolved instanceof Response) return resolved;

    // Enforce the media type/size cap BEFORE buffering the entire file into
    // memory. uploadMediaResourceCore re-validates for native callers that
    // already hold the bytes, but for this HTTP path an oversized file must be
    // rejected without first allocating a full-file copy via arrayBuffer() —
    // otherwise the size cap no longer gates that allocation (a memory-
    // exhaustion vector). This restores the pre-transport-collapse ordering.
    const preCheck = validateMediaFile({
      mime: file.type || undefined,
      ext: file.name,
      size: file.size,
    });
    if (!preCheck.ok) {
      return NextResponse.json(
        { error: preCheck.message, reason: preCheck.reason },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    try {
      const resource = await uploadMediaResourceCore(
        typeof projectId === "string" ? projectId : "",
        {
          fileBytes: bytes,
          fileName: file.name,
          mimeType: file.type || undefined,
          fileSize: file.size,
          title: typeof title === "string" ? title : undefined,
          folderId: typeof folderIdRaw === "string" ? folderIdRaw : undefined,
        },
      );
      return NextResponse.json({ success: true, resource });
    } catch (error) {
      if (error instanceof MediaUploadValidationError) {
        return NextResponse.json(
          { error: error.message, reason: error.reason },
          { status: 400 },
        );
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to upload media",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);
