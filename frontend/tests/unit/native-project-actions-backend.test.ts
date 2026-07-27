// ADR-021 Phase 2 (Task 2): proves the native project-actions transport
// reuses the shared project CRUD core (`lib/models/project-crud-core.ts`)
// over a `capacitorFsAdapter`, with no HTTP at all — the rename/delete
// analogue of `native-revision-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeProjectActionsTransport } from "../../src/store/transport/native-project-actions-backend";

const PROJECTS_DIR = "/projects";

/** Seeds a minimal `project.json` for a project, as `project-creator.ts` would. */
async function seedProject(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectId: string,
  name: string,
): Promise<string> {
  const adapter = capacitorFsAdapter(fs);
  const projectPath = path.join(PROJECTS_DIR, projectId);
  await adapter.mkdir(projectPath, { recursive: true });
  await adapter.writeFile(
    path.join(projectPath, "project.json"),
    JSON.stringify({ id: projectId, name }, null, 2),
  );
  return projectPath;
}

describe("native project-actions transport — in-process backend reuses the shared project CRUD core", () => {
  it("renames and deletes a project with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await seedProject(fs, projectId, "old-name");

    const transport = createNativeProjectActionsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await transport.rename(projectId, "new-name");

    const adapter = capacitorFsAdapter(fs);
    const raw = await adapter.readFile(
      path.join(PROJECTS_DIR, projectId, "project.json"),
      "utf8",
    );
    expect(JSON.parse(raw as string).name).toBe("new-name");

    await transport.delete(projectId);

    await expect(
      adapter.readFile(
        path.join(PROJECTS_DIR, projectId, "project.json"),
        "utf8",
      ),
    ).rejects.toThrow();

    fetchMock.restore();
  });

  it("rejects an invalid projectId without ever touching the filesystem", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeProjectActionsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(transport.rename("not-a-uuid", "x")).rejects.toThrow(
      /Invalid projectId/,
    );
    await expect(transport.delete("not-a-uuid")).rejects.toThrow(
      /Invalid projectId/,
    );
  });
});

/**
 * Fails the test if `fetch` is called — proves the native path never hits
 * HTTP, mirroring `native-revision-backend.test.ts`'s guard.
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
