/**
 * @module app/api/project/[project-id]/entity-alias-table/route
 *
 * Read-only transport exposing the project's entity alias table
 * ({@link buildEntityAliasTable}) — every declared entity's matchable
 * terms (name + aliases) plus which normalized terms are claimed by more
 * than one entity (FR-14).
 *
 * Route:
 * - `GET /api/project/[project-id]/entity-alias-table`
 *
 * This route is purely a transport wrapper: it resolves and validates the
 * `project-id` path param (never a client-supplied path, per
 * `docs/standards/security.md`) via `validateProjectId`/
 * `respondInvalidProjectId`, then delegates entirely to
 * `buildEntityAliasTable`. No business logic lives here.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildEntityAliasTable } from "../../../../../src/lib/models/entity-alias-table";
import { resolveProjectPath } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

async function handleGet(
  _req: NextRequest,
  { params }: { params: Promise<{ "project-id": string }> },
): Promise<Response> {
  const projectId = (await params)["project-id"];

  const resolved = resolveProjectPath(projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  const table = await buildEntityAliasTable(projectPath);
  return NextResponse.json(table, { status: 200 });
}

export const GET = withStorageContext(handleGet);

export const dynamic = "force-dynamic";
