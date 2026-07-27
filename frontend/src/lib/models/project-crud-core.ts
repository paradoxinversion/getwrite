// Last Updated: 2026-07-26

/**
 * @module project-crud-core
 *
 * **ADR-021 Phase 2 (Task 2) — transport-agnostic project CRUD core.** The
 * business logic behind five routes: `app/api/projects/route.ts` (GET/POST),
 * `app/api/project/route.ts` (POST — open/load), `app/api/project/rename/
 * route.ts`, `app/api/project/delete/route.ts`, and `app/api/project/
 * [project-id]/reindex/route.ts`, lifted so it can be reused by both the HTTP
 * routes (web/desktop) and the native in-process transports
 * (`store/transport/native-project-backend.ts`,
 * `store/transport/native-project-actions-backend.ts`) with byte-for-byte
 * identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. Every function operates on plain arguments and
 * throws plain `Error`s. The routes catch those errors and map them to their
 * existing HTTP status codes; the native backends let them propagate
 * directly to the caller.
 *
 * `listProjectsCore`/`createProjectCore`/`loadProjectCore`/`renameProjectCore`/
 * `deleteProjectCore` resolve a project's on-disk root via
 * {@link resolveProjectRoot} (directory-basename convention — ADR-017/018).
 * `reindexProjectByInternalIdCore` is a deliberate divergence: it scans every
 * directory under `resolveProjectsDir()` and matches by `project.json`'s
 * *internal* `id` field, not the directory basename — preserved exactly from
 * the pre-lift route, not "fixed" to the basename convention.
 */
import path from "node:path";
import { readFile, readdir, writeFile, rm } from "./io";
import { getLocalResources } from "./resource";
import { readFolderTree } from "./folder-utils";
import { resolveProjectsDir } from "./projects-dir";
import { resolveProjectRoot } from "./project-root-resolver";
import { loadProjectFromDisk, type LoadedProject } from "./project-loader";
import { validateProject } from "./project";
import { createProjectFromType } from "./project-creator";
import { generateUUID } from "./uuid";
import { getProjectType } from "../projectTypes";
import { getStaticProjectType } from "./project-types-static";
import { reindexMissingResources } from "./inverted-index";
import type { AnyResource, Folder, Project } from "./types";

/** One entry of `listProjectsCore`'s result — mirrors `GET /api/projects`'s payload shape. */
export interface ProjectListEntry {
  project: unknown;
  resources: AnyResource[];
  folders: unknown[];
}

/** Result shape of `createProjectCore` — mirrors `POST /api/projects`'s payload shape. */
export interface CreateProjectResult {
  project: Project;
  folders: Folder[];
  resources: unknown[];
}

/**
 * Lists every project under `resolveProjectsDir()`, each with its parsed
 * `project.json`, folder tree, and resources.
 *
 * Lifted verbatim from `GET /api/projects`'s `getProjects` handler body.
 */
export async function listProjectsCore(): Promise<ProjectListEntry[]> {
  const projectsDir = resolveProjectsDir();
  const projectIds = (await readdir(projectsDir)).filter(
    (file) => file !== ".DS_Store",
  );
  const entries = await Promise.all(
    projectIds.map(async (id): Promise<ProjectListEntry | null> => {
      try {
        const projectPath = path.join(projectsDir, id, "project.json");
        const projectData = await readFile(projectPath, "utf-8");
        // Validate the on-disk manifest before admitting it to the list. A
        // single unreadable/corrupt/incomplete project.json (a partial write, a
        // crash mid-save, or a stray fixture directory) must not take down the
        // whole list via `Promise.all` rejection — skip the offender and return
        // every healthy project instead. `validateProject` throws on a manifest
        // the UI would reject downstream anyway (e.g. missing `createdAt`).
        const project = validateProject(JSON.parse(projectData));

        const foldersPath = path.join(projectsDir, id, "folders");
        const folders = await readFolderTree(foldersPath);

        const resources = await getLocalResources(path.join(projectsDir, id));
        return { project, resources, folders };
      } catch (error) {
        console.warn(
          `Skipping unreadable project "${id}" while listing projects:`,
          error,
        );
        return null;
      }
    }),
  );
  return entries.filter((entry): entry is ProjectListEntry => entry !== null);
}

/** Thrown by {@link createProjectCore} when `name` or `projectType` is missing. */
export class MissingProjectFieldsError extends Error {
  constructor() {
    super("Missing name or projectType");
    this.name = "MissingProjectFieldsError";
  }
}

/** Thrown by {@link createProjectCore} when `projectType` has no matching template. */
export class ProjectTypeNotFoundError extends Error {
  constructor() {
    super("Project type not found");
    this.name = "ProjectTypeNotFoundError";
  }
}

/**
 * Creates a new project from a project-type template.
 *
 * Lifted verbatim from `POST /api/projects`'s `createProject` handler body
 * (the try/catch -> 400/404/500 status mapping stays in the route; this core
 * throws {@link MissingProjectFieldsError}/{@link ProjectTypeNotFoundError}
 * instead of returning those `NextResponse`s directly).
 */
export async function createProjectCore(
  name: string | undefined,
  projectType: string | undefined,
): Promise<CreateProjectResult> {
  if (!name || !projectType) {
    throw new MissingProjectFieldsError();
  }

  const entry = await getProjectType(projectType);
  if (!entry) {
    throw new ProjectTypeNotFoundError();
  }

  const id = generateUUID();
  const projectRoot = path.join(resolveProjectsDir(), id);

  const result = await createProjectFromType({
    projectRoot,
    spec: entry.filePath,
    name,
  });

  return {
    project: result.project,
    folders: result.folders,
    resources: result.resources,
  };
}

/**
 * Creates a new project from a project-type template, resolved from the
 * **native-safe static registry** (`./project-types-static.ts`) instead of
 * `getProjectType`'s `node:fs` directory scan.
 *
 * **ADR-021 Phase 2 (Task 5) — FR15.** `createProjectCore`'s `getProjectType`
 * call reads `getwrite-config/templates/project-types` off the real
 * filesystem at a repo-relative path that does not exist on a native
 * device; `native-project-backend.ts`'s `create` operation must never take
 * that path. This is the byte-for-byte behavioral twin of
 * `createProjectCore`, differing only in how it resolves `projectType` to a
 * spec — every other step (id generation, `projectRoot` join,
 * `createProjectFromType` call, result shape) is identical, and it throws
 * the same {@link MissingProjectFieldsError} / {@link ProjectTypeNotFoundError}
 * for the same invalid inputs.
 *
 * `createProjectCore` itself is untouched — the HTTP route
 * (`app/api/projects/route.ts`) keeps using it, and keeps using
 * `getProjectType`'s fs-based resolution, unaffected by this addition.
 */
export async function createProjectCoreNative(
  name: string | undefined,
  projectType: string | undefined,
): Promise<CreateProjectResult> {
  if (!name || !projectType) {
    throw new MissingProjectFieldsError();
  }

  const spec = getStaticProjectType(projectType);
  if (!spec) {
    throw new ProjectTypeNotFoundError();
  }

  const id = generateUUID();
  const projectRoot = path.join(resolveProjectsDir(), id);

  const result = await createProjectFromType({ projectRoot, spec, name });

  return {
    project: result.project,
    folders: result.folders,
    resources: result.resources,
  };
}

/** Thrown by the projectId-keyed core operations when `projectId` is not a well-formed UUID. */
export class InvalidProjectIdCoreError extends Error {
  constructor(projectId: string | null | undefined) {
    super(`Invalid projectId: ${JSON.stringify(projectId ?? null)}`);
    this.name = "InvalidProjectIdCoreError";
  }
}

/**
 * Resolves `projectId` to its on-disk project root, throwing (rather than
 * returning a `Response`, which the HTTP routes do via `resolveProjectPath`)
 * when it is not a well-formed UUID.
 */
function resolveProjectRootOrThrow(projectId: string): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new InvalidProjectIdCoreError(projectId);
  }
  return projectRoot;
}

/**
 * Loads a project and related entities from disk.
 *
 * Lifted verbatim from `POST /api/project`'s `handlePost` body.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function loadProjectCore(
  projectId: string,
): Promise<LoadedProject> {
  const projectRoot = resolveProjectRootOrThrow(projectId);
  return loadProjectFromDisk(projectRoot);
}

/**
 * Renames a project by rewriting its `project.json`'s `name` field.
 *
 * Lifted verbatim from `POST /api/project/rename`'s `handlePost` body.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function renameProjectCore(
  projectId: string,
  newName: string,
): Promise<unknown> {
  const projectRoot = resolveProjectRootOrThrow(projectId);
  const projectFilePath = path.join(projectRoot, "project.json");
  const projectFileContent = await readFile(projectFilePath, "utf-8");
  const projectData = JSON.parse(projectFileContent);
  projectData.name = newName;
  await writeFile(
    projectFilePath,
    JSON.stringify(projectData, null, 2),
    "utf-8",
  );
  return projectData;
}

/**
 * Deletes a project's on-disk directory recursively.
 *
 * Lifted verbatim from `POST /api/project/delete`'s `handlePost` body.
 *
 * @throws {InvalidProjectIdCoreError} When `projectId` is not a well-formed UUID.
 */
export async function deleteProjectCore(projectId: string): Promise<void> {
  const projectRoot = resolveProjectRootOrThrow(projectId);
  await rm(projectRoot, { recursive: true, force: true });
}

/**
 * Scans every directory under `resolveProjectsDir()` and returns the first
 * whose `project.json`'s internal `id` field matches `projectId`, or `null`
 * when none match.
 *
 * This is a deliberate divergence from the directory-basename convention the
 * other four operations use — preserved exactly from
 * `app/api/project/[project-id]/reindex/route.ts`'s pre-lift `findProjectRoot`
 * helper, not "fixed" to the basename convention.
 */
export async function findProjectRootByInternalId(
  projectsDir: string,
  projectId: string,
): Promise<string | null> {
  let entries;
  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(projectsDir, entry.name);
    try {
      const raw = await readFile(path.join(candidate, "project.json"), "utf8");
      const parsed = JSON.parse(raw) as { id?: string };
      if (parsed?.id === projectId) return candidate;
    } catch {
      // skip unreadable or non-project directories
    }
  }

  return null;
}

/** Thrown by {@link reindexProjectByInternalIdCore} when no project matches `projectId`. */
export class ProjectNotFoundByInternalIdError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} not found.`);
    this.name = "ProjectNotFoundByInternalIdError";
  }
}

/**
 * Reindexes a project's missing resources, resolved by `project.json`'s
 * internal `id` field (not the on-disk directory basename).
 *
 * Lifted verbatim from `POST /api/project/[project-id]/reindex`'s `reindex`
 * handler body.
 *
 * @throws {ProjectNotFoundByInternalIdError} When no project's internal `id`
 *   matches `projectId`.
 */
export async function reindexProjectByInternalIdCore(
  projectId: string,
): Promise<{ queued: number }> {
  const projectsDir = resolveProjectsDir();
  const projectRoot = await findProjectRootByInternalId(projectsDir, projectId);

  if (!projectRoot) {
    throw new ProjectNotFoundByInternalIdError(projectId);
  }

  const queued = await reindexMissingResources(projectRoot);
  return { queued };
}
