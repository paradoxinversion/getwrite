// ADR-021 Phase 2 (Task 4): proves the native tags transport reuses the
// shared tags CRUD core (`lib/models/tags-crud-core.ts`) over a
// `capacitorFsAdapter`, with no HTTP at all — the tags analogue of
// `native-project-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createProject } from "../../src/lib/models/project";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeTagsTransport } from "../../src/store/transport/native-tags-backend";

const PROJECTS_DIR = "/projects";

async function makeProject(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
): Promise<string> {
  const proj = createProject({ name: "Native Tags Project" });
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

describe("native tags transport — in-process backend reuses the shared tags CRUD core", () => {
  it("creates, lists, assigns, unassigns, and deletes a tag with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);

    const transport = createNativeTagsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await transport.create(projectId, "Draft", "#ff0000");
    const tags = await transport.list(projectId);
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("Draft");

    const tagId = tags[0].id;
    await transport.assign(projectId, "resource-1", tagId, true);
    const assignments = await transport.listAssignments(
      projectId,
      "resource-1",
    );
    expect(assignments).toContain(tagId);

    await transport.assign(projectId, "resource-1", tagId, false);
    const afterUnassign = await transport.listAssignments(
      projectId,
      "resource-1",
    );
    expect(afterUnassign).not.toContain(tagId);

    await transport.remove(projectId, tagId);
    const afterDelete = await transport.list(projectId);
    expect(afterDelete).toHaveLength(0);

    fetchMock.restore();
  });

  it("list degrades to [] rather than throwing when projectId is invalid", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeTagsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(transport.list("not-a-uuid")).resolves.toEqual([]);
  });

  it("listAssignments degrades to [] rather than throwing when projectId is invalid", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeTagsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.listAssignments("not-a-uuid", "resource-1"),
    ).resolves.toEqual([]);
  });

  it("create/remove/assign resolve silently (fire-and-forget) even for an invalid projectId", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeTagsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.create("not-a-uuid", "Draft"),
    ).resolves.toBeUndefined();
    await expect(
      transport.remove("not-a-uuid", generateUUID()),
    ).resolves.toBeUndefined();
    await expect(
      transport.assign("not-a-uuid", "resource-1", generateUUID(), true),
    ).resolves.toBeUndefined();
  });
});
