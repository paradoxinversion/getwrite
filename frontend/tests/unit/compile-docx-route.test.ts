/**
 * Integration tests for the multi-resource DOCX compile route.
 *
 * Requests are scoped by a server-validated `projectId`, resolved against
 * `GETWRITE_PROJECTS_DIR` (Task 2 of the 29-route tenant enforcement
 * feature) rather than a client-supplied `projectPath`.
 *
 * Runs in the node environment so Request/Response come from undici.
 */
// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { removeDirRetry } from "./helpers/fs-utils";

import { afterEach, describe, expect, it } from "vitest";

import { POST } from "../../app/api/compile/docx/route";
import { generateUUID } from "../../src/lib/models/uuid";
import type { JSONContent } from "@tiptap/core";

const tmpDirs: string[] = [];

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) await removeDirRetry(dir);
  }
});

async function makeProjectsDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-docx-compile-"));
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
  plainText: string,
): Promise<void> {
  const dir = path.join(projectPath, "resources", id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "content.tiptap.json"),
    JSON.stringify(doc),
    "utf8",
  );
  await fs.writeFile(path.join(dir, "content.txt"), plainText, "utf8");
}

function paragraphDoc(text: string): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function compileRequest(body: unknown): Request {
  return new Request("http://localhost/api/compile/docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/compile/docx", () => {
  it("compiles a resource into a downloadable .docx", async () => {
    const projectsDir = await makeProjectsDir();
    const projectId = generateUUID();
    const projectPath = path.join(projectsDir, projectId);
    await writeResource(
      projectPath,
      "r1",
      paragraphDoc("hello there"),
      "hello there",
    );

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        compileRequest({
          projectId,
          resourceIds: ["r1"],
          resources: [{ id: "r1", name: "Chapter One", type: "text" }],
          includeHeaders: true,
          projectName: "My Novel",
        }) as never,
      ),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("my-novel.docx");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const projectsDir = await makeProjectsDir();

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        compileRequest({
          projectId: "not-a-uuid",
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
