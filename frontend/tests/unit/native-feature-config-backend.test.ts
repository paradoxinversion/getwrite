// ADR-021 Phase 1 (Task 5): proves the native feature-config transport
// reuses the shared, already transport-agnostic `updateFeatureConfig` core
// (`lib/models/project-features.ts`) over a `capacitorFsAdapter`, with no
// HTTP at all — the feature-config analogue of
// `native-metadata-schema-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createProject } from "../../src/lib/models/project";
import { PROJECT_FILENAME } from "../../src/lib/models/project-config";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeFeatureConfigTransport } from "../../src/store/transport/native-feature-config-backend";

const PROJECTS_DIR = "/projects";

/** Seeds a project directory with a bare `project.json`. */
async function seedProject(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectId: string,
): Promise<string> {
  const adapter = capacitorFsAdapter(fs);
  const projectRoot = path.join(PROJECTS_DIR, projectId);
  await adapter.mkdir(projectRoot, { recursive: true });
  const proj = createProject({ name: "native-feature-config-test" });
  await adapter.writeFile(
    path.join(projectRoot, PROJECT_FILENAME),
    JSON.stringify(proj, null, 2),
  );
  return projectRoot;
}

/** Fails the test if `fetch` is called — proves the native path never hits HTTP. */
function guardAgainstFetch(): { restore: () => void } {
  const original = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("fetch must not be called in-process");
  }) as unknown as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

describe("native feature-config transport — in-process backend reuses updateFeatureConfig", () => {
  it("applies a features update with no HTTP", async () => {
    const guard = guardAgainstFetch();
    try {
      const fs = createFakeCapacitorFilesystem();
      const projectId = generateUUID();
      await seedProject(fs, projectId);

      const transport = createNativeFeatureConfigTransport({
        fs,
        projectsDir: PROJECTS_DIR,
      });

      const result = await transport.updateFeatureConfig(projectId, {
        features: { timeline: true, pov: true },
      });

      expect(result.features).toEqual({ timeline: true, pov: true });
    } finally {
      guard.restore();
    }
  });

  it("applies an organizerCardBody update with no HTTP", async () => {
    const guard = guardAgainstFetch();
    try {
      const fs = createFakeCapacitorFilesystem();
      const projectId = generateUUID();
      await seedProject(fs, projectId);

      const transport = createNativeFeatureConfigTransport({
        fs,
        projectsDir: PROJECTS_DIR,
      });

      const result = await transport.updateFeatureConfig(projectId, {
        organizerCardBody: { source: "text-excerpt", excerptLength: 120 },
      });

      expect(result.organizerCardBody).toEqual({
        source: "text-excerpt",
        excerptLength: 120,
      });
    } finally {
      guard.restore();
    }
  });

  it("throws for a malformed projectId instead of falling through to HTTP", async () => {
    const guard = guardAgainstFetch();
    try {
      const fs = createFakeCapacitorFilesystem();
      const transport = createNativeFeatureConfigTransport({
        fs,
        projectsDir: PROJECTS_DIR,
      });

      await expect(
        transport.updateFeatureConfig("not-a-uuid", {
          features: { timeline: true },
        }),
      ).rejects.toThrow(/Invalid projectId/);
    } finally {
      guard.restore();
    }
  });
});
