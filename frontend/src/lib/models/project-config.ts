import fs from "node:fs/promises";
import path from "node:path";
import { ProjectConfigSchema, ProjectSchema } from "./schemas";
import type { ProjectConfig, Project as ProjectType } from "./types";
import { normalizeProjectConfig } from "./project";

/** Default project filename stored at a project's root. */
export const PROJECT_FILENAME = "project.json";

/** Read and parse `project.json` from disk, validate it, and apply config defaults. */
export async function loadProject(projectRoot: string): Promise<ProjectType> {
    const p = path.join(projectRoot, PROJECT_FILENAME);
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    // Validate the overall project shape first.
    const project = ProjectSchema.parse(parsed);

    // Ensure config has sensible defaults applied.
    const normalizedConfig = normalizeProjectConfig(project.config);
    return { ...project, config: normalizedConfig };
}

/** Read just the `ProjectConfig` from `project.json` and apply defaults. */
export async function loadProjectConfig(
    projectRoot: string,
): Promise<ProjectConfig> {
    const p = path.join(projectRoot, PROJECT_FILENAME);
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as { config?: unknown } | undefined;

    const cfg = parsed?.config ?? {};
    // Validate config shape (will throw on invalid types)
    ProjectConfigSchema.parse(cfg);
    return normalizeProjectConfig(cfg as ProjectConfig);
}

export default { loadProject, loadProjectConfig, PROJECT_FILENAME };
