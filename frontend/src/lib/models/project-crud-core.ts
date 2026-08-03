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
import { readProjectMarker } from "./crypto/project-marker";
import { getSessionKeyring } from "./crypto/keyring-session";
import { runInProjectContext } from "./crypto/adapter-selection";
import {
  readNameIndex,
  removeProjectName,
  setProjectName,
} from "./crypto/name-index";
import { getLocalResources } from "./resource";
import { readFolderTree } from "./folder-utils";
import { resolveProjectsDir } from "./projects-dir";
import { resolveProjectRoot } from "./project-root-resolver";
import { loadProjectFromDisk, type LoadedProject } from "./project-loader";
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
  /**
   * Present and `true` when the project is encrypted and the workspace is
   * locked, so nothing inside it could be read.
   *
   * Such an entry carries only the project's id and the time it was encrypted —
   * no name, no resources, no folders. The Start screen renders it as a locked
   * card rather than dropping it, so a writer can see the project exists and
   * knows to unlock (FR20).
   */
  isLocked?: boolean;
  /**
   * Present and `true` for an encrypted project, locked or not.
   *
   * Encrypted projects are listed *lazily*: name and date only, without
   * enumerating resources or folders. Reading those means decrypting the whole
   * project just to draw a card, which on Android would cross the Capacitor
   * bridge once per file. Consumers must therefore not read counts from such an
   * entry — they are empty because nothing was read, not because nothing exists.
   */
  isEncrypted?: boolean;
}

/** Result shape of `createProjectCore` — mirrors `POST /api/projects`'s payload shape. */
export interface CreateProjectResult {
  project: Project;
  folders: Folder[];
  resources: unknown[];
}

/**
 * Structural guard for a `project.json` manifest the Start screen can list.
 *
 * The list consumer chain (`buildProjectView` reads `project.id`; `StartPage`
 * reads `project.createdAt`) needs exactly a string `id` and `createdAt` —
 * every other `ProjectSchema` field is optional and unused by the listing. So
 * this is the precise "is this a real project we can show?" predicate: narrow
 * enough that a legitimate, loadable project with an unrelated legacy/nested
 * field is never dropped, strict enough to skip the incomplete manifests that
 * used to make the whole list fail.
 */
function isListableProjectManifest(
  manifest: unknown,
): manifest is { id: string; createdAt: string } {
  if (typeof manifest !== "object" || manifest === null) return false;
  const record = manifest as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.createdAt === "string";
}

/**
 * Lists every project under `resolveProjectsDir()`, each with its parsed
 * `project.json`, folder tree, and resources.
 *
 * Lifted from `GET /api/projects`'s `getProjects` handler body, hardened so a
 * single unreadable/incomplete `project.json` is skipped (with a warning)
 * rather than failing the entire list.
 */
export async function listProjectsCore(): Promise<ProjectListEntry[]> {
  const projectsDir = resolveProjectsDir();
  // Project ids are UUIDs, so nothing listable is ever dot-prefixed. Skipping
  // dotfiles wholesale covers `.DS_Store` as before and also the workspace-level
  // `.getwrite-keyring.json`, which would otherwise be probed as a project and
  // warn on every listing.
  const projectIds = (await readdir(projectsDir)).filter(
    (file) => !file.startsWith("."),
  );
  // One decryption for the whole list (FR21), rather than one per project.
  const nameIndex = await readEncryptedProjectNames(projectsDir);

  const entries = await Promise.all(
    projectIds.map(async (id): Promise<ProjectListEntry | null> => {
      const projectRoot = path.join(projectsDir, id);

      // The encryption marker is plaintext by design, so this is answerable
      // before anything inside the project can be read.
      const marker = await readProjectMarker(projectRoot);
      if (marker) {
        return listEncryptedProject(
          id,
          projectRoot,
          marker.encryptedAt,
          nameIndex,
        );
      }

      const projectPath = path.join(projectsDir, id, "project.json");
      let manifest: unknown;
      try {
        manifest = JSON.parse(await readFile(projectPath, "utf-8"));
      } catch (error) {
        // Unreadable or non-JSON manifest — a stray directory, or a partial /
        // corrupt write. Skip this one project rather than failing the whole
        // list via `Promise.all` rejection (the bug where a single bad
        // project.json made every project vanish from the Start screen).
        console.warn(
          `Skipping unreadable project "${id}" while listing projects:`,
          error,
        );
        return null;
      }
      if (!isListableProjectManifest(manifest)) {
        // Parses fine but is missing a field the Start screen needs to list it
        // (see `isListableProjectManifest`). Skip it instead of letting it
        // poison the list — but do NOT run the full `ProjectSchema.parse`
        // here: that would drop a legitimate, loadable project over an
        // unrelated nested field the list never reads, and would reshape the
        // payload the HTTP route returns verbatim.
        console.warn(
          `Skipping project "${id}" with an incomplete manifest while listing projects.`,
        );
        return null;
      }

      // Deliberately outside the guard above: a transient read failure on a
      // healthy project's folders/resources still propagates (surfacing as an
      // error) instead of silently dropping the project from the list.
      const foldersPath = path.join(projectsDir, id, "folders");
      const folders = await readFolderTree(foldersPath);
      const resources = await getLocalResources(path.join(projectsDir, id));
      // Return the raw parsed manifest verbatim (not a schema-parsed copy) so
      // the payload stays byte-identical to the pre-guard behaviour.
      return { project: manifest, resources, folders };
    }),
  );
  return entries.filter((entry): entry is ProjectListEntry => entry !== null);
}

/**
 * Reads the sealed project-name index, when the workspace is open.
 *
 * @param workspaceRoot - The workspace root.
 * @returns Project id → name for encrypted projects; empty while locked.
 */
async function readEncryptedProjectNames(
  workspaceRoot: string,
): Promise<Record<string, string>> {
  const keyring = getSessionKeyring();
  if (!keyring || keyring.isLocked()) return {};
  try {
    return await readNameIndex(keyring.workspaceKey(), workspaceRoot);
  } catch (error) {
    // A damaged index must not take the whole list down; names fall back to
    // the per-project manifest below.
    console.warn("Could not read the project-name index:", error);
    return {};
  }
}

/**
 * Builds a list entry for an encrypted project, without opening it.
 *
 * Encrypted projects are listed lazily: the card needs a name and a date, and
 * getting those by decrypting the manifest, the folder tree, and every resource
 * would mean opening an entire project to draw one card. The name comes from the
 * sealed workspace index instead — one decryption for the whole list (FR21).
 *
 * Locked, not even that is readable, so the entry carries only an id and the
 * time the project was encrypted — enough to show that it exists, without
 * leaking a title (FR18, FR20).
 *
 * `createdAt` is the marker's `encryptedAt` in both cases, since the real
 * manifest is deliberately not read.
 *
 * @param id - The project's directory id.
 * @param encryptedAt - Timestamp from the plaintext marker.
 * @param nameIndex - Names recovered from the sealed index, if unlocked.
 * @returns The list entry.
 */
async function listEncryptedProject(
  id: string,
  projectRoot: string,
  encryptedAt: string,
  nameIndex: Record<string, string>,
): Promise<ProjectListEntry> {
  const keyring = getSessionKeyring();
  const isUnlocked =
    keyring !== null && !keyring.isLocked() && keyring.hasProject(id);

  if (!isUnlocked) {
    return {
      isEncrypted: true,
      isLocked: true,
      project: { id, createdAt: encryptedAt },
      resources: [],
      folders: [],
    };
  }

  return {
    isEncrypted: true,
    isLocked: false,
    project: {
      id,
      name: nameIndex[id] ?? (await readNameFromManifest(projectRoot, keyring)),
      createdAt: encryptedAt,
    },
    resources: [],
    folders: [],
  };
}

/**
 * Recovers a project's name from its own manifest.
 *
 * The fallback for a project missing from the sealed index — one small
 * decryption, still without enumerating resources or folders. Returns
 * `undefined` rather than throwing, so one unreadable manifest cannot blank the
 * whole list.
 *
 * @param projectRoot - The project directory.
 * @param keyring - The unlocked keyring.
 * @returns The project's name, or `undefined` when it cannot be read.
 */
async function readNameFromManifest(
  projectRoot: string,
  keyring: NonNullable<ReturnType<typeof getSessionKeyring>>,
): Promise<string | undefined> {
  try {
    return await runInProjectContext(projectRoot, keyring, async () => {
      const manifest: unknown = JSON.parse(
        await readFile(path.join(projectRoot, "project.json"), "utf-8"),
      );
      const name = (manifest as { name?: unknown }).name;
      return typeof name === "string" ? name : undefined;
    });
  } catch {
    return undefined;
  }
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
  await syncEncryptedProjectName(projectId, projectRoot, newName);
  return projectData;
}

/**
 * Keeps the sealed name index in step with a project's real name.
 *
 * The index is a second source of truth, and its characteristic failure is
 * silent: a rename that updates `project.json` but not the index leaves a stale
 * name on the Start screen with no error anywhere. Renames therefore route
 * through here, and a failure to update is logged rather than swallowed.
 *
 * A no-op for unencrypted projects and for a locked workspace — a locked
 * workspace cannot rename an encrypted project in the first place.
 *
 * @param projectId - The project's directory id.
 * @param projectRoot - The project directory.
 * @param newName - The name just written to the manifest.
 */
async function syncEncryptedProjectName(
  projectId: string,
  projectRoot: string,
  newName: string,
): Promise<void> {
  const keyring = getSessionKeyring();
  if (!keyring || keyring.isLocked() || !keyring.hasProject(projectId)) return;
  if (!(await readProjectMarker(projectRoot))) return;

  try {
    await setProjectName(
      projectId,
      newName,
      keyring.workspaceKey(),
      resolveProjectsDir(),
    );
  } catch (error) {
    console.warn(
      `Renamed project "${projectId}" but could not update the project-name index:`,
      error,
    );
  }
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

  // Drop the name too, or the index accumulates entries for projects that no
  // longer exist — each one a plaintext-recoverable title of deleted work.
  const keyring = getSessionKeyring();
  if (keyring && !keyring.isLocked()) {
    try {
      await removeProjectName(
        projectId,
        keyring.workspaceKey(),
        resolveProjectsDir(),
      );
    } catch (error) {
      console.warn(
        `Deleted project "${projectId}" but could not update the project-name index:`,
        error,
      );
    }
  }
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
