import fs from "node:fs/promises";
import path from "node:path";
import { createProject } from "./project";
import { generateUUID } from "./uuid";
import { writeSidecar } from "./sidecar";
import type {
    Project as ProjectType,
    Folder as FolderType,
    TextResource,
    ResourceType,
    MetadataValue,
} from "./types";

/** Minimal spec types for project-type JSON files. */
export interface ProjectTypeSpecFolder {
    name: string;
    special?: boolean;
}

export interface ProjectTypeSpecResource {
    folder: string;
    name: string;
    type: ResourceType;
    template?: string;
}

export interface ProjectTypeSpec {
    id: string;
    name: string;
    description?: string;
    folders: ProjectTypeSpecFolder[];
    defaultResources?: ProjectTypeSpecResource[];
}

function slugify(s: string): string {
    return s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");
}

/** Create a new project on disk from a project-type spec object or JSON file path. */
export async function createProjectFromType(options: {
    projectRoot: string;
    spec: ProjectTypeSpec | string; // object or path to JSON
    name?: string;
}): Promise<{
    project: ProjectType;
    folders: FolderType[];
    resources: TextResource[];
}> {
    const { projectRoot, spec, name } = options;

    // Load spec if a path was provided
    let specObj: ProjectTypeSpec;
    if (typeof spec === "string") {
        const raw = await fs.readFile(spec, "utf8");
        specObj = JSON.parse(raw) as ProjectTypeSpec;
    } else {
        specObj = spec;
    }

    // Ensure project root exists
    await fs.mkdir(projectRoot, { recursive: true });

    // Create Project JSON
    const project = createProject({
        name: name ?? specObj.name,
        projectType: specObj.id,
        rootPath: projectRoot,
    });
    const projectJsonPath = path.join(projectRoot, "project.json");
    await fs.writeFile(
        projectJsonPath,
        JSON.stringify(project, null, 2),
        "utf8",
    );

    // Create folders (directories) and folder model objects
    const foldersDir = path.join(projectRoot, "folders");
    await fs.mkdir(foldersDir, { recursive: true });
    const folders: FolderType[] = [];
    for (const f of specObj.folders) {
        const id = generateUUID();
        const slug = slugify(f.name);
        const dir = path.join(foldersDir, slug);
        await fs.mkdir(dir, { recursive: true });
        const now = new Date().toISOString();
        const folderObj: FolderType = {
            id,
            slug,
            name: f.name,
            parentId: null,
            orderIndex: undefined,
            createdAt: now,
        };
        folders.push(folderObj);
        // write a small folder descriptor file so the structure is discoverable
        await fs.writeFile(
            path.join(dir, "folder.json"),
            JSON.stringify(folderObj, null, 2),
            "utf8",
        );
    }

    // Create default resources (placeholders) and sidecars
    const resources: TextResource[] = [];
    const resourcesDir = path.join(projectRoot, "resources");
    await fs.mkdir(resourcesDir, { recursive: true });

    for (const r of specObj.defaultResources ?? []) {
        const folderSlug = slugify(r.folder);
        const folder =
            folders.find((ff) => ff.slug === folderSlug) ?? folders[0];
        const id = generateUUID();
        const now = new Date().toISOString();

        // For MVP, only support text resource templates
        if (r.type === "text") {
            const filename = `${slugify(r.name)}-${id}.txt`;
            const filePath = path.join(resourcesDir, filename);
            await fs.writeFile(filePath, r.template ?? "", "utf8");

            const res: TextResource = {
                id,
                name: r.name,
                slug: slugify(r.name),
                type: "text",
                folderId: folder.id,
                createdAt: now,
                plainText: r.template ?? "",
            };
            resources.push(res);

            // write sidecar metadata for resource
            const meta: Record<string, MetadataValue> = {
                id: res.id,
                name: res.name,
                type: res.type,
                createdAt: res.createdAt,
            };
            await writeSidecar(projectRoot, res.id, meta);
        }
    }

    return { project, folders, resources };
}

export default { createProjectFromType };
