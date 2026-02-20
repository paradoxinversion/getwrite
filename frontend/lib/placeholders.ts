import type { Project, Resource, ResourceType, Metadata } from "./types";

/** Create a short, random id with an optional prefix for placeholder data. */
function genId(prefix = "id"): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Return the current time as an ISO string for createdAt/updatedAt fields. */
function nowIso(): string {
    return new Date().toISOString();
}

/**
 * Create a placeholder `Resource` object for UI development.
 * @param title Human readable title shown in lists.
 * @param type ResourceType controlling icon/behavior.
 * @param projectId Optional project id — generated if omitted.
 * @param parentId Optional parent resource id for nested trees.
 * @returns A fully-formed `Resource` suitable for rendering in the tree and work area.
 */
export function createResource(
    title: string,
    type: ResourceType = "document",
    projectId?: string,
    parentId?: string,
    resourceIndex?: number,
): Resource {
    let id: string;
    if (projectId && typeof resourceIndex === "number") {
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        id = `${projectId}_res_${resourceIndex}_${slug}`;
    } else {
        id = genId("res");
    }
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
 * Create a lightweight placeholder `Project` containing a few sample `Resource`s.
 * Used to populate lists in StartPage and Storybook.
 * @param name Friendly name for the project.
 * @returns `Project` with createdAt/updatedAt and `resources` array.
 */
export function createProject(name = "Untitled Project", id?: string): Project {
    const pid = id ?? genId("proj");
    const createdAt = nowIso();
    // Build a small, realistic project tree:
    // - root folder named after the project
    //   - Workspace (folder)
    //     - Chapter 1 (folder)
    //       - Scene A (scene)
    //   - Notes (note)
    const root = createResource(name, "folder", pid, undefined, 1);
    const workspace = createResource("Workspace", "folder", pid, root.id, 2);
    const chapter1 = createResource(
        "Chapter 1",
        "folder",
        pid,
        workspace.id,
        3,
    );
    const sceneA = createResource("Scene A", "scene", pid, chapter1.id, 4);
    const notes = createResource("Notes", "note", pid, root.id, 5);

    const resources: Resource[] = [root, workspace, chapter1, sceneA, notes];
    return {
        id: pid,
        name,
        description: "Placeholder project created for UI development",
        createdAt,
        updatedAt: createdAt,
        resources,
    };
}

/**
 * Produce an array of placeholder `Project`s for list views.
 * @param count Number of sample projects to produce.
 */
export function sampleProjects(count = 2): Project[] {
    const out: Project[] = [];
    for (let i = 1; i <= count; i += 1) {
        out.push(createProject(`Sample Project ${i}`, `proj_${i}`));
    }
    return out;
}

/**
 * Utility to locate a project by id from an in-memory array.
 * Returns `undefined` when not found; UI callers should handle that case.
 */
export function findProjectById(
    projects: Project[],
    id: string,
): Project | undefined {
    return projects.find((p) => p.id === id);
}
