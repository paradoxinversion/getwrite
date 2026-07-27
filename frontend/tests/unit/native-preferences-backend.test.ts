// ADR-021 Phase 2 (Task 4): proves the native preferences transport reuses
// the shared project preferences core (`lib/models/project-preferences-core.ts`)
// over a `capacitorFsAdapter`, with no HTTP at all — the preferences analogue
// of `native-project-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createProject } from "../../src/lib/models/project";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativePreferencesTransport } from "../../src/store/transport/native-preferences-backend";

const PROJECTS_DIR = "/projects";

async function makeProject(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
): Promise<string> {
  const proj = createProject({ name: "Native Preferences Project" });
  const adapter = capacitorFsAdapter(fs);
  const projectRoot = path.join(PROJECTS_DIR, proj.id);
  await adapter.mkdir(projectRoot, { recursive: true });
  await adapter.writeFile(
    path.join(projectRoot, "project.json"),
    JSON.stringify(proj, null, 2),
  );
  return proj.id;
}

/**
 * Fails the test if `fetch` is called — proves the native path never hits
 * HTTP, mirroring `native-project-backend.test.ts`'s guard.
 */
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

describe("native preferences transport — in-process backend reuses the shared project preferences core", () => {
  it("saves preferences and revision settings with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);

    const transport = createNativePreferencesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.savePreferences(projectId, { colorMode: "dark" }),
    ).resolves.toBeUndefined();

    const saved = await transport.saveRevisionSettings(projectId, "My Draft");
    expect(saved.defaultRevisionName).toBe("My Draft");

    fetchMock.restore();
  });

  it("savePreferences resolves silently (fire-and-forget) even for an invalid projectId", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativePreferencesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.savePreferences("not-a-uuid", { colorMode: "light" }),
    ).resolves.toBeUndefined();
  });

  it("saveRevisionSettings rejects with an error message for an invalid projectId", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativePreferencesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.saveRevisionSettings("not-a-uuid", "Draft"),
    ).rejects.toThrow(/Invalid projectId/);
  });

  it("saveRevisionSettings rejects when the name is empty", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativePreferencesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(transport.saveRevisionSettings(projectId, "")).rejects.toThrow(
      /Revision name cannot be empty/,
    );
  });
});
