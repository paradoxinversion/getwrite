// Last Updated: 2026-07-26

/**
 * @module editor-config-core
 *
 * **ADR-021 Phase 2 (Task 4) — transport-agnostic editor config core.** The
 * business logic behind `app/api/project/editor-config/route.ts` (POST),
 * lifted so it can be reused by both the HTTP route (web/desktop) and the
 * native in-process transport
 * (`store/transport/native-editor-config-backend.ts`) with byte-for-byte
 * identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. {@link updateEditorConfigCore} operates on plain
 * arguments and throws plain `Error`s (or the shared
 * `InvalidProjectIdCoreError`). The route catches those errors and maps
 * them to its existing HTTP status codes; the native backend lets them
 * propagate directly to the caller.
 *
 * The route handles both `saveHeadingSettings` and `saveBodySettings` call
 * shapes (`lib/api/editor-config.ts`) with a single handler, since both hit
 * the same `POST /api/project/editor-config` route with either `headings`
 * or `body` populated. {@link updateEditorConfigCore} mirrors that: it takes
 * an object with optional `headings`/`body` fields (matching the route's
 * pre-lift body shape) rather than two separate functions, so both
 * `lib/api/editor-config.ts` client functions — and both
 * `native-editor-config-backend.ts` transport methods — can call the same
 * core operation with different fields populated.
 */
import path from "node:path";
import { readFile, writeFile } from "./io";
import { resolveProjectRoot } from "./project-root-resolver";
import { InvalidProjectIdCoreError } from "./project-crud-core";
import type { Project, ProjectConfig } from "./types";
import {
  sanitizeEditorHeadingMap,
  type EditorHeadingMap,
} from "../editor-heading-settings";
import {
  sanitizeEditorBody,
  type EditorBodyConfig,
} from "../editor-body-settings";

/**
 * Shares {@link InvalidProjectIdCoreError} with `project-crud-core.ts`
 * rather than declaring an editor-config-specific equivalent, so every
 * lifted core's routes can use a single `instanceof` check ->
 * `respondInvalidProjectId()` mapping.
 */
// Re-exported so every route/native backend in this module's scope can
// `import { InvalidProjectIdCoreError } from "./editor-config-core"` without
// also reaching into `project-crud-core.ts` directly.
export { InvalidProjectIdCoreError };

/**
 * Resolves `projectId` to its on-disk project root, throwing (rather than
 * returning a `Response`, which the HTTP route does via `resolveProjectPath`)
 * when it is not a well-formed UUID.
 */
export function resolveEditorConfigProjectRootOrThrow(
  projectId: string,
): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new InvalidProjectIdCoreError(projectId);
  }
  return projectRoot;
}

/** Plain-argument input mirroring `POST /api/project/editor-config`'s body shape. */
export interface UpdateEditorConfigInput {
  projectId: string;
  headings?: EditorHeadingMap;
  body?: EditorBodyConfig;
}

/** Result shape of {@link updateEditorConfigCore}. */
export interface UpdateEditorConfigResult {
  editorConfig: ProjectConfig["editorConfig"];
}

/**
 * Merges `headings`/`body` typography settings into `project.json`'s
 * `config.editorConfig` and persists the result.
 *
 * Lifted verbatim from `POST /api/project/editor-config`'s `handlePost`
 * body — `headings` is always sanitized (defaulting to an empty map when
 * omitted, via `sanitizeEditorHeadingMap`); `body` is only replaced when
 * explicitly provided (`body !== undefined`), otherwise the existing
 * `config.editorConfig.body` is preserved.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function updateEditorConfigCore(
  input: UpdateEditorConfigInput,
): Promise<UpdateEditorConfigResult> {
  const projectRoot = resolveEditorConfigProjectRootOrThrow(input.projectId);
  const projectFilePath = path.join(projectRoot, "project.json");
  const parsedProject = JSON.parse(
    await readFile(projectFilePath, "utf-8"),
  ) as Project;

  const nextEditorConfig: ProjectConfig["editorConfig"] = {
    ...(parsedProject.config?.editorConfig ?? {}),
    headings: sanitizeEditorHeadingMap(input.headings),
    body:
      input.body !== undefined
        ? sanitizeEditorBody(input.body)
        : parsedProject.config?.editorConfig?.body,
  };

  const nextProject: Project = {
    ...parsedProject,
    config: { ...(parsedProject.config ?? {}), editorConfig: nextEditorConfig },
    updatedAt: new Date().toISOString(),
  };

  await writeFile(
    projectFilePath,
    JSON.stringify(nextProject, null, 2),
    "utf-8",
  );

  return { editorConfig: nextEditorConfig };
}
