import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createProjectFromType } from "../../../../../src/lib/models/project-creator";
import { readSidecar } from "../../../../../src/lib/models/sidecar";
import { validateProject } from "../../../../../src/lib/models/project";
import type {
    Folder as FolderType,
    TextResource,
} from "../../../../../src/lib/models/types";

export interface CreateAndAssertResult {
    projectPath: string;
    folders: FolderType[];
    resources: TextResource[];
}

/**
 * Create a project from a spec (object or path) and assert basic invariants.
 * Returns created artifacts for additional assertions by tests.
 */
export async function createAndAssertProject(
    specOrPath: unknown | string,
    opts?: { projectRoot?: string; name?: string },
): Promise<CreateAndAssertResult> {
    const projectRoot =
        opts?.projectRoot ??
        (await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-helpers-")));

    // Load spec when a path is provided
    let specObj: unknown;
    if (typeof specOrPath === "string") {
        const resolved = path.isAbsolute(specOrPath)
            ? specOrPath
            : path.resolve(specOrPath);
        const raw = await fs.readFile(resolved, "utf8");
        specObj = JSON.parse(raw) as unknown;
    } else {
        specObj = specOrPath;
    }

    const { project, folders, resources } = await createProjectFromType({
        projectRoot,
        spec: specObj as unknown,
        name: opts?.name,
    });

    // Validate project shape using runtime validator
    validateProject(project);

    // Basic filesystem assertions
    const foldersDir = path.join(projectRoot, "folders");
    const folderEntries = await fs.readdir(foldersDir);
    if (folderEntries.length < 1) {
        throw new Error("expected at least one folder to be created");
    }

    // Ensure sidecars exist for resources that were created
    for (const r of resources) {
        const meta = await readSidecar(projectRoot, r.id);
        if (meta === null) {
            throw new Error(`missing sidecar for resource ${r.id}`);
        }
    }

    return { projectPath: projectRoot, folders, resources };
}

export default { createAndAssertProject };
