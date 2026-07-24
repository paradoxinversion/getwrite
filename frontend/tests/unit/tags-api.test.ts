/**
 * Unit tests for the tags API route handlers (T-UI-TAGS-API).
 *
 * Tests call the underlying `tags.ts` module functions directly against a real
 * temporary filesystem project — the same approach used by `tags.test.ts`.
 *
 * A separate block near the end exercises the actual route `POST` handlers
 * (`/api/project/tags`, `/api/project/tags/assign`, `/api/project/tags/delete`)
 * against a `projectId`-scoped `GETWRITE_PROJECTS_DIR`, per the 29-route
 * tenant enforcement feature (see `metadata-schema-api.test.ts` for the
 * canonical pattern).
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { removeDirRetry } from "./helpers/fs-utils";
import { describe, it, expect } from "vitest";
import { createProject } from "../../src/lib/models/project";
import {
  listTags,
  createTag,
  deleteTag,
  assignTagToResource,
  unassignTagFromResource,
} from "../../src/lib/models/tags";
import { PROJECT_FILENAME } from "../../src/lib/models/project-config";
import { generateUUID } from "../../src/lib/models/uuid";
import type { Project, Tag } from "../../src/lib/models/types";

async function makeTmpProject() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-tags-api-"));
  const proj = createProject({ name: "api-test" });
  await fs.writeFile(
    path.join(dir, PROJECT_FILENAME),
    JSON.stringify(proj, null, 2),
    "utf8",
  );
  return { dir };
}

async function readAssignments(
  dir: string,
  resourceId: string,
): Promise<string[]> {
  const raw = await fs.readFile(path.join(dir, PROJECT_FILENAME), "utf8");
  const project = JSON.parse(raw) as Project;
  return project.config?.tagAssignments?.[resourceId] ?? [];
}

describe("tags API route — list action", () => {
  it("returns empty array for a project with no tags", async () => {
    const { dir } = await makeTmpProject();
    const tags = await listTags(dir);
    expect(tags).toEqual([]);
  });

  it("returns all tags after creation", async () => {
    const { dir } = await makeTmpProject();
    const t1 = await createTag(dir, "Alpha");
    const t2 = await createTag(dir, "Beta", "#ff0000");
    const tags = await listTags(dir);
    expect(tags.map((t) => t.id).sort()).toEqual([t1.id, t2.id].sort());
  });
});

describe("tags API route — create action", () => {
  it("creates a tag and returns it with a generated ID", async () => {
    const { dir } = await makeTmpProject();
    const tag = await createTag(dir, "Draft");
    expect(tag.id).toMatch(/[0-9a-f-]{36}/);
    expect(tag.name).toBe("Draft");
    expect(tag.color).toBeUndefined();
  });

  it("creates a tag with a color", async () => {
    const { dir } = await makeTmpProject();
    const tag = await createTag(dir, "Important", "#d44040");
    expect(tag.color).toBe("#d44040");
  });
});

describe("tags API route — delete action", () => {
  it("removes the tag and cleans up all assignments", async () => {
    const { dir } = await makeTmpProject();
    const tag = await createTag(dir, "ToDelete");
    await assignTagToResource(dir, "res-1", tag.id);
    await assignTagToResource(dir, "res-2", tag.id);

    const isDeleted = await deleteTag(dir, tag.id);
    expect(isDeleted).toBe(true);

    const remaining = await listTags(dir);
    expect(remaining.find((t) => t.id === tag.id)).toBeUndefined();

    expect(await readAssignments(dir, "res-1")).toEqual([]);
    expect(await readAssignments(dir, "res-2")).toEqual([]);
  });

  it("returns false when the tag does not exist", async () => {
    const { dir } = await makeTmpProject();
    const isDeleted = await deleteTag(dir, "non-existent-id");
    expect(isDeleted).toBe(false);
  });
});

describe("tags API route — assign action", () => {
  it("assigns a tag to a resource", async () => {
    const { dir } = await makeTmpProject();
    const tag = await createTag(dir, "Scene");
    await assignTagToResource(dir, "res-abc", tag.id);
    expect(await readAssignments(dir, "res-abc")).toContain(tag.id);
  });

  it("is idempotent — assigning twice does not duplicate", async () => {
    const { dir } = await makeTmpProject();
    const tag = await createTag(dir, "Dupe");
    await assignTagToResource(dir, "res-abc", tag.id);
    await assignTagToResource(dir, "res-abc", tag.id);
    const assignments = await readAssignments(dir, "res-abc");
    expect(assignments.filter((id) => id === tag.id)).toHaveLength(1);
  });

  it("unassigns a tag from a resource", async () => {
    const { dir } = await makeTmpProject();
    const tag = await createTag(dir, "Remove");
    await assignTagToResource(dir, "res-xyz", tag.id);
    await unassignTagFromResource(dir, "res-xyz", tag.id);
    expect(await readAssignments(dir, "res-xyz")).not.toContain(tag.id);
  });
});

// ---------------------------------------------------------------------------
// Route-level: POST /api/project/tags, /tags/assign, /tags/delete
// (projectId-based)
// ---------------------------------------------------------------------------

async function makeTmpProjectsDir(): Promise<{
  projectsDir: string;
  projectId: string;
}> {
  const projectsDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "gw-tags-route-"),
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
  return { projectsDir, projectId };
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

describe("POST /api/project/tags (projectId-based)", () => {
  it("resolves projectId to the on-disk project and creates/lists tags", async () => {
    const { projectsDir, projectId } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const { POST } = await import("../../app/api/project/tags/route");

      const createRes = await POST(
        new Request("http://localhost/api/project/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            projectId,
            name: "Route Tag",
          }),
        }) as never,
      );
      expect(createRes.status).toBe(200);
      const created = (await createRes.json()) as { tag: Tag };
      expect(created.tag.name).toBe("Route Tag");

      const listRes = await POST(
        new Request("http://localhost/api/project/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", projectId }),
        }) as never,
      );
      expect(listRes.status).toBe(200);
      const listed = (await listRes.json()) as { tags: Tag[] };
      expect(listed.tags.map((t) => t.id)).toContain(created.tag.id);
    });
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const { projectsDir } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const { POST } = await import("../../app/api/project/tags/route");
      const res = await POST(
        new Request("http://localhost/api/project/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list",
            projectId: "../../etc/passwd",
          }),
        }) as never,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    });
  });
});

describe("POST /api/project/tags/assign (projectId-based)", () => {
  it("resolves projectId to the on-disk project and assigns a tag", async () => {
    const { projectsDir, projectId } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const projectPath = path.join(projectsDir, projectId);
      const tag = await createTag(projectPath, "Assignable");

      const { POST } = await import("../../app/api/project/tags/assign/route");
      const res = await POST(
        new Request("http://localhost/api/project/tags/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            resourceId: "res-route",
            tagId: tag.id,
            assign: true,
          }),
        }) as never,
      );
      expect(res.status).toBe(200);
      expect(await readAssignments(projectPath, "res-route")).toContain(tag.id);
    });
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const { projectsDir } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const { POST } = await import("../../app/api/project/tags/assign/route");
      const res = await POST(
        new Request("http://localhost/api/project/tags/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: "not-a-uuid",
            resourceId: "res-route",
            tagId: "tag-1",
            assign: true,
          }),
        }) as never,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    });
  });
});

describe("POST /api/project/tags/delete (projectId-based)", () => {
  it("resolves projectId to the on-disk project and deletes a tag", async () => {
    const { projectsDir, projectId } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const projectPath = path.join(projectsDir, projectId);
      const tag = await createTag(projectPath, "Deletable");

      const { POST } = await import("../../app/api/project/tags/delete/route");
      const res = await POST(
        new Request("http://localhost/api/project/tags/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, tagId: tag.id }),
        }) as never,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { deleted: boolean };
      expect(body.deleted).toBe(true);
    });
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const { projectsDir } = await makeTmpProjectsDir();
    await withProjectsDirEnv(projectsDir, async () => {
      const { POST } = await import("../../app/api/project/tags/delete/route");
      const res = await POST(
        new Request("http://localhost/api/project/tags/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: "", tagId: "tag-1" }),
        }) as never,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    });
  });
});
