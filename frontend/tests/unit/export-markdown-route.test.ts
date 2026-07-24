/**
 * Integration tests for the single-resource Markdown export route.
 *
 * Calls the POST handler against a temporary project directory containing real
 * content.tiptap.json files, asserting the returned Markdown and loss warnings.
 * Requests are scoped by a server-validated `projectId`, resolved against
 * `GETWRITE_PROJECTS_DIR` (Task 3 of the 29-route tenant enforcement feature)
 * rather than a client-supplied `projectPath`.
 *
 * Runs in the node environment so Request/Response come from undici.
 */
// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { removeDirRetry } from "./helpers/fs-utils";

import { afterEach, describe, expect, it } from "vitest";

import { POST } from "../../app/api/export/markdown/route";
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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-md-export-"));
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

function exportRequest(body: unknown): Request {
  return new Request("http://localhost/api/export/markdown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/export/markdown", () => {
  it("exports a text resource as a .md file matching the serializer output", async () => {
    const projectsDir = await makeProjectsDir();
    const projectId = generateUUID();
    const projectPath = path.join(projectsDir, projectId);
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and plain" },
          ],
        },
      ],
    };
    await writeResource(projectPath, "r1", doc);

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        exportRequest({
          projectId,
          resourceIds: ["r1"],
          resources: [{ id: "r1", name: "My Note", type: "text" }],
          exportName: "My Note",
        }) as never,
      ),
    );
    const json = await res.json();

    expect(json.filename).toBe("my-note.md");
    expect(json.markdown).toContain("# Title");
    expect(json.markdown).toContain("**bold**");
    // A single, fully-representable resource produces no headers and no warnings.
    expect(json.markdown).not.toContain("# My Note");
    expect(json.warnings).toEqual([]);
  });

  it("surfaces a warning when content falls back to inline HTML", async () => {
    const projectsDir = await makeProjectsDir();
    const projectId = generateUUID();
    const projectPath = path.join(projectsDir, projectId);
    const doc: JSONContent = {
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
    await writeResource(projectPath, "r1", doc);

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        exportRequest({
          projectId,
          resourceIds: ["r1"],
          resources: [{ id: "r1", name: "Has Image", type: "text" }],
          exportName: "Has Image",
        }) as never,
      ),
    );
    const json = await res.json();

    expect(json.markdown).toContain('data-resource-id="img1"');
    expect(json.warnings).toHaveLength(1);
    expect(json.warnings[0].construct).toBe("image-link");
    expect(json.warnings[0].kind).toBe("html-fallback");
  });

  it("ignores non-text resources in the selection", async () => {
    const projectsDir = await makeProjectsDir();
    const projectId = generateUUID();
    const projectPath = path.join(projectsDir, projectId);
    await writeResource(projectPath, "r1", {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "keep" }] },
      ],
    });

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        exportRequest({
          projectId,
          resourceIds: ["r1", "img"],
          resources: [
            { id: "r1", name: "Text", type: "text" },
            { id: "img", name: "Picture", type: "image" },
          ],
          exportName: "Text",
        }) as never,
      ),
    );
    const json = await res.json();

    expect(json.markdown).toContain("keep");
    expect(json.filename).toBe("text.md");
  });

  it("returns the uniform 400 when projectId is not a well-formed UUID", async () => {
    const projectsDir = await makeProjectsDir();

    const res = await withProjectsDir(projectsDir, () =>
      POST(
        exportRequest({
          projectId: "../../etc/passwd",
          resourceIds: [],
          resources: [],
          exportName: "Malicious",
        }) as never,
      ),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid projectId");
  });
});
