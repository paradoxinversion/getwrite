/**
 * @module feature-config-transport-service
 *
 * Transport for the per-project feature configuration (the `config.features`
 * opt-in flags and `config.organizerCardBody`).
 *
 * ADR-021 Phase 1 (Task 5) transport collapse, mirroring
 * `metadata-schema-transport-service.ts`: one `FeatureConfigTransport`
 * contract with two implementations selected by the build-time runtime.
 *
 * - Web/hosted/desktop -> `httpFeatureConfigTransport`, which carries the
 *   original `fetch('/api/project/features')` call byte-for-byte.
 * - Native (Capacitor) -> an in-process backend
 *   (`./transport/native-feature-config-backend`), dynamically imported only
 *   when `runtime === "native"`, reusing `lib/models/project-features.ts`'s
 *   `updateFeatureConfig` directly instead of HTTP.
 *
 * `createTransport` centralizes the runtime branch and dispatch (see
 * `./transport/create-transport`).
 */
import type {
  ProjectFeatureFlags,
  OrganizerCardBodyConfig,
} from "../lib/models/types";
import { createTransport } from "./transport/create-transport";

/** Partial update for the project feature configuration. */
export interface FeatureConfigUpdate {
  features?: ProjectFeatureFlags;
  organizerCardBody?: OrganizerCardBodyConfig;
}

/** The persisted feature configuration returned by the route. */
export interface FeatureConfigResult {
  features: ProjectFeatureFlags;
  organizerCardBody?: OrganizerCardBodyConfig | null;
}

function getApiErrorMessage(errorBody: unknown, fallback: string): string {
  const error = (errorBody as Record<string, unknown>)?.error;
  return typeof error === "string" ? error : fallback;
}

/** The single-operation contract shared by the HTTP and native implementations. */
export interface FeatureConfigTransport {
  /**
   * Applies a partial feature-configuration update for a project.
   *
   * @param projectId - The project's on-disk directory basename (per FR12,
   *   this is distinct from `project.json`'s internal `id` field — callers
   *   must source it via `selectActiveProjectDirectoryId` /
   *   `getProjectDirectoryId`, never `project.id`).
   * @param update - Blocks to replace (`features` and/or `organizerCardBody`).
   * @returns The persisted feature configuration.
   */
  updateFeatureConfig(
    projectId: string,
    update: FeatureConfigUpdate,
  ): Promise<FeatureConfigResult>;
}

/**
 * Web/hosted/desktop implementation: posts partial updates to
 * `/api/project/features` and returns the persisted configuration.
 */
export const httpFeatureConfigTransport: FeatureConfigTransport = {
  async updateFeatureConfig(
    projectId: string,
    update: FeatureConfigUpdate,
  ): Promise<FeatureConfigResult> {
    const response = await fetch("/api/project/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...update }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        getApiErrorMessage(
          errorBody,
          "Failed to update feature configuration.",
        ),
      );
    }

    return (await response.json()) as FeatureConfigResult;
  },
};

/**
 * Resolves the runtime-appropriate {@link FeatureConfigTransport}
 * implementation. See this module's doc comment for the dispatch rule.
 */
const resolveFeatureConfigTransport: () => Promise<FeatureConfigTransport> =
  createTransport(httpFeatureConfigTransport, () =>
    import("./transport/native-feature-config-backend").then(
      ({ createNativeFeatureConfigTransport }) =>
        createNativeFeatureConfigTransport(),
    ),
  );

/**
 * Applies a partial feature-configuration update for a project.
 *
 * @param projectId - The project's on-disk directory basename (per FR12,
 *   this is distinct from `project.json`'s internal `id` field — callers
 *   must source it via `selectActiveProjectDirectoryId` /
 *   `getProjectDirectoryId`, never `project.id`).
 * @param update - Blocks to replace (`features` and/or `organizerCardBody`).
 * @returns The persisted feature configuration.
 * @throws {Error} When the route (or, on native, the underlying core)
 *   rejects the update.
 */
export async function postFeatureConfig(
  projectId: string,
  update: FeatureConfigUpdate,
): Promise<FeatureConfigResult> {
  const transport = await resolveFeatureConfigTransport();
  return transport.updateFeatureConfig(projectId, update);
}
