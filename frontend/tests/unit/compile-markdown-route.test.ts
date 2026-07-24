/**
 * Integration tests for the multi-resource Markdown compile route.
 *
 * Calls the POST handler against a temporary project directory containing real
 * content.tiptap.json files, asserting section ordering, per-section headers,
 * and the aggregated loss-warning list. Requests are scoped by a
 * server-validated `projectId`, resolved against `GETWRITE_PROJECTS_DIR`
 * (Task 2 of the 29-route tenant enforcement feature) rather than a
 * client-supplied `projectPath`.
 *
 * Runs in the node environment so Request/Response come from undici.
 */
// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { removeDirRetry } from "./helpers/fs-utils";

import { afterEach, describe, expect, it } from "vitest";

import { POST } from "../../app/api/compile/markdown/route";
import { generateUUID } from "../../src/lib/models/uuid";
import type { JSONContent } from "@tiptap/core";

const tmpDirs: string[] = [];

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) await removeDirRetry(dir);
  }
});

/** Creates a fresh temporary projects directory (the parent of project-id folders). */
async function makeProjectsDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-md-compile-"));
  tmpDirs.push(dir);
  return dir;
}

async function withProjectsDir<T>(
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

async function writeResource(
  projectPath: string,
  id: string,
  doc: JSONContent,
): Promise<void> {
  const dir = path.join(projectPath, "resources", id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "content.tiptap.json"),
    JSON.stringify(doc),
    "utf8",
  );
}

function paragraphDoc(text: string): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function compileRequest(body: unknown): Request {
  return new Request("http://localhost/api/compile/markdown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/compile/markdown", () => {
  it("compiles multiple resources in order with per-section headers", async () => {
    const projectsDir = await makeProjectsDir();
    const projectId = generateUUID();
    const projectPath = path.join(projectsDir, projectId);
    await writeResource(projectPath, "r1", paragraphDoc("first body"));
    await writeResource(projectPath, "r2", paragraphDoc("second body"));

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        compileRequest({
          projectId,
          resourceIds: ["r1", "r2"],
          resources: [
            { id: "r1", name: "Chapter One", type: "text" },
            { id: "r2", name: "Chapter Two", type: "text" },
          ],
          includeHeaders: true,
          projectName: "My Novel",
        }) as never,
      ),
    );
    const json = await res.json();

    expect(json.filename).toBe("my-novel.md");
    expect(json.markdown).toContain("# Chapter One");
    expect(json.markdown).toContain("# Chapter Two");
    expect(json.markdown).toContain("first body");
    expect(json.markdown).toContain("second body");
    // Ordering: Chapter One precedes Chapter Two.
    expect(json.markdown.indexOf("Chapter One")).toBeLessThan(
      json.markdown.indexOf("Chapter Two"),
    );
    expect(json.warnings).toEqual([]);
  });

  it("omits headers when includeHeaders is false", async () => {
    const projectsDir = await makeProjectsDir();
    const projectId = generateUUID();
    const projectPath = path.join(projectsDir, projectId);
    await writeResource(projectPath, "r1", paragraphDoc("body only"));

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        compileRequest({
          projectId,
          resourceIds: ["r1"],
          resources: [{ id: "r1", name: "Solo", type: "text" }],
          includeHeaders: false,
          projectName: "Solo Project",
        }) as never,
      ),
    );
    const json = await res.json();

    expect(json.markdown).toContain("body only");
    expect(json.markdown).not.toContain("# Solo");
  });

  it("aggregates loss warnings across sections and ignores non-text resources", async () => {
    const projectsDir = await makeProjectsDir();
    const projectId = generateUUID();
    const projectPath = path.join(projectsDir, projectId);
    const imageDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "/api/resource/img1/file",
            alt: "pic",
            resourceId: "img1",
          },
        },
      ],
    };
    await writeResource(projectPath, "r1", imageDoc);
    await writeResource(projectPath, "r2", imageDoc);

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        compileRequest({
          projectId,
          resourceIds: ["r1", "r2", "pic"],
          resources: [
            { id: "r1", name: "One", type: "text" },
            { id: "r2", name: "Two", type: "text" },
            { id: "pic", name: "Picture", type: "image" },
          ],
          includeHeaders: true,
          projectName: "Gallery",
        }) as never,
      ),
    );
    const json = await res.json();

    expect(json.markdown).not.toContain("# Picture");
    expect(json.warnings).toHaveLength(1);
    expect(json.warnings[0].construct).toBe("image-link");
    // One image per text resource → aggregated count of 2.
    expect(json.warnings[0].count).toBe(2);
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const projectsDir = await makeProjectsDir();

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        compileRequest({
          projectId: "../../etc/passwd",
          resourceIds: [],
          resources: [],
          includeHeaders: true,
          projectName: "Malicious",
        }) as never,
      ),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid projectId");
  });
});
