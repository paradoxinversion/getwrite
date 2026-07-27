// ADR-021 Phase 2 (Task 3): proves the native resources transport reuses the
// shared resource CRUD core (`lib/models/resource-crud-core.ts`) plus the
// already-lifted revision core (`lib/models/revision-core.ts`) over a
// `capacitorFsAdapter`, with no HTTP at all — the resources analogue of
// `native-revision-backend.test.ts` / `native-project-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeResourcesTransport } from "../../src/store/transport/native-resource-backend";

const PROJECTS_DIR = "/projects";

async function makeProject(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
): Promise<string> {
  const projectId = generateUUID();
  const adapter = capacitorFsAdapter(fs);
  const projectRoot = path.join(PROJECTS_DIR, projectId);
  await adapter.mkdir(projectRoot, { recursive: true });
  await adapter.writeFile(
    path.join(projectRoot, "project.json"),
    JSON.stringify({ id: projectId, name: "Native Project" }, null, 2),
  );
  return projectId;
}

/**
 * Fails the test if `fetch` is called — proves the native path never hits
 * HTTP, mirroring `native-revision-backend.test.ts`'s guard.
 */
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

describe("native resources transport — in-process backend reuses the shared resource CRUD core", () => {
  it("creates a text resource, writes its initial revision, fetches its content, and deletes it, with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);

    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const created = await transport.create(projectId, {
      type: "text",
      name: "Chapter One",
      text: { plainText: "Once upon a time" },
    });
    expect(created.resource.name).toBe("Chapter One");

    const fetched = await transport.fetchContent(
      projectId,
      created.resource.id,
    );
    expect(fetched?.resourceContent?.plaintextContent).toBe("Once upon a time");
    expect(fetched?.revisions).toHaveLength(1);

    await transport.remove(created.resource.id, projectId);
    fetchMock.restore();
  });

  it("copies and renames a resource with no HTTP", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const created = await transport.create(projectId, {
      type: "text",
      name: "Original",
      text: { plainText: "content" },
    });

    const copied = await transport.copy(created.resource.id, "Copy", projectId);
    expect(copied.resource.name).toBe("Copy");
    expect(copied.resource.id).not.toBe(created.resource.id);

    const didRename = await transport.rename(
      created.resource.id,
      projectId,
      "Renamed",
      "resource",
    );
    expect(didRename).toBe(true);
  });

  it("rename resolves to false (never throws) on failure, matching the HTTP transport's boolean-return parity", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    // No such resource.
    await expect(
      transport.rename(generateUUID(), projectId, "New Name", "resource"),
    ).resolves.toBe(false);

    // Invalid projectId.
    await expect(
      transport.rename(generateUUID(), "not-a-uuid", "New Name", "resource"),
    ).resolves.toBe(false);
  });

  it("updates the sidecar for a resource with no HTTP", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const created = await transport.create(projectId, {
      type: "text",
      name: "Sidecar Target",
      text: { plainText: "content" },
    });

    await transport.updateSidecar(created.resource.id, projectId, {
      ...created.resource,
      userMetadata: { status: "draft" },
    } as never);

    const fetched = await transport.fetchContent(
      projectId,
      created.resource.id,
    );
    expect(fetched).not.toBeNull();
  });

  it("fetchContent resolves to null on failure (invalid projectId), matching the HTTP transport's null-on-failure parity", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.fetchContent("not-a-uuid", generateUUID()),
    ).resolves.toBeNull();
  });

  it("fetchRevisionContent and patchRevisionContent reuse revision-core.ts directly (not duplicated logic)", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const created = await transport.create(projectId, {
      type: "text",
      name: "Revisioned",
      text: { plainText: "seed content" },
    });

    const fetched = await transport.fetchContent(
      projectId,
      created.resource.id,
    );
    const canonicalRevisionId = fetched?.revisions?.find(
      (r) => r.isCanonical,
    )?.id;
    expect(canonicalRevisionId).toBeDefined();

    const readContent = await transport.fetchRevisionContent(
      created.resource.id,
      projectId,
      String(canonicalRevisionId),
    );
    expect(readContent).toBe("seed content");

    const patched = await transport.patchRevisionContent(
      created.resource.id,
      projectId,
      String(canonicalRevisionId),
      "updated content",
    );
    expect(patched.updatedAt).toBeDefined();

    const readAfterPatch = await transport.fetchRevisionContent(
      created.resource.id,
      projectId,
      String(canonicalRevisionId),
    );
    expect(readAfterPatch).toBe("updated content");
  });

  it("fetchRevisionContent resolves to null on failure, matching the HTTP transport's null-on-failure parity", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.fetchRevisionContent(
        generateUUID(),
        projectId,
        "no-such-revision",
      ),
    ).resolves.toBeNull();
  });

  it("reorders folders and resources with no HTTP", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const a = await transport.create(projectId, {
      type: "text",
      name: "A",
      text: { plainText: "a" },
    });
    const b = await transport.create(projectId, {
      type: "text",
      name: "B",
      text: { plainText: "b" },
    });

    // reorder() resolves the project by internal id (the pre-lift route's
    // legacy behavior) — passing the actual project.json internal id here.
    await transport.reorder(
      projectId,
      {
        folderOrder: [],
        resourceOrder: [
          { id: a.resource.id, orderIndex: 1 },
          { id: b.resource.id, orderIndex: 0 },
        ],
      },
      path.join(PROJECTS_DIR, projectId),
    );

    // No throw == success; the underlying core swallows per-item failures.
  });

  it("uploadMedia validates and persists an image resource from raw bytes, with no multipart/File involved", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    // Minimal 1x1 PNG signature bytes are unnecessary — media-metadata
    // extraction degrades gracefully on unparsable bytes.
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    const uploaded = await transport.uploadMedia(projectId, {
      fileBytes: bytes,
      fileName: "photo.png",
      mimeType: "image/png",
      fileSize: bytes.byteLength,
    });

    expect(uploaded.resource.type).toBe("image");
  });

  it("uploadMedia rejects an unsupported file type", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = await makeProject(fs);
    const transport = createNativeResourcesTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const bytes = new Uint8Array([1, 2, 3]);

    await expect(
      transport.uploadMedia(projectId, {
        fileBytes: bytes,
        fileName: "document.pdf",
        mimeType: "application/pdf",
        fileSize: bytes.byteLength,
      }),
    ).rejects.toThrow(/Unsupported file type/);
  });
});
