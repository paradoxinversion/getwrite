import { generateUUID } from "./uuid";
import type {
    Project as ProjectType,
    ProjectConfig,
    MetadataValue,
} from "./types";
import { ProjectSchema, Infer } from "./schemas";

/** Default values applied when creating a new project. */
const DEFAULT_MAX_REVISIONS = 50;
const DEFAULT_AUTO_PRUNE = true;

/** Apply sensible defaults to a `ProjectConfig` object. */
export function normalizeProjectConfig(config?: ProjectConfig): ProjectConfig {
    return {
        maxRevisions: config?.maxRevisions ?? DEFAULT_MAX_REVISIONS,
        statuses: config?.statuses ?? [],
        autoPrune: config?.autoPrune ?? DEFAULT_AUTO_PRUNE,
    };
}

/**
 * Create a new `Project` model object with generated identity and timestamps.
 * The result is validated against the runtime `ProjectSchema` before being returned.
 */
export function createProject(params: {
    name: string;
    slug?: string;
    projectType?: string;
    rootPath?: string;
    config?: ProjectConfig;
    metadata?: Record<string, MetadataValue>;
}): ProjectType {
    const now = new Date().toISOString();
    const project: ProjectType = {
        id: generateUUID(),
        name: params.name,
        slug: params.slug,
        createdAt: now,
        updatedAt: undefined,
        projectType: params.projectType,
        rootPath: params.rootPath,
        config: normalizeProjectConfig(params.config),
        metadata: params.metadata,
    };

    // Validate runtime shape; will throw on invalid fields which surfaces issues
    // during development and in unit tests.
    ProjectSchema.parse(project);
    return project;
}

/** Validate and return a typed Project; throws on invalid input. */
export function validateProject(input: unknown): Infer<typeof ProjectSchema> {
    return ProjectSchema.parse(input);
}

export default { createProject, validateProject, normalizeProjectConfig };
