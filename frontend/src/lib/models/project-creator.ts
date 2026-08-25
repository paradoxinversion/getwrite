/**
 * @module frontend/lib/models/project-creator
 *
 * Module responsibilities:
 * - Load and validate project-type templates (JSON) provided as objects or
 *   file paths.
 * - Create a persisted project scaffold on disk under a provided
 *   `projectRoot`: writes `project.json`, creates a `folders/` tree with
 *   folder descriptor files, and scaffolds default resources under
 *   `resources/` with accompanying sidecar metadata in `meta/`.
 * - Return a runtime `Project` model alongside the created `Folder` and
 *   `TextResource` objects so callers can integrate the newly-created
 *   project into application state immediately.
 *
 * Error handling and guarantees:
 * - Template validation is performed via `validateProjectTypeFile` or
 *   `validateProjectType`. Validation failures throw an `Error` with
 *   details. Filesystem errors (mkdir/write) are propagated to the caller.
 * - Resource sidecars are written and awaited before this module resolves
 *   so callers can read metadata immediately after `createProjectFromType`
 *   completes.
 *
 * Usage example:
 * ```ts
 * import { createProjectFromType } from "./project-creator";
 *
 * await createProjectFromType({
 *   projectRoot: "/tmp/my-novel",
 *   spec: "getwrite-config/templates/project-types/novel_project_type.json",
 *   name: "My Novel",
 * });
 * ```
 *
 * Notes:
 * - This module implements minimal, filesystem-backed scaffolding intended
 *   for local/offline development flows. It intentionally keeps behavior
 *   synchronous from the caller's perspective (async API) and attempts to
 *   ensure on-disk invariants before returning.
 *
 * See: `frontend/src/lib/models/schemas.ts`, `resource.ts`, and `sidecar.ts`.
 */
import { mkdir, writeFile } from "./io";
import path from "node:path";
import { createProject } from "./project";
import { generateUUID } from "./uuid";
import { validateProjectTypeFile, validateProjectType } from "./schemas";
import type {
  Project,
  Folder,
  TextResource,
  ResourceType,
  MetadataSource,
  EditorHeadings,
  EditorHeading,
  EditorBodyConfig,
} from "./types";
import { createResourceOfType, writeResourceToFile } from "./resource";
import { writeRevision } from "./revision";
import { slugify } from "../utils";

/**
 * Minimal spec types for project-type JSON files.
 *
 * These interfaces model the minimal shape expected in the project-type
 * templates stored under `getwrite-config/templates/project-types`.
 */
export interface ProjectTypeSpecFolder {
  /** Human-friendly folder name (displayed in the UI). */
  name: string;
  /**
   * @deprecated Accepted and propagated for backward compatibility with
   * project types written before the Workspace requirement was removed, but
   * nothing reads it: no folder name or flag confers ordering, protection, or
   * UI semantics. To make a folder's contents referenceable as typed
   * metadata, use `metadataSource` instead.
   */
  special?: boolean;
  metadataSource?: MetadataSource;
}

/**
 * Minimal spec type for resources declared in a project-type template.
 *
 * - `folder` is the name of the folder (as declared in `folders`) where the
 *   resource should be created. It is matched by slug (see `slugify`).
 * - `name` is the human-friendly resource name.
 * - `type` is the resource type (currently supports `text`, `image`, `audio`).
 * - `template` contains initial text content for text resources.
 */
export interface ProjectTypeSpecResource {
  /**
   * Optional folder name (not slug) to place the resource under.
   * When omitted, callers should default placement to the first folder.
   */
  folder?: string;
  /** Display name for the resource. */
  name: string;
  /** Resource type; aligns with runtime `ResourceType`. */
  type: ResourceType;
  /** Optional template content used when creating text resources. */
  template?: string;
}

/**
 * Minimal spec type for a subfolder declared in a project-type template.
 *
 * - `folder` is the name of the parent folder (matched by slug).
 * - `name` is the human-friendly name for the subfolder.
 */
export interface ProjectTypeSpecDefaultFolder {
  folder: string;
  name: string;
  special?: boolean;
  metadataSource?: MetadataSource;
}

/**
 * Minimal project-type specification.
 *
 * These files describe a project scaffold (folders and optional default
 * resources) that can be used to create a new project via
 * `createProjectFromType`.
 */
export interface ProjectTypeSpec {
  /** Stable identifier for the project type (used when persisting). */
  id: string;
  /** Human-friendly name shown in the UI for the template. */
  name: string;
  /** Optional longer description explaining the template's intent. */
  description?: string;
  /** List of folders to create for the new project. */
  folders: ProjectTypeSpecFolder[];
  /** Optional list of default resources to scaffold inside the folders. */
  defaultResources?: ProjectTypeSpecResource[];
  /** Optional list of subfolders to scaffold under named parent folders. */
  defaultFolders?: ProjectTypeSpecDefaultFolder[];
  /** Optional default project configuration to apply when creating a project. */
  editorConfig?: {
    headings?: { [index in EditorHeadings]?: EditorHeading };
    body?: EditorBodyConfig;
  };
  /** Default project-scoped status values to seed on creation. */
  statuses?: string[];
  /** Target word count for the project. */
  wordCountGoal?: number;
}

/** Load and validate a project-type spec from a file path or an inline object. */
async function loadSpec(
  spec: ProjectTypeSpec | string,
): Promise<ProjectTypeSpec> {
  if (typeof spec === "string") {
    const res = await validateProjectTypeFile(spec);
    if (!res.success || !("value" in res))
      throw new Error(
        `Invalid project-type spec file: ${JSON.stringify(res.errors)}`,
      );
    if (!res.value)
      throw new Error("Invalid project-type spec file: missing value");
    return res.value;
  }

  const res = validateProjectType(spec);
  if (!res.success || !("value" in res))
    throw new Error(
      `Invalid project-type spec object: ${JSON.stringify(res.errors)}`,
    );
  if (!res.value)
    throw new Error("Invalid project-type spec object: missing value");
  return res.value;
}

/**
 * Create a new project on disk from a project-type spec object or JSON file
 * path.
 *
 * This function performs the following steps:
 * - Validates and loads the provided project-type spec (either object or
 *   path to a JSON template file).
 * - Ensures the `projectRoot` directory exists and writes a `project.json`.
 * - Creates a `folders/` directory with folder descriptor files.
 * - Creates default resources (currently only text resources) under
 *   `resources/` and writes their sidecar metadata.
 *
 * @param options.projectRoot - Root path where the project will be created.
 * @param options.spec - The project-type specification object or an absolute
 *   / relative path to a JSON file containing the spec. When a path is
 *   provided, it is validated with `validateProjectTypeFile`.
 * @param options.name - Optional project name. Defaults to the template's
 *   `name` if omitted.
 * @returns An object containing the created `project` model, the list of
 * created `folders`, and any scaffolded `resources`.
 * @throws {Error} If the provided spec (file or object) fails validation.
 * @throws {Error} If filesystem operations fail while creating files or
 * directories.
 *
 * @example
 * await createProjectFromType({
 *   projectRoot: "/tmp/my-project",
 *   spec: "getwrite-config/templates/project-types/novel_project_type.json",
 *   name: "My Novel",
 * });
 */
export async function createProjectFromType(options: {
  projectRoot: string;
  spec: ProjectTypeSpec | string;
  name?: string;
}): Promise<{
  project: Project;
  folders: Folder[];
  resources: TextResource[];
}> {
  const { projectRoot, spec, name } = options;

  const specObj = await loadSpec(spec);

  // Ensure project root exists
  await mkdir(projectRoot, { recursive: true });
  const projectName = name ?? specObj.name;
  // Create Project JSON
  const project = createProject({
    name: projectName,
    projectType: specObj.id,
    rootPath: projectRoot,
    slug: slugify(projectName),
    config: {
      editorConfig: specObj.editorConfig ?? {},
      statuses: specObj.statuses,
      wordCountGoal: specObj.wordCountGoal,
    },
  });

  const projectJsonPath = path.join(projectRoot, "project.json");
  await writeFile(projectJsonPath, JSON.stringify(project, null, 2), "utf8");

  // Create folders (directories) and folder model objects
  const foldersDir = path.join(projectRoot, "folders");
  await mkdir(foldersDir, { recursive: true });
  const folders: Folder[] = [];
  // Tracks the relative path from foldersDir to each folder (keyed by folder ID).
  // Needed so subfolders of subfolders resolve the correct on-disk path rather
  // than collapsing to the bare slug at the top level.
  const folderRelPaths = new Map<string, string>();

  for (const [orderIndex, f] of specObj.folders.entries()) {
    const id = generateUUID();
    const slug = slugify(String(f.name));
    const dir = path.join(foldersDir, slug);
    await mkdir(dir, { recursive: true });
    const folderObj: Folder = {
      id,
      slug,
      name: f.name,
      parentId: null,
      orderIndex,
      createdAt: new Date().toISOString(),
      type: "folder",
      special: f.special,
      metadataSource: f.metadataSource ?? { isMetadataSource: false },
    };
    folders.push(folderObj);
    folderRelPaths.set(id, slug);
    // write a small folder descriptor file so the structure is discoverable
    await writeFile(
      path.join(dir, "folder.json"),
      JSON.stringify(folderObj, null, 2),
      "utf8",
    );
  }

  // Create subfolders declared via defaultFolders
  const subfolderOrderCounters = new Map<string, number>();
  for (const sf of specObj.defaultFolders ?? []) {
    const parentSlug = slugify(sf.folder);
    const parentFolder = folders.find((f) => f.slug === parentSlug);
    if (!parentFolder) {
      console.warn(`defaultFolders: parent "${sf.folder}" not found, skipping`);
      continue;
    }
    const orderIndex = subfolderOrderCounters.get(parentFolder.id) ?? 0;
    subfolderOrderCounters.set(parentFolder.id, orderIndex + 1);
    const subId = generateUUID();
    const subSlug = slugify(sf.name);
    const parentRelPath =
      folderRelPaths.get(parentFolder.id) ?? parentFolder.slug;
    const relPath = `${parentRelPath}/${subSlug}`;
    const subDir = path.join(foldersDir, relPath);
    await mkdir(subDir, { recursive: true });
    const subFolder: Folder = {
      id: subId,
      slug: subSlug,
      name: sf.name,
      parentId: parentFolder.id,
      orderIndex,
      createdAt: new Date().toISOString(),
      type: "folder",
      special: sf.special,
      metadataSource: sf.metadataSource ?? { isMetadataSource: false },
    };
    folders.push(subFolder);
    folderRelPaths.set(subId, relPath);
    await writeFile(
      path.join(subDir, "folder.json"),
      JSON.stringify(subFolder, null, 2),
      "utf8",
    );
  }

  // Create default resources (placeholders) and sidecars
  const resources: TextResource[] = [];
  const resourcesDir = path.join(projectRoot, "resources");
  await mkdir(resourcesDir, { recursive: true });

  for (const [orderIndex, r] of (specObj.defaultResources ?? []).entries()) {
    const folderSlug = r.folder ? slugify(String(r.folder)) : folders[0].slug;
    const folder = folders.find((f) => f.slug === folderSlug) ?? folders[0];

    // For MVP, only support text resource templates
    if (r.type === "text") {
      const typedResource = createResourceOfType("text", {
        name: r.name,
        slug: slugify(r.name),
        type: "text",
        folderId: folder.id,
        text: { plainText: r.template ?? "" },
        orderIndex,
      });
      const seededTextResource = typedResource as TextResource;

      resources.push(seededTextResource);
      await writeResourceToFile(projectRoot, seededTextResource);
      await writeRevision(
        projectRoot,
        seededTextResource.id,
        1,
        seededTextResource.plainText ?? "",
        { isCanonical: true },
      );
    }
  }

  return { project, folders, resources };
}

const projectCreator = { createProjectFromType };
export default projectCreator;
