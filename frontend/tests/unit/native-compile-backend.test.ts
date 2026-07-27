// ADR-021 Phase 2 (Task 5): proves the native compile transport reuses the
// shared compile core (`lib/models/compile-core.ts`) over a
// `capacitorFsAdapter`, with no HTTP at all, and returns the same
// normalized result shape the HTTP transport parses out of response
// headers — the compile analogue of `native-project-backend.test.ts`.
//
// Runs in the node environment (like the PDF/DOCX compile route tests) so
// the `Buffer`-derived `ArrayBuffer`s this suite asserts on are real,
// same-realm `ArrayBuffer` instances rather than jsdom's separate global.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  FsEncoding,
  createFakeCapacitorFilesystem,
} from "../../src/lib/models/capacitor-filesystem";
import { createNativeCompileTransport } from "../../src/store/transport/native-compile-backend";
import { generateUUID } from "../../src/lib/models/uuid";
import type { CompileBody } from "../../src/lib/api/compile";

const PROJECTS_DIR = "/projects";

async function writeResource(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectsDir: string,
  projectId: string,
  resourceId: string,
  plainText: string,
): Promise<void> {
  const base = `${projectsDir}/${projectId}/resources/${resourceId}`;
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: plainText }] },
    ],
  };
  await fs.writeFile({
    path: `${base}/content.txt`,
    data: plainText,
    encoding: FsEncoding.UTF8,
    recursive: true,
  });
  await fs.writeFile({
    path: `${base}/content.tiptap.json`,
    data: JSON.stringify(doc),
    encoding: FsEncoding.UTF8,
    recursive: true,
  });
}

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

describe("native compile transport — in-process backend reuses the shared compile core", () => {
  it("compiles text with no HTTP and returns the normalized {text, filename} shape", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await writeResource(fs, PROJECTS_DIR, projectId, "r1", "hello there");

    const transport = createNativeCompileTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const body: CompileBody = {
      projectId,
      resourceIds: ["r1"],
      resources: [{ id: "r1", name: "Chapter One", type: "text" }],
      includeHeaders: true,
      projectName: "My Novel",
    };

    const result = await transport.text(body);
    expect(result.filename).toBe("my-novel.txt");
    expect(result.text).toContain("hello there");

    fetchMock.restore();
  });

  it("compiles markdown with no HTTP and returns warnings", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await writeResource(fs, PROJECTS_DIR, projectId, "r1", "hello there");

    const transport = createNativeCompileTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const result = await transport.markdown({
      projectId,
      resourceIds: ["r1"],
      resources: [{ id: "r1", name: "Chapter One", type: "text" }],
      includeHeaders: true,
      projectName: "My Novel",
    });

    expect(result.filename).toBe("my-novel.md");
    expect(result.markdown).toContain("hello there");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("compiles a PDF with no HTTP and returns an ArrayBuffer directly (no header parsing)", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await writeResource(fs, PROJECTS_DIR, projectId, "r1", "hello there");

    const transport = createNativeCompileTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const result = await transport.pdf({
      projectId,
      resourceIds: ["r1"],
      resources: [{ id: "r1", name: "Chapter One", type: "text" }],
      includeHeaders: true,
      projectName: "My Novel",
    });

    expect(result.filename).toBe("my-novel.pdf");
    expect(result.arrayBuffer).toBeInstanceOf(ArrayBuffer);
    expect(result.arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("compiles a DOCX with no HTTP and returns an ArrayBuffer directly", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await writeResource(fs, PROJECTS_DIR, projectId, "r1", "hello there");

    const transport = createNativeCompileTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const result = await transport.docx({
      projectId,
      resourceIds: ["r1"],
      resources: [{ id: "r1", name: "Chapter One", type: "text" }],
      includeHeaders: true,
      projectName: "My Novel",
    });

    expect(result.filename).toBe("my-novel.docx");
    expect(result.arrayBuffer).toBeInstanceOf(ArrayBuffer);
    expect(result.arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("rejects an invalid projectId without ever touching the filesystem", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeCompileTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.text({
        projectId: "not-a-uuid",
        resourceIds: [],
        resources: [],
        includeHeaders: false,
        projectName: "Malicious",
      }),
    ).rejects.toThrow(/Invalid projectId/);
  });
});
