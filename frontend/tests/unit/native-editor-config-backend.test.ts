// ADR-021 Phase 2 (Task 4): proves the native editor-config transport reuses
// the shared editor config core (`lib/models/editor-config-core.ts`) over a
// `capacitorFsAdapter`, with no HTTP at all — the editor-config analogue of
// `native-project-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createProject } from "../../src/lib/models/project";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeEditorConfigTransport } from "../../src/store/transport/native-editor-config-backend";

const PROJECTS_DIR = "/projects";

async function makeProject(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
): Promise<string> {
  const proj = createProject({ name: "Native Editor Config Project" });
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

describe("native editor-config transport — in-process backend reuses the shared editor config core", () => {
  it("saves heading settings and body settings with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);

    const transport = createNativeEditorConfigTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const headingsResult = await transport.saveHeadings(projectId, {
      h1: { fontSize: "42px" },
    });
    expect(headingsResult.editorConfig?.headings?.h1?.fontSize).toBe("42px");

    const bodyResult = await transport.saveBody(projectId, {
      fontSize: "18px",
    });
    expect(bodyResult.editorConfig?.body?.fontSize).toBe("18px");
    // Matches the pre-lift route's exact behavior: `headings` is always
    // resanitized from the request body (defaulting to `{}` when omitted),
    // so a body-only save resets `headings` rather than preserving them.
    expect(bodyResult.editorConfig?.headings).toEqual({});

    fetchMock.restore();
  });

  it("saveHeadings rejects with an error message for an invalid projectId", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeEditorConfigTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.saveHeadings("not-a-uuid", { h1: { fontSize: "42px" } }),
    ).rejects.toThrow(/Invalid projectId/);
  });

  it("saveBody rejects with an error message for an invalid projectId", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeEditorConfigTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.saveBody("not-a-uuid", { fontSize: "18px" }),
    ).rejects.toThrow(/Invalid projectId/);
  });
});
