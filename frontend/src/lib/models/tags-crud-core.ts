// Last Updated: 2026-07-26

/**
 * @module tags-crud-core
 *
 * **ADR-021 Phase 2 (Task 4) — transport-agnostic tags CRUD core.** The
 * business logic behind three routes: `app/api/project/tags/route.ts`
 * (POST — list/create/assignments), `app/api/project/tags/delete/route.ts`
 * (POST), and `app/api/project/tags/assign/route.ts` (POST), lifted so it
 * can be reused by both the HTTP routes (web/desktop) and the native
 * in-process transport (`store/transport/native-tags-backend.ts`) with
 * byte-for-byte identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. Every function operates on plain arguments and
 * throws plain `Error`s (or the shared `InvalidProjectIdCoreError`). The
 * routes catch those errors and map them to their existing HTTP status
 * codes; the native backend lets them propagate directly to the caller.
 *
 * Every operation resolves a project's on-disk root via
 * {@link resolveProjectRoot} (directory-basename convention — ADR-017/018)
 * and throws the shared `InvalidProjectIdCoreError` (imported from
 * `project-crud-core.ts` rather than re-declared here) when the supplied
 * `projectId` is not a well-formed UUID — the same convention
 * `resource-crud-core.ts` established.
 *
 * `listTags`/`createTag`/`deleteTag`/`assignTagToResource`/
 * `unassignTagFromResource` are reused verbatim from `tags.ts`; only
 * `listTagAssignmentsCore`'s inline `project.json` read (the `"assignments"`
 * action's body in the pre-lift `tags/route.ts`) has no existing core
 * function of its own and is lifted here directly.
 */
import path from "node:path";
import { readFile } from "./io";
import { resolveProjectRoot } from "./project-root-resolver";
import { InvalidProjectIdCoreError } from "./project-crud-core";
import {
  assignTagToResource,
  createTag,
  deleteTag,
  listTags,
  unassignTagFromResource,
} from "./tags";
import { PROJECT_FILENAME } from "./project-config";
import type { Project, Tag } from "./types";

/**
 * Shares {@link InvalidProjectIdCoreError} with `project-crud-core.ts`
 * rather than declaring a tags-specific equivalent, so every lifted core's
 * routes can use a single `instanceof` check -> `respondInvalidProjectId()`
 * mapping.
 */
// Re-exported so every route/native backend in this module's scope can
// `import { InvalidProjectIdCoreError } from "./tags-crud-core"` without
// also reaching into `project-crud-core.ts` directly.
export { InvalidProjectIdCoreError };

/**
 * Resolves `projectId` to its on-disk project root, throwing (rather than
 * returning a `Response`, which the HTTP routes do via `resolveProjectPath`)
 * when it is not a well-formed UUID.
 */
export function resolveTagsProjectRootOrThrow(projectId: string): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new InvalidProjectIdCoreError(projectId);
  }
  return projectRoot;
}

/**
 * Lists every project-level tag.
 *
 * Lifted verbatim from `POST /api/project/tags`'s `"list"` action body.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function listTagsCore(projectId: string): Promise<Tag[]> {
  const projectRoot = resolveTagsProjectRootOrThrow(projectId);
  return listTags(projectRoot);
}

/**
 * Returns the tag ids assigned to a given resource, read directly from
 * `project.json`'s `config.tagAssignments`.
 *
 * Lifted verbatim from `POST /api/project/tags`'s `"assignments"` action
 * body — the one piece of that route with no pre-existing `tags.ts` core
 * function of its own.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function listTagAssignmentsCore(
  projectId: string,
  resourceId: string,
): Promise<string[]> {
  const projectRoot = resolveTagsProjectRootOrThrow(projectId);
  const raw = await readFile(path.join(projectRoot, PROJECT_FILENAME), "utf8");
  const project = JSON.parse(raw) as Project;
  return project.config?.tagAssignments?.[resourceId] ?? [];
}

/**
 * Creates a new project-level tag.
 *
 * Lifted verbatim from `POST /api/project/tags`'s `"create"` action body.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function createTagCore(
  projectId: string,
  name: string,
  color?: string,
): Promise<Tag> {
  const projectRoot = resolveTagsProjectRootOrThrow(projectId);
  return createTag(projectRoot, name, color);
}

/**
 * Deletes a project-level tag and all of its assignments.
 *
 * Lifted verbatim from `POST /api/project/tags/delete`'s `handlePost` body.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function deleteTagCore(
  projectId: string,
  tagId: string,
): Promise<boolean> {
  const projectRoot = resolveTagsProjectRootOrThrow(projectId);
  return deleteTag(projectRoot, tagId);
}

/**
 * Assigns or unassigns a tag to/from a resource.
 *
 * Lifted verbatim from `POST /api/project/tags/assign`'s `handlePost` body.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function assignTagCore(
  projectId: string,
  resourceId: string,
  tagId: string,
  assign: boolean,
): Promise<void> {
  const projectRoot = resolveTagsProjectRootOrThrow(projectId);
  if (assign) {
    await assignTagToResource(projectRoot, resourceId, tagId);
  } else {
    await unassignTagFromResource(projectRoot, resourceId, tagId);
  }
}
