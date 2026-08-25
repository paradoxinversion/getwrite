/**
 * Unit tests for GET /api/resource/[resource-id]/mentions and
 * GET /api/resource/[resource-id]/mentioned-in (Task 10).
 *
 * Exercises the route handlers against a `projectId`-scoped
 * `GETWRITE_PROJECTS_DIR`, per the pattern established in
 * `media-file-route.test.ts`.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET as mentionsGet } from "../../app/api/resource/[resource-id]/mentions/route";
import { GET as mentionedInGet } from "../../app/api/resource/[resource-id]/mentioned-in/route";
import { persistMentionIndex } from "../../src/lib/models/mention-index";
import { writeSidecar } from "../../src/lib/models/sidecar";
import { generateUUID } from "../../src/lib/models/uuid";
import { removeDirRetry } from "./helpers/fs-utils";

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
    path.join(os.tmpdir(), "gw-mentions-route-"),
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

function makeGetRequest(
  resourceId: string,
  routeSegment: string,
  projectId: string,
): NextRequest {
  const url = new URL(
    `http://localhost/api/resource/${resourceId}/${routeSegment}?projectId=${encodeURIComponent(projectId)}`,
  );
  return new NextRequest(url.toString());
}

async function writeResourceContent(
  projectPath: string,
  resourceId: string,
  plainText: string,
): Promise<void> {
  const dir = path.join(projectPath, "resources", resourceId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "content.txt"), plainText, "utf8");
}

describe("GET /api/resource/[id]/mentions", () => {
  it("returns the entities mentioned in a resource", async () => {
    const { projectsDir, projectId, projectPath } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const sceneId = "scene-1";
      const ariaId = "entity-aria";
      await writeSidecar(projectPath, ariaId, { id: ariaId, name: "Aria" });
      await persistMentionIndex(projectPath, {
        [sceneId]: [
          { entityId: ariaId, resourceId: sceneId, count: 1, offsets: [0] },
        ],
      });

      const res = await mentionsGet(
        makeGetRequest(sceneId, "mentions", projectId),
        { params: Promise.resolve({ "resource-id": sceneId }) },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ mentions: [{ entityId: ariaId, name: "Aria" }] });
    });
  });

  it("returns an empty list for a resource with no mentions", async () => {
    const { projectsDir, projectId } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const res = await mentionsGet(
        makeGetRequest("no-mentions", "mentions", projectId),
        { params: Promise.resolve({ "resource-id": "no-mentions" }) },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ mentions: [] });
    });
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const { projectsDir } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const res = await mentionsGet(
        makeGetRequest("some-id", "mentions", "not-a-uuid"),
        { params: Promise.resolve({ "resource-id": "some-id" }) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    });
  });
});

describe("GET /api/resource/[id]/mentioned-in", () => {
  it("returns every resource mentioning the entity, with a snippet per occurrence", async () => {
    const { projectsDir, projectId, projectPath } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const ariaId = "entity-aria";
      const sceneId = "scene-1";
      await writeSidecar(projectPath, sceneId, {
        id: sceneId,
        name: "Chapter One",
      });
      await writeResourceContent(
        projectPath,
        sceneId,
        "Aria drew her blade and stepped forward.",
      );
      await persistMentionIndex(projectPath, {
        [sceneId]: [
          { entityId: ariaId, resourceId: sceneId, count: 1, offsets: [0] },
        ],
      });

      const res = await mentionedInGet(
        makeGetRequest(ariaId, "mentioned-in", projectId),
        { params: Promise.resolve({ "resource-id": ariaId }) },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mentionedIn).toHaveLength(1);
      expect(json.mentionedIn[0].resourceId).toBe(sceneId);
      expect(json.mentionedIn[0].name).toBe("Chapter One");
      expect(json.mentionedIn[0].snippets).toHaveLength(1);
      expect(json.mentionedIn[0].snippets[0]).toContain("Aria drew her blade");
    });
  });

  it("returns an empty list for an entity with no mentions", async () => {
    const { projectsDir, projectId } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const res = await mentionedInGet(
        makeGetRequest("entity-unmentioned", "mentioned-in", projectId),
        { params: Promise.resolve({ "resource-id": "entity-unmentioned" }) },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ mentionedIn: [] });
    });
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const { projectsDir } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const res = await mentionedInGet(
        makeGetRequest("some-id", "mentioned-in", "not-a-uuid"),
        { params: Promise.resolve({ "resource-id": "some-id" }) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    });
  });
});
