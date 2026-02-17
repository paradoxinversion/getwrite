import type { Project, Resource, ResourceType, Metadata } from "./types";

function genId(prefix = "id"): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
    return new Date().toISOString();
}

/**
 * Create a placeholder Resource with sensible defaults.
 */
export function createResource(
    title: string,
    type: ResourceType = "document",
    projectId?: string,
    parentId?: string,
): Resource {
    const id = genId("res");
    const pid = projectId ?? genId("proj");
    const createdAt = nowIso();
    const metadata: Metadata = {
        status: "draft",
        characters: [],
        locations: [],
        items: [],
        pov: null,
        wordCount: 0,
        notes: "",
    };

    return {
        id,
        projectId: pid,
        parentId,
        title,
        type,
        content: `Placeholder content for ${title}`,
        createdAt,
        updatedAt: createdAt,
        metadata,
    };
}

/**
 * Create a lightweight placeholder Project with a few resources.
 */
export function createProject(name = "Untitled Project"): Project {
    const id = genId("proj");
    const createdAt = nowIso();

    const resources: Resource[] = [
        createResource("Chapter 1", "document", id),
        createResource("Scene A", "scene", id),
        createResource("Notes", "note", id),
    ];

    return {
        id,
        name,
        description: "Placeholder project created for UI development",
        createdAt,
        updatedAt: createdAt,
        resources,
    };
}

/**
 * Return a list of sample projects for populating mock lists.
 */
export function sampleProjects(count = 2): Project[] {
    const out: Project[] = [];
    for (let i = 1; i <= count; i += 1) {
        out.push(createProject(`Sample Project ${i}`));
    }
    return out;
}

/**
 * Find a project by id from an array of projects.
 */
export function findProjectById(
    projects: Project[],
    id: string,
): Project | undefined {
    return projects.find((p) => p.id === id);
}
