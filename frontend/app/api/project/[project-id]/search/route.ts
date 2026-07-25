/**
 * @module app/api/project/[project-id]/search/route
 *
 * Full-text search over the indexed resources of a single project.
 *
 * Route:
 * - `GET /api/project/[project-id]/search`
 *
 * GET query params:
 * - `q`      (required) — search query string
 * - `folder` (optional) — filter by folder ID; only resources in this folder are returned
 * - `status` (optional) — filter by status string; resource must have this status in its `statuses` array
 * - `tags`   (optional) — comma-separated tag IDs; resource must have at least one matching tag
 *
 * Success payload: `SearchResult[]` ordered by proximity score (multi-term) or term frequency (single-term)
 * Failure payload: `{ error: string }`
 */
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "../../../../../src/lib/models/io";
import { resolveProjectsDir } from "../../../../../src/lib/models/projects-dir";
import { withStorageContext } from "../../../_tenant/with-storage-context";
import { getUserPreferencesFromProjectMetadata } from "../../../../../src/lib/user-preferences";
import type { Project } from "../../../../../src/lib/models/types";
import {
  executeSearch,
  findProjectRoot,
  type SearchResult,
} from "../../../../../src/lib/search/execute-search";

// The search core now lives in a transport-agnostic module so it can be driven
// both by this HTTP route and, per ADR-021, by an in-process transport backend
// on a native (server-less) build. Re-exported here for existing importers.
export { executeSearch } from "../../../../../src/lib/search/execute-search";
export type { SearchResult } from "../../../../../src/lib/search/execute-search";

const DEFAULT_RESULT_LIMIT = 50;

interface ErrorResponse {
  error: string;
}

// --- Route handler ---

async function handleSearch(
  req: NextRequest,
  { params }: { params: Promise<{ "project-id": string }> },
): Promise<NextResponse<SearchResult[] | ErrorResponse>> {
  const projectId = (await params)["project-id"];
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q");
  if (!q || q.trim() === "") {
    return NextResponse.json(
      { error: "Missing required query param: q." },
      { status: 400 },
    );
  }

  const folder = searchParams.get("folder") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam
    ? tagsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const projectsDir = resolveProjectsDir();
  const projectRoot = await findProjectRoot(projectsDir, projectId);

  if (!projectRoot) {
    return NextResponse.json(
      { error: `Project ${projectId} not found.` },
      { status: 404 },
    );
  }

  let limit = DEFAULT_RESULT_LIMIT;
  try {
    const raw = await readFile(path.join(projectRoot, "project.json"), "utf8");
    const project = JSON.parse(raw) as Project;
    const prefs = getUserPreferencesFromProjectMetadata(project.metadata);
    if (prefs.searchResultLimit !== undefined) {
      limit = prefs.searchResultLimit;
    }
  } catch {
    // use default limit
  }

  try {
    const results = await executeSearch(
      projectRoot,
      q.trim(),
      { folder, status, tags },
      limit,
    );
    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withStorageContext(handleSearch);

export const dynamic = "force-dynamic";
