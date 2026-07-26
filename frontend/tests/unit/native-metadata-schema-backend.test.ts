// ADR-021 Phase 1 (Task 4): proves the native metadata-schema transport
// reuses the shared metadata-schema core
// (`lib/models/metadata-schema-dispatch-core.ts`) over a
// `capacitorFsAdapter`, with no HTTP at all — the metadata-schema analogue
// of `native-revision-backend.test.ts` / `native-query-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createProject } from "../../src/lib/models/project";
import { PROJECT_FILENAME } from "../../src/lib/models/project-config";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeMetadataSchemaTransport } from "../../src/store/transport/native-metadata-schema-backend";
import type { MetadataSchemaRequestContext } from "../../src/store/metadata-schema-transport-service";
import type { MetadataSchema } from "../../src/lib/models/types";

const PROJECTS_DIR = "/projects";
const GROUP_ID = "g1";

function baseSchema(): MetadataSchema {
  return {
    groups: [
      {
        id: GROUP_ID,
        label: "Group One",
        fields: [{ key: "my-field", label: "My Field", type: "text" }],
      },
    ],
  };
}

/** Seeds a project directory with a `project.json` carrying `schema`. */
async function seedProject(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectId: string,
  schema: MetadataSchema,
): Promise<string> {
  const adapter = capacitorFsAdapter(fs);
  const projectRoot = path.join(PROJECTS_DIR, projectId);
  await adapter.mkdir(projectRoot, { recursive: true });
  const proj = createProject({ name: "native-metadata-schema-test" });
  const projWithSchema = {
    ...proj,
    config: { ...proj.config, metadataSchema: schema },
  };
  await adapter.writeFile(
    path.join(projectRoot, PROJECT_FILENAME),
    JSON.stringify(projWithSchema, null, 2),
  );
  return projectRoot;
}

/** Seeds a resource's sidecar directly, so `fetchFieldValues` has data. */
async function seedResourceSidecar(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectRoot: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const adapter = capacitorFsAdapter(fs);
  const id = generateUUID();
  await adapter.mkdir(path.join(projectRoot, "meta"), { recursive: true });
  await adapter.writeFile(
    path.join(projectRoot, "meta", `resource-${id}.meta.json`),
    JSON.stringify({
      id,
      name: "Untitled",
      type: "text",
      slug: "untitled",
      orderIndex: 0,
      createdAt: new Date().toISOString(),
      folderId: null,
      ...fields,
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

describe("native metadata-schema transport — in-process backend reuses the shared metadata-schema core", () => {
  it("addField appends a field and returns the updated schema, with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await seedProject(fs, projectId, baseSchema());

    const transport = createNativeMetadataSchemaTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });
    const context: MetadataSchemaRequestContext = { projectId };

    const schema = await transport.addField(context, GROUP_ID, {
      key: "new-field",
      label: "New",
      type: "number",
    });

    expect(schema.groups[0]!.fields.map((f) => f.key)).toContain("new-field");

    fetchMock.restore();
  });

  it("addField rejects an invalid slug key with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await seedProject(fs, projectId, baseSchema());

    const transport = createNativeMetadataSchemaTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });
    const context: MetadataSchemaRequestContext = { projectId };

    await expect(
      transport.addField(context, GROUP_ID, {
        key: "BadSlug",
        label: "Bad",
        type: "text",
      }),
    ).rejects.toThrow(/Invalid field key/);

    fetchMock.restore();
  });

  it("renameField updates the field label with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await seedProject(fs, projectId, baseSchema());

    const transport = createNativeMetadataSchemaTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });
    const context: MetadataSchemaRequestContext = { projectId };

    const schema = await transport.renameField(
      context,
      GROUP_ID,
      "my-field",
      "Renamed Label",
    );
    const field = schema.groups[0]!.fields.find((f) => f.key === "my-field");
    expect(field?.label).toBe("Renamed Label");

    fetchMock.restore();
  });

  it("fetchFieldValues enumerates seeded sidecar values with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    const projectRoot = await seedProject(fs, projectId, baseSchema());
    await seedResourceSidecar(fs, projectRoot, { status: "Draft" });
    await seedResourceSidecar(fs, projectRoot, { status: "Draft" });
    await seedResourceSidecar(fs, projectRoot, { status: "Final" });

    const transport = createNativeMetadataSchemaTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const values = await transport.fetchFieldValues(projectId, "status");
    const draftEntry = values.find((v) => v.sample === "Draft");
    const finalEntry = values.find((v) => v.sample === "Final");

    expect(draftEntry?.count).toBe(2);
    expect(finalEntry?.count).toBe(1);

    fetchMock.restore();
  });

  it("rejects an invalid projectId without ever touching the filesystem", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeMetadataSchemaTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.addField({ projectId: "not-a-uuid" }, GROUP_ID, {
        key: "x",
        label: "X",
        type: "text",
      }),
    ).rejects.toThrow(/Invalid projectId/);

    await expect(
      transport.fetchFieldValues("not-a-uuid", "status"),
    ).rejects.toThrow(/Invalid projectId/);
  });
});
