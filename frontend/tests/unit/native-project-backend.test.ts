// ADR-021 Phase 2 (Task 2): proves the native projects transport reuses the
// shared project CRUD core (`lib/models/project-crud-core.ts`) over a
// `capacitorFsAdapter`, with no HTTP at all — the projects analogue of
// `native-revision-backend.test.ts`.
import { describe, expect, it } from "vitest";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { createNativeProjectsTransport } from "../../src/store/transport/native-project-backend";

const PROJECTS_DIR = "/projects";

describe("native projects transport — in-process backend reuses the shared project CRUD core", () => {
  it("creates a project, lists it, opens it, and reindexes it with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();

    const transport = createNativeProjectsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const created = await transport.create("My Blank Project", "blank");
    expect(created.project.name).toBe("My Blank Project");

    const list = await transport.list();
    expect(list).toHaveLength(1);
    expect(list[0].project.name).toBe("My Blank Project");

    const projectId = list[0].project.rootPath?.split("/").pop();
    expect(projectId).toBeDefined();

    const opened = await transport.open(String(projectId));
    expect(opened.project.name).toBe("My Blank Project");

    // Fire-and-forget: resolves without throwing regardless of whether the
    // internal `id` matches an actual project — mirrors the HTTP transport's
    // never-checked-response behavior.
    await expect(
      transport.reindex(created.project.id),
    ).resolves.toBeUndefined();
    await expect(
      transport.reindex("no-such-internal-id"),
    ).resolves.toBeUndefined();

    fetchMock.restore();
  });

  it("open rejects an invalid projectId without ever touching the filesystem", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeProjectsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(transport.open("not-a-uuid")).rejects.toThrow(
      /Invalid projectId/,
    );
  });

  it("create rejects when name or projectType is missing", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeProjectsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(transport.create("", "blank")).rejects.toThrow(
      "Missing name or projectType",
    );
  });

  it("create rejects when the projectType has no matching template", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeProjectsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.create("Untyped", "not-a-real-type"),
    ).rejects.toThrow("Project type not found");
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
