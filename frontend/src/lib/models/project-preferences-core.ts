// Last Updated: 2026-07-26

/**
 * @module project-preferences-core
 *
 * **ADR-021 Phase 2 (Task 4) — transport-agnostic project preferences /
 * revision-settings core.** The business logic behind two routes:
 * `app/api/project/preferences/route.ts` (POST) and
 * `app/api/project/revision-settings/route.ts` (POST), lifted so it can be
 * reused by both the HTTP routes (web/desktop) and the native in-process
 * transport (`store/transport/native-preferences-backend.ts`) with
 * byte-for-byte identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. Every function operates on plain arguments and
 * throws plain `Error`s (or the shared `InvalidProjectIdCoreError`). The
 * routes catch those errors and map them to their existing HTTP status
 * codes; the native backend lets them propagate directly to the caller.
 *
 * Both operations resolve a project's on-disk root via
 * {@link resolveProjectRoot} (directory-basename convention — ADR-017/018)
 * and throw the shared `InvalidProjectIdCoreError` (imported from
 * `project-crud-core.ts` rather than re-declared here) when the supplied
 * `projectId` is not a well-formed UUID. `resolvePreferencesProjectRootOrThrow`
 * is exported (not just used internally) so `app/api/project/revision-settings/
 * route.ts` can preserve its pre-lift validation order — projectId validity
 * checked before the `defaultRevisionName` type check — without duplicating
 * the resolution logic.
 *
 * `saveRevisionSettingsCore` reuses `updateDefaultRevisionName` from
 * `revision-settings.ts` verbatim; `saveProjectPreferencesCore`'s
 * read-merge-write body is lifted directly from the pre-lift
 * `app/api/project/preferences/route.ts` handler, reusing
 * `mergeUserPreferencesIntoProjectMetadata` from `../user-preferences.ts`.
 */
import path from "node:path";
import { readFile, writeFile } from "./io";
import { resolveProjectRoot } from "./project-root-resolver";
import { InvalidProjectIdCoreError } from "./project-crud-core";
import {
  mergeUserPreferencesIntoProjectMetadata,
  type ProjectUserPreferences,
} from "../user-preferences";
import { updateDefaultRevisionName } from "./revision-settings";
import type { MetadataValue } from "./types";

/**
 * Shares {@link InvalidProjectIdCoreError} with `project-crud-core.ts`
 * rather than declaring a preferences-specific equivalent, so every lifted
 * core's routes can use a single `instanceof` check ->
 * `respondInvalidProjectId()` mapping.
 */
// Re-exported so every route/native backend in this module's scope can
// `import { InvalidProjectIdCoreError } from "./project-preferences-core"`
// without also reaching into `project-crud-core.ts` directly.
export { InvalidProjectIdCoreError };

/**
 * Resolves `projectId` to its on-disk project root, throwing (rather than
 * returning a `Response`, which the HTTP routes do via `resolveProjectPath`)
 * when it is not a well-formed UUID.
 */
export function resolvePreferencesProjectRootOrThrow(
  projectId: string,
): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new InvalidProjectIdCoreError(projectId);
  }
  return projectRoot;
}

/** Result shape of {@link saveProjectPreferencesCore}. */
export interface SaveProjectPreferencesResult {
  metadata: Record<string, MetadataValue>;
}

/**
 * Merges partial user preferences into `project.json`'s `metadata` and
 * persists the result.
 *
 * Lifted verbatim from `POST /api/project/preferences`'s `handlePost` body.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function saveProjectPreferencesCore(
  projectId: string,
  preferences: Partial<ProjectUserPreferences>,
): Promise<SaveProjectPreferencesResult> {
  const projectRoot = resolvePreferencesProjectRootOrThrow(projectId);
  const projectFilePath = path.join(projectRoot, "project.json");
  const parsedProject = JSON.parse(
    await readFile(projectFilePath, "utf-8"),
  ) as { metadata?: Record<string, MetadataValue>; updatedAt?: string };

  const updatedMetadata = mergeUserPreferencesIntoProjectMetadata(
    parsedProject.metadata,
    preferences,
  );

  await writeFile(
    projectFilePath,
    JSON.stringify(
      {
        ...parsedProject,
        metadata: updatedMetadata,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf-8",
  );

  return { metadata: updatedMetadata };
}

/**
 * Writes the `defaultRevisionName` field into the project's `config` block.
 *
 * Lifted verbatim from `POST /api/project/revision-settings`'s `handlePost`
 * body (the actual persistence work stays in `revision-settings.ts`'s
 * `updateDefaultRevisionName`, reused here unchanged).
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 * @throws {Error} When `defaultRevisionName` is empty or exceeds 100 characters
 *   (thrown by `updateDefaultRevisionName`).
 */
export async function saveRevisionSettingsCore(
  projectId: string,
  defaultRevisionName: string,
): Promise<string> {
  const projectRoot = resolvePreferencesProjectRootOrThrow(projectId);
  return updateDefaultRevisionName(projectRoot, defaultRevisionName);
}
