// ADR-021 Phase 1 (Task 3): proves the native query transport reuses the
// shared query cores (`lib/models/query-evaluate-core.ts`,
// `lib/models/saved-query-dispatch-core.ts`) over a `capacitorFsAdapter`,
// with no HTTP at all — the query analogue of
// `native-revision-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createProject } from "../../src/lib/models/project";
import { PROJECT_FILENAME } from "../../src/lib/models/project-config";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeQueryTransport } from "../../src/store/transport/native-query-backend";
import type { QueryRequestContext } from "../../src/store/query-transport-service";
import type { SavedQuery } from "../../src/lib/models/saved-queries";

const PROJECTS_DIR = "/projects";

/** Seeds a project directory with a minimal `project.json`. */
async function seedProject(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectId: string,
): Promise<string> {
  const adapter = capacitorFsAdapter(fs);
  const projectRoot = path.join(PROJECTS_DIR, projectId);
  await adapter.mkdir(projectRoot, { recursive: true });
  const proj = createProject({ name: "native-query-test" });
  await adapter.writeFile(
    path.join(projectRoot, PROJECT_FILENAME),
    JSON.stringify(proj, null, 2),
  );
  return projectRoot;
}

/** Seeds a resource's sidecar directly, bypassing `writeSidecar`'s indexer side effect. */
async function seedResource(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectRoot: string,
  fields: { type?: string; name?: string },
): Promise<string> {
  const adapter = capacitorFsAdapter(fs);
  const id = generateUUID();
  await adapter.mkdir(path.join(projectRoot, "resources", id), {
    recursive: true,
  });
  await adapter.mkdir(path.join(projectRoot, "meta"), { recursive: true });
  await adapter.writeFile(
    path.join(projectRoot, "meta", `resource-${id}.meta.json`),
    JSON.stringify({
      id,
      name: fields.name ?? "Untitled",
      type: fields.type ?? "text",
      slug: (fields.name ?? "untitled").toLowerCase().replace(/\s+/g, "-"),
      orderIndex: 0,
      createdAt: new Date().toISOString(),
      folderId: null,
    }),
  );
  return id;
}

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

describe("native query transport — in-process backend reuses the shared query cores", () => {
  it("evaluateQueryAst evaluates against seeded resources with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    const projectRoot = await seedProject(fs, projectId);
    const idText = await seedResource(fs, projectRoot, {
      type: "text",
      name: "Scene One",
    });
    await seedResource(fs, projectRoot, { type: "image", name: "Photo" });

    const transport = createNativeQueryTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });
    const context: QueryRequestContext = { projectId };

    const result = await transport.evaluateQueryAst(context, {
      op: "eq",
      field: "type",
      value: "text",
    });

    expect(result.ids).toContain(idText);
    expect(result.ids).toHaveLength(1);

    fetchMock.restore();
  });

  it("lists, writes, and deletes saved queries with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await seedProject(fs, projectId);

    const transport = createNativeQueryTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });
    const context: QueryRequestContext = { projectId };

    const empty = await transport.fetchSavedQueryList(context);
    expect(empty.queries).toEqual([]);

    const query: SavedQuery = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      name: "All text resources",
      definition: { op: "eq", field: "type", value: "text" },
    };

    const written = await transport.persistSavedQuery(context, query);
    expect(written.query.id).toBe(query.id);

    const afterWrite = await transport.fetchSavedQueryList(context);
    expect(afterWrite.queries).toHaveLength(1);
    expect(afterWrite.queries[0]!.id).toBe(query.id);

    await transport.removeSavedQuery(context, query.id);

    const afterDelete = await transport.fetchSavedQueryList(context);
    expect(afterDelete.queries).toEqual([]);

    fetchMock.restore();
  });

  it("rejects an invalid projectId without ever touching the filesystem", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeQueryTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.fetchSavedQueryList({ projectId: "not-a-uuid" }),
    ).rejects.toThrow(/Invalid projectId/);

    await expect(
      transport.evaluateQueryAst(
        { projectId: "not-a-uuid" },
        { op: "exists", field: "status" },
      ),
    ).rejects.toThrow(/Invalid projectId/);
  });
});
