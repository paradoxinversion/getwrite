/**
 * @module project-features
 *
 * Persistence helper for the per-project feature configuration stored in
 * `project.json` — the `config.features` opt-in flags (Timeline, POV, Synopsis,
 * Notes, Entities) and `config.organizerCardBody` (what Organizer cards render
 * as their body).
 *
 * Unlike the lock-free `editor-config` / `preferences` read-modify-writes, this
 * helper acquires the per-project lock so toggle writes cannot race the
 * schema/migration writes in `metadata-schema.ts` and clobber data. It
 * deliberately does NOT bump `config.metadataRevision`: toggles change no field
 * keys or sidecar values, so invalidating the query cache would be wasteful —
 * that bump is reserved for the one-time load migration.
 */
import { readFile, writeFile } from "./io";
import path from "node:path";
import { acquireLock } from "./locks";
import { PROJECT_FILENAME } from "./project-config";
import {
  ProjectFeatureFlagsSchema,
  OrganizerCardBodyConfigSchema,
} from "./schemas";
import type {
  Project,
  ProjectFeatureFlags,
  OrganizerCardBodyConfig,
} from "./types";

/** Partial update for the project feature configuration. */
export interface FeatureConfigUpdate {
  /** Replacement feature-toggle map. Omit to leave the existing flags untouched. */
  features?: ProjectFeatureFlags;
  /** Replacement Organizer card-body config. Omit to leave the existing config untouched. */
  organizerCardBody?: OrganizerCardBodyConfig;
}

/** The persisted feature configuration after an update. */
export interface FeatureConfigResult {
  features: ProjectFeatureFlags;
  organizerCardBody?: OrganizerCardBodyConfig;
}

/**
 * Validates and persists a partial feature-configuration update to
 * `project.json`. Each provided block (`features` / `organizerCardBody`)
 * replaces the existing block wholesale; an omitted block is left unchanged.
 *
 * The read-modify-write runs under the project lock and updates `updatedAt`. It
 * never bumps `metadataRevision`.
 *
 * @param projectRoot - Absolute path to the project root directory.
 * @param update - Blocks to replace. At least one should be provided.
 * @returns The feature configuration as persisted.
 * @throws {import("zod").ZodError} If a provided block is malformed.
 * @throws {Error} If `project.json` cannot be read or written.
 */
export async function updateFeatureConfig(
  projectRoot: string,
  update: FeatureConfigUpdate,
): Promise<FeatureConfigResult> {
  // Validate up front so malformed input never reaches disk.
  const nextFeatures =
    update.features !== undefined
      ? ProjectFeatureFlagsSchema.parse(update.features)
      : undefined;
  // Invariant: the Timeline view reads the timeline date fields, so the view
  // cannot be on without them. Enforce it here, at the single write seam, so
  // every caller (not just the UI toggles) is prevented from persisting the
  // stranded "view on, no data fields" state.
  if (nextFeatures?.timelineView === true) {
    nextFeatures.timeline = true;
  }
  const nextCardBody =
    update.organizerCardBody !== undefined
      ? OrganizerCardBodyConfigSchema.parse(update.organizerCardBody)
      : undefined;

  const release = await acquireLock(projectRoot);
  try {
    const filePath = path.join(projectRoot, PROJECT_FILENAME);
    const raw = await readFile(filePath, "utf8");
    const project = JSON.parse(raw) as Project;
    const config = project.config ?? { editorConfig: {} };

    if (nextFeatures !== undefined) {
      config.features = nextFeatures;
    }
    if (nextCardBody !== undefined) {
      config.organizerCardBody = nextCardBody;
    }

    const nextProject: Project = {
      ...project,
      config,
      updatedAt: new Date().toISOString(),
    };
    // NOTE: intentionally no metadataRevision bump — see module docstring.
    await writeFile(filePath, JSON.stringify(nextProject, null, 2), "utf8");

    return {
      features: config.features ?? {},
      organizerCardBody: config.organizerCardBody,
    };
  } finally {
    release();
  }
}

export default { updateFeatureConfig };
