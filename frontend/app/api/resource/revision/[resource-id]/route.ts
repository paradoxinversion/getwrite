/**
 * @module api/resource/revision/[resource-id]
 *
 * Next.js route handlers for revision lifecycle on a single resource.
 *
 * GET    /api/resource/revision/:resourceId?projectId=...&revisionId=...
 *   Returns revision metadata and content for a specific revision.
 *
 * POST   /api/resource/revision/:resourceId
 *   Saves a new revision. Body carries a server-validated `projectId`. Reads
 *   current filesystem content when body.content is omitted.
 *
 * PATCH  /api/resource/revision/:resourceId
 *   Marks an existing revision as canonical. Body carries `projectId`.
 *
 * DELETE /api/resource/revision/:resourceId
 *   Removes a revision directory by revision UUID. Body carries `projectId`.
 *
 * Business logic (filesystem reads/writes, revision lookups, the
 * single-canonical invariant) lives in
 * `../../../../../src/lib/models/revision-core.ts`, shared with the native
 * (Capacitor) transport (ADR-021 Phase 1). This module's own responsibility
 * is strictly HTTP: parsing requests, resolving/validating `projectId` via
 * `resolveProjectPath`, and mapping the core's thrown errors to this route's
 * existing status codes and response bodies — unchanged from before the
 * refactor.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createRevision,
  deleteRevision,
  readRevision,
  setCanonicalRevision,
  updateRevisionInPlace,
} from "../../../../../src/lib/models/revision-core";
import type { Revision } from "../../../../../src/lib/models/types";
import { resolveProjectPath } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

interface GetRevisionResponse {
  revision: Revision;
  content: string;
}

/**
 * When `content` is omitted the handler reads the resource's current saved
 * content from the filesystem.
 */
interface SaveRevisionBody {
  projectId: string;
  content?: string;
  author?: string;
  isCanonical?: boolean;
  metadata?: Record<string, unknown>;
}

interface DeleteRevisionBody {
  projectId: string;
  revisionId: string;
}

interface SetCanonicalRevisionBody {
  projectId: string;
  revisionId: string;
  /** Optional revision content to persist in-place for canonical revisions. */
  content?: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Parses the JSON body of a request, returning a 400 response on failure. */
async function parseJsonBody<T>(
  req: NextRequest,
): Promise<{ body: T } | NextResponse> {
  try {
    const body = (await req.json()) as T;
    return { body };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

/**
 * Returns a 400 response if `value` is falsy or not a string, otherwise
 * returns null.
 */
function requireString(value: unknown, fieldName: string): NextResponse | null {
  if (!value || typeof value !== "string") {
    return NextResponse.json(
      { error: `Missing required field: ${fieldName}.` },
      { status: 400 },
    );
  }
  return null;
}

/** Builds an error JSON response from a caught value. */
function errorResponse(
  error: unknown,
  fallback: string,
  status?: number,
): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  const resolvedStatus = status ?? (message.includes("not found") ? 404 : 500);
  return NextResponse.json({ error: message }, { status: resolvedStatus });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const resourceId = (await params)["resource-id"];
  const { searchParams } = new URL(req.url);

  const resolved = resolveProjectPath(searchParams.get("projectId"));
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  const revisionId = searchParams.get("revisionId");

  if (!revisionId) {
    return NextResponse.json(
      { error: "Missing required query param: revisionId." },
      { status: 400 },
    );
  }

  try {
    const { revision, content } = await readRevision(
      projectPath,
      resourceId,
      revisionId,
    );
    const responseBody: GetRevisionResponse = { revision, content };
    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    return errorResponse(error, "Failed to retrieve revision.");
  }
}

async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const resourceId = (await params)["resource-id"];

  const parsed = await parseJsonBody<SaveRevisionBody>(req);
  if (parsed instanceof NextResponse) return parsed;
  const {
    projectId,
    content: bodyContent,
    author,
    isCanonical,
    metadata,
  } = parsed.body;

  const resolved = resolveProjectPath(projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  try {
    const revision = await createRevision(projectPath, resourceId, {
      content: bodyContent,
      author,
      isCanonical,
      metadata,
    });

    return NextResponse.json(revision, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to save revision.", 500);
  }
}

async function handleDelete(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const resourceId = (await params)["resource-id"];

  const parsed = await parseJsonBody<DeleteRevisionBody>(req);
  if (parsed instanceof NextResponse) return parsed;
  const { projectId, revisionId } = parsed.body;

  const resolved = resolveProjectPath(projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  const revisionIdError = requireString(revisionId, "revisionId");
  if (revisionIdError) return revisionIdError;

  try {
    const deleted = await deleteRevision(projectPath, resourceId, revisionId);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `Revision ${revisionId} not found.`
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof Error &&
      error.message ===
        "Cannot delete the canonical revision; promote another revision first."
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error, "Failed to delete revision.");
  }
}

async function handlePatch(
  req: NextRequest,
  { params }: { params: Promise<{ "resource-id": string }> },
): Promise<Response> {
  const resourceId = (await params)["resource-id"];

  const parsed = await parseJsonBody<SetCanonicalRevisionBody>(req);
  if (parsed instanceof NextResponse) return parsed;
  const { projectId, revisionId, content } = parsed.body;

  const resolved = resolveProjectPath(projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  const revisionIdError = requireString(revisionId, "revisionId");
  if (revisionIdError) return revisionIdError;

  try {
    if (typeof content === "string") {
      const updated = await updateRevisionInPlace(
        projectPath,
        resourceId,
        revisionId,
        content,
      );
      return NextResponse.json(updated, { status: 200 });
    }

    const canonicalRevision = await setCanonicalRevision(
      projectPath,
      resourceId,
      revisionId,
    );
    return NextResponse.json(canonicalRevision, { status: 200 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `Revision ${revisionId} not found.`
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof Error &&
      error.message === "Only the canonical revision can be updated in place."
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error, "Failed to set canonical revision.", 500);
  }
}

export const GET = withStorageContext(handleGet);
export const POST = withStorageContext(handlePost);
export const DELETE = withStorageContext(handleDelete);
export const PATCH = withStorageContext(handlePatch);
