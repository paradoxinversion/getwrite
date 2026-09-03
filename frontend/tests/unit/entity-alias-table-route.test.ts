/**
 * Unit tests for GET /api/project/[project-id]/entity-alias-table.
 *
 * Exercises the route handler against a `projectId`-scoped
 * `GETWRITE_PROJECTS_DIR`, per the pattern established in
 * `mentions-routes.test.ts`.
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
import type { EntityAliasTable } from "../../src/lib/models/entity-alias-table";

const tmpDirs: string[] = [];

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) await removeDirRetry(dir);
  }
});

async function makeTmpProjectsDir(): Promise<{
  projectsDir: string;
  projectId: string;
  projectPath: string;
}> {
  const projectsDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "gw-entity-alias-route-"),
  );
  tmpDirs.push(projectsDir);
  const projectId = generateUUID();
  const projectPath = path.join(projectsDir, projectId);
  await fs.mkdir(projectPath, { recursive: true });
  return { projectsDir, projectId, projectPath };
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

describe("GET /api/project/[project-id]/entity-alias-table", () => {
  it("returns the entity alias table for a project with declared entities", async () => {
    const { projectsDir, projectId, projectPath } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const ariaId = "entity-aria";
      const brannId = "entity-brann";
      await fs.mkdir(path.join(projectPath, "resources", ariaId), {
        recursive: true,
      });
      await fs.mkdir(path.join(projectPath, "resources", brannId), {
        recursive: true,
      });
      await writeSidecar(projectPath, ariaId, {
        id: ariaId,
        name: "Aria",
        entityKind: "character",
        aliases: ["Ari"],
      });
      await writeSidecar(projectPath, brannId, {
        id: brannId,
        name: "Brann",
        entityKind: "character",
        aliases: ["Ari"],
      });

      const res = await GET(makeGetRequest(projectId), {
        params: Promise.resolve({ "project-id": projectId }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as EntityAliasTable;

      expect(json.entities[ariaId]).toEqual({
        entityId: ariaId,
        entityKind: "character",
        name: "Aria",
        aliases: ["Ari"],
        terms: ["Aria", "Ari"],
      });
      expect(json.entities[brannId]).toEqual({
        entityId: brannId,
        entityKind: "character",
        name: "Brann",
        aliases: ["Ari"],
        terms: ["Brann", "Ari"],
      });
      expect(json.claimedBy["ari"]).toEqual(
        expect.arrayContaining([ariaId, brannId]),
      );
    });
  });

  it("returns an empty table for a project with no declared entities", async () => {
    const { projectsDir, projectId } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const res = await GET(makeGetRequest(projectId), {
        params: Promise.resolve({ "project-id": projectId }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as EntityAliasTable;
      expect(json).toEqual({ entities: {}, claimedBy: {} });
    });
  });

  it("returns the uniform 400 when project-id is not a well-formed UUID", async () => {
    const { projectsDir } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const res = await GET(makeGetRequest("not-a-uuid"), {
        params: Promise.resolve({ "project-id": "not-a-uuid" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    });
  });
});
