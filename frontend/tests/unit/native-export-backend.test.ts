// ADR-021 Phase 2 (Task 5): proves the native export transport reuses the
// shared export core (`lib/models/export-core.ts`) over a
// `capacitorFsAdapter`, with no HTTP at all — the export analogue of
// `native-project-backend.test.ts`.
import { describe, expect, it } from "vitest";
import {
  FsEncoding,
  createFakeCapacitorFilesystem,
} from "../../src/lib/models/capacitor-filesystem";
import { createNativeExportTransport } from "../../src/store/transport/native-export-backend";
import { generateUUID } from "../../src/lib/models/uuid";

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

describe("native export transport — in-process backend reuses the shared export core", () => {
  it("exports plain text with no HTTP, no headers for a single resource", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await writeResource(fs, PROJECTS_DIR, projectId, "r1", "keep this line");

    const transport = createNativeExportTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const result = await transport.text({
      projectId,
      resourceIds: ["r1"],
      resources: [{ id: "r1", name: "My Note", type: "text" }],
      exportName: "My Note",
    });

    expect(result.filename).toBe("my-note.txt");
    expect(result.text).toContain("keep this line");
    expect(result.text).not.toContain("My Note");

    fetchMock.restore();
  });

  it("exports markdown with section headers for multiple resources", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    await writeResource(fs, PROJECTS_DIR, projectId, "r1", "first body");
    await writeResource(fs, PROJECTS_DIR, projectId, "r2", "second body");

    const transport = createNativeExportTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const result = await transport.markdown({
      projectId,
      resourceIds: ["r1", "r2"],
      resources: [
        { id: "r1", name: "Chapter One", type: "text" },
        { id: "r2", name: "Chapter Two", type: "text" },
      ],
      exportName: "Book",
    });

    expect(result.filename).toBe("book.md");
    expect(result.markdown).toContain("Chapter One");
    expect(result.markdown).toContain("first body");
    expect(result.markdown).toContain("second body");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("rejects an invalid projectId without ever touching the filesystem", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeExportTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.text({
        projectId: "../../etc/passwd",
        resourceIds: [],
        resources: [],
        exportName: "Malicious",
      }),
    ).rejects.toThrow(/Invalid projectId/);
  });
});
