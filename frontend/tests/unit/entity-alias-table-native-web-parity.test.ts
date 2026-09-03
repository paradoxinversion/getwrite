/**
 * entity-highlighting Task 14: native/web parity for the entity alias
 * table (FR-6).
 *
 * Neither the Task 3 route test (`entity-alias-table-route.test.ts`) nor the
 * Task 5 native-backend test (`native-entity-alias-table-backend.test.ts`)
 * asserts that the two transports return the *same* shape for equivalent
 * underlying project data — each only exercises its own side. This test
 * seeds the same fixture data (two entities, one shared alias, to exercise
 * `claimedBy`) into both a real temp-dir project (read by the HTTP route via
 * `buildEntityAliasTable`) and a fake Capacitor filesystem (read by
 * `createNativeEntityAliasTableTransport`), then asserts the two results are
 * structurally equivalent — the `{ entities, claimedBy }` shape a caller on
 * either runtime receives is identical.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "../../app/api/project/[project-id]/entity-alias-table/route";
import { writeSidecar } from "../../src/lib/models/sidecar";
import { generateUUID } from "../../src/lib/models/uuid";
import { removeDirRetry } from "./helpers/fs-utils";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeEntityAliasTableTransport } from "../../src/store/transport/native-entity-alias-table-backend";
import type { EntityAliasTable } from "../../src/lib/models/entity-alias-table";

const tmpDirs: string[] = [];

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) await removeDirRetry(dir);
  }
});

interface FixtureEntity {
  id: string;
  name: string;
  entityKind: string;
  aliases: string[];
}

/** Same fixture used for both runtimes: two entities sharing one alias. */
function buildFixture(): { aria: FixtureEntity; brann: FixtureEntity } {
  return {
    aria: {
      id: generateUUID(),
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    },
    brann: {
      id: generateUUID(),
      name: "The Wanderer",
      entityKind: "character",
      aliases: [],
    },
  };
}

async function seedHttpFixture(
  fixture: ReturnType<typeof buildFixture>,
): Promise<{ projectsDir: string; projectId: string; projectPath: string }> {
  const projectsDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "gw-entity-alias-parity-"),
  );
  tmpDirs.push(projectsDir);
  const projectId = generateUUID();
  const projectPath = path.join(projectsDir, projectId);
  await fs.mkdir(projectPath, { recursive: true });

  for (const entity of [fixture.aria, fixture.brann]) {
    await fs.mkdir(path.join(projectPath, "resources", entity.id), {
      recursive: true,
    });
    await writeSidecar(projectPath, entity.id, {
      id: entity.id,
      name: entity.name,
      entityKind: entity.entityKind,
      aliases: entity.aliases,
    });
  }

  return { projectsDir, projectId, projectPath };
}

async function seedNativeFixture(
  fixture: ReturnType<typeof buildFixture>,
): Promise<{
  fs: ReturnType<typeof createFakeCapacitorFilesystem>;
  projectsDir: string;
  projectId: string;
}> {
  const projectsDir = "/projects";
  const nativeFs = createFakeCapacitorFilesystem();
  const adapter = capacitorFsAdapter(nativeFs);
  const projectId = generateUUID();
  const metaDir = path.join(projectsDir, projectId, "meta");
  await adapter.mkdir(metaDir, { recursive: true });

  for (const entity of [fixture.aria, fixture.brann]) {
    const resourceDir = path.join(
      projectsDir,
      projectId,
      "resources",
      entity.id,
    );
    await adapter.mkdir(resourceDir, { recursive: true });
    await adapter.writeFile(
      path.join(metaDir, `resource-${entity.id}.meta.json`),
      JSON.stringify(
        {
          id: entity.id,
          name: entity.name,
          entityKind: entity.entityKind,
          aliases: entity.aliases,
        },
        null,
        2,
      ),
    );
  }

  return { fs: nativeFs, projectsDir, projectId };
}

async function withProjectsDirEnv<T>(
  projectsDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  const originalEnv = process.env.GETWRITE_PROJECTS_DIR;
  process.env.GETWRITE_PROJECTS_DIR = projectsDir;
  try {
    return await fn();
  } finally {
    process.env.GETWRITE_PROJECTS_DIR = originalEnv;
  }
}

function makeGetRequest(projectId: string): NextRequest {
  const url = new URL(
    `http://localhost/api/project/${projectId}/entity-alias-table`,
  );
  return new NextRequest(url.toString());
}

describe("entity alias table — native/web parity (FR-6)", () => {
  it("returns structurally equivalent {entities, claimedBy} for the same fixture on both transports", async () => {
    const fixture = buildFixture();

    // HTTP side: real temp-dir project, real route handler.
    const { projectsDir, projectId } = await seedHttpFixture(fixture);
    const httpTable = await withProjectsDirEnv(projectsDir, async () => {
      const res = await GET(makeGetRequest(projectId), {
        params: Promise.resolve({ "project-id": projectId }),
      });
      expect(res.status).toBe(200);
      return (await res.json()) as EntityAliasTable;
    });

    // Native side: fake Capacitor filesystem, in-process transport.
    const native = await seedNativeFixture(fixture);
    const nativeTransport = createNativeEntityAliasTableTransport({
      fs: native.fs,
      projectsDir: native.projectsDir,
    });
    const nativeTable = await nativeTransport.getEntityAliasTable(
      native.projectId,
    );

    // Both fixtures declare the same entity names/kinds/aliases, so the
    // per-entity fields (kind, name, aliases, terms) and the normalized
    // claimedBy keys must match, modulo the entityId namespace (which
    // differs between the two seeded fixtures by construction).
    const httpEntities = Object.values(httpTable.entities).map((e) => ({
      entityKind: e.entityKind,
      name: e.name,
      aliases: e.aliases,
      terms: e.terms,
    }));
    const nativeEntities = Object.values(nativeTable.entities).map((e) => ({
      entityKind: e.entityKind,
      name: e.name,
      aliases: e.aliases,
      terms: e.terms,
    }));
    expect(nativeEntities.sort((a, b) => a.name.localeCompare(b.name))).toEqual(
      httpEntities.sort((a, b) => a.name.localeCompare(b.name)),
    );

    expect(Object.keys(nativeTable.claimedBy).sort()).toEqual(
      Object.keys(httpTable.claimedBy).sort(),
    );
    expect(Object.keys(nativeTable)).toEqual(Object.keys(httpTable));
    expect(nativeTable.claimedBy["the wanderer"]?.length).toEqual(
      httpTable.claimedBy["the wanderer"]?.length,
    );
  });

  it("returns the identical empty table {entities: {}, claimedBy: {}} on both transports for a project with no entities", async () => {
    const projectsDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-entity-alias-parity-empty-"),
    );
    tmpDirs.push(projectsDir);
    const httpProjectId = generateUUID();
    await fs.mkdir(path.join(projectsDir, httpProjectId), { recursive: true });

    const httpTable = await withProjectsDirEnv(projectsDir, async () => {
      const res = await GET(makeGetRequest(httpProjectId), {
        params: Promise.resolve({ "project-id": httpProjectId }),
      });
      return (await res.json()) as EntityAliasTable;
    });

    const nativeFs = createFakeCapacitorFilesystem();
    const adapter = capacitorFsAdapter(nativeFs);
    const nativeProjectsDir = "/projects";
    const nativeProjectId = generateUUID();
    await adapter.mkdir(path.join(nativeProjectsDir, nativeProjectId), {
      recursive: true,
    });
    const nativeTransport = createNativeEntityAliasTableTransport({
      fs: nativeFs,
      projectsDir: nativeProjectsDir,
    });
    const nativeTable =
      await nativeTransport.getEntityAliasTable(nativeProjectId);

    expect(nativeTable).toEqual({ entities: {}, claimedBy: {} });
    expect(httpTable).toEqual({ entities: {}, claimedBy: {} });
    expect(nativeTable).toEqual(httpTable);
  });
});
