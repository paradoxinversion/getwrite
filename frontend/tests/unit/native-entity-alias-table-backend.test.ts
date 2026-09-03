// entity-highlighting Task 5: proves the native entity-alias-table transport
// reuses the shared alias-table model (`lib/models/entity-alias-table.ts`)
// over a `capacitorFsAdapter`, with no HTTP at all — the alias-table analogue
// of `native-resource-excerpts-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeEntityAliasTableTransport } from "../../src/store/transport/native-entity-alias-table-backend";

const PROJECTS_DIR = "/projects";

async function seedEntitySidecar(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectId: string,
  resourceId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const adapter = capacitorFsAdapter(fs);
  const resourceDir = path.join(
    PROJECTS_DIR,
    projectId,
    "resources",
    resourceId,
  );
  const metaDir = path.join(PROJECTS_DIR, projectId, "meta");
  await adapter.mkdir(resourceDir, { recursive: true });
  await adapter.mkdir(metaDir, { recursive: true });
  await adapter.writeFile(
    path.join(metaDir, `resource-${resourceId}.meta.json`),
    JSON.stringify(fields, null, 2),
  );
}

/**
 * Fails the test if `fetch` is called — proves the native path never hits
 * HTTP, mirroring `native-resource-excerpts-backend.test.ts`'s guard.
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

describe("native entity-alias-table transport — in-process backend reuses the shared alias-table model", () => {
  it("resolves the alias table for a project with a declared entity, with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    const entityId = generateUUID();
    await seedEntitySidecar(fs, projectId, entityId, {
      name: "Aria",
      entityKind: "character",
      aliases: ["Ari", "The Wanderer"],
    });

    const transport = createNativeEntityAliasTableTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const table = await transport.getEntityAliasTable(projectId);
    expect(table.entities[entityId]).toEqual({
      entityId,
      entityKind: "character",
      name: "Aria",
      aliases: ["Ari", "The Wanderer"],
      terms: ["Aria", "Ari", "The Wanderer"],
    });
    expect(table.claimedBy).toEqual({});

    fetchMock.restore();
  });

  it("reports ambiguous terms claimed by more than one entity, matching buildEntityAliasTable", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    const entityA = generateUUID();
    const entityB = generateUUID();
    await seedEntitySidecar(fs, projectId, entityA, {
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    });
    await seedEntitySidecar(fs, projectId, entityB, {
      name: "The Wanderer",
      entityKind: "character",
      aliases: [],
    });

    const transport = createNativeEntityAliasTableTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const table = await transport.getEntityAliasTable(projectId);
    expect(table.claimedBy["the wanderer"]).toEqual(
      expect.arrayContaining([entityA, entityB]),
    );
  });

  it("degrades gracefully to the empty alias table on an invalid projectId, matching the HTTP transport's degrade-on-failure contract", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeEntityAliasTableTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(transport.getEntityAliasTable("not-a-uuid")).resolves.toEqual({
      entities: {},
      claimedBy: {},
    });
  });
});
