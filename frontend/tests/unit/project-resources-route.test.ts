/**
 * Unit tests for the project-resources API route handlers (29-route tenant
 * enforcement, Batch E).
 *
 * Exercises the actual route `POST` handlers (`/api/project-resources`,
 * `/api/project-resources/excerpts`) against a `projectId`-scoped
 * `GETWRITE_PROJECTS_DIR`, per the pattern established in `tags-api.test.ts`.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { removeDirRetry } from "./helpers/fs-utils";
import { describe, it, expect } from "vitest";
import { createProject } from "../../src/lib/models/project";
import { PROJECT_FILENAME } from "../../src/lib/models/project-config";
import { generateUUID } from "../../src/lib/models/uuid";

async function makeTmpProjectsDir(): Promise<{
  projectsDir: string;
  projectId: string;
  projectPath: string;
}> {
  const projectsDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "gw-project-resources-route-"),
  );
  const projectId = generateUUID();
  const projectPath = path.join(projectsDir, projectId);
  await fs.mkdir(projectPath, { recursive: true });
  const proj = createProject({ name: "route-test" });
  await fs.writeFile(
    path.join(projectPath, PROJECT_FILENAME),
    JSON.stringify(proj, null, 2),
    "utf8",
  );
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
    await removeDirRetry(projectsDir);
  }
}

async function writeResourceContent(
  projectPath: string,
  resourceId: string,
  content: string,
): Promise<void> {
  const resourceDir = path.join(projectPath, "resources", resourceId);
  await fs.mkdir(resourceDir, { recursive: true });
  await fs.writeFile(path.join(resourceDir, "content.txt"), content, "utf8");
  await fs.writeFile(
    path.join(resourceDir, "content.tiptap.json"),
    JSON.stringify({ type: "doc", content: [] }),
    "utf8",
  );
}

describe("POST /api/project-resources (projectId-based)", () => {
  it("resolves projectId to the on-disk project and returns resource content", async () => {
    const { projectsDir, projectId, projectPath } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      await writeResourceContent(projectPath, "res-route", "Hello world");

      const { POST } = await import("../../app/api/project-resources/route");
      const res = await POST(
        new Request("http://localhost/api/project-resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, resourceId: "res-route" }),
        }) as never,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        resourceContent: { plaintextContent: string | null };
      };
      expect(body.resourceContent.plaintextContent).toBe("Hello world");
    });
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const { projectsDir } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const { POST } = await import("../../app/api/project-resources/route");
      const res = await POST(
        new Request("http://localhost/api/project-resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: "not-a-uuid",
            resourceId: "res-route",
          }),
        }) as never,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    });
  });
});

describe("POST /api/project-resources/excerpts (projectId-based)", () => {
  it("resolves projectId to the on-disk project and returns excerpts", async () => {
    const { projectsDir, projectId, projectPath } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      await writeResourceContent(projectPath, "res-a", "Excerpt content A");
      await writeResourceContent(projectPath, "res-b", "Excerpt content B");

      const { POST } =
        await import("../../app/api/project-resources/excerpts/route");
      const res = await POST(
        new Request("http://localhost/api/project-resources/excerpts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, resourceIds: ["res-a", "res-b"] }),
        }) as never,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { excerpts: Record<string, string> };
      expect(body.excerpts["res-a"]).toBe("Excerpt content A");
      expect(body.excerpts["res-b"]).toBe("Excerpt content B");
    });
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const { projectsDir } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const { POST } =
        await import("../../app/api/project-resources/excerpts/route");
      const res = await POST(
        new Request("http://localhost/api/project-resources/excerpts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: "../../etc/passwd",
            resourceIds: [],
          }),
        }) as never,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    });
  });
});
