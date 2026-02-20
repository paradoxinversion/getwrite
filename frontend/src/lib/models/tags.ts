import fs from "node:fs/promises";
import path from "node:path";
import { generateUUID } from "./uuid";
import { ProjectSchema, ProjectConfigSchema } from "./schemas";
import type { Tag } from "./types";
import { PROJECT_FILENAME } from "./project-config";

async function readProject(projectRoot: string) {
    const p = path.join(projectRoot, PROJECT_FILENAME);
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    // Validate top-level shape to catch regressions in tests
    ProjectSchema.parse(parsed);
    return parsed as any;
}

async function writeProject(projectRoot: string, projectObj: any) {
    const p = path.join(projectRoot, PROJECT_FILENAME);
    // Validate config shape before writing
    if (projectObj.config) ProjectConfigSchema.parse(projectObj.config);
    await fs.writeFile(p, JSON.stringify(projectObj, null, 2), "utf8");
}

export async function listTags(projectRoot: string): Promise<Tag[]> {
    const project = await readProject(projectRoot);
    return project.config?.tags ?? [];
}

export async function createTag(
    projectRoot: string,
    name: string,
    color?: string,
): Promise<Tag> {
    const project = await readProject(projectRoot);
    const tag: Tag = { id: generateUUID(), name, color };
    project.config = project.config ?? {};
    project.config.tags = project.config.tags ?? [];
    project.config.tags.push(tag);
    await writeProject(projectRoot, project);
    return tag;
}

export async function deleteTag(
    projectRoot: string,
    tagId: string,
): Promise<boolean> {
    const project = await readProject(projectRoot);
    if (!project.config?.tags) return false;
    const before = project.config.tags.length;
    project.config.tags = project.config.tags.filter(
        (t: Tag) => t.id !== tagId,
    );
    // Remove assignments referencing the tag
    if (project.config?.tagAssignments) {
        for (const [res, arr] of Object.entries(
            project.config.tagAssignments,
        )) {
            project.config.tagAssignments[res] = arr.filter(
                (id: string) => id !== tagId,
            );
        }
    }
    await writeProject(projectRoot, project);
    return project.config.tags.length < before;
}

export async function assignTagToResource(
    projectRoot: string,
    resourceId: string,
    tagId: string,
): Promise<void> {
    const project = await readProject(projectRoot);
    project.config = project.config ?? {};
    project.config.tagAssignments = project.config.tagAssignments ?? {};
    project.config.tagAssignments[resourceId] =
        project.config.tagAssignments[resourceId] ?? [];
    if (!project.config.tagAssignments[resourceId].includes(tagId)) {
        project.config.tagAssignments[resourceId].push(tagId);
    }
    await writeProject(projectRoot, project);
}

export async function unassignTagFromResource(
    projectRoot: string,
    resourceId: string,
    tagId: string,
): Promise<void> {
    const project = await readProject(projectRoot);
    if (!project.config?.tagAssignments?.[resourceId]) return;
    project.config.tagAssignments[resourceId] = project.config.tagAssignments[
        resourceId
    ].filter((t: string) => t !== tagId);
    await writeProject(projectRoot, project);
}

export async function listResourcesByTag(
    projectRoot: string,
    tagId: string,
): Promise<string[]> {
    const project = await readProject(projectRoot);
    const assignments = project.config?.tagAssignments ?? {};
    const results: string[] = [];
    for (const [res, arr] of Object.entries(assignments)) {
        if ((arr as string[]).includes(tagId)) results.push(res);
    }
    return results;
}

export default {
    listTags,
    createTag,
    deleteTag,
    assignTagToResource,
    unassignTagFromResource,
    listResourcesByTag,
};
