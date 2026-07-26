// ADR-021 Phase 1 (Task 2): proves the native revision transport reuses the
// shared revision core (`lib/models/revision-core.ts`) over a
// `capacitorFsAdapter`, with no HTTP at all — the revision analogue of
// `transport-collapse.spike.test.ts`'s "in-process backend reuses the shared
// search core" section.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeRevisionTransport } from "../../src/store/transport/native-revision-backend";
import type { RevisionRequestContext } from "../../src/store/revision-transport-service";

const PROJECTS_DIR = "/projects";

/** Seeds a resource's current saved content, as an editor autosave would. */
async function seedResourceContent(
  fs: ReturnType<typeof createFakeCapacitorFilesystem>,
  projectId: string,
  resourceId: string,
  content: string,
): Promise<void> {
  const adapter = capacitorFsAdapter(fs);
  const resourceDir = path.join(
    PROJECTS_DIR,
    projectId,
    "resources",
    resourceId,
  );
  await adapter.mkdir(resourceDir, { recursive: true });
  await adapter.writeFile(path.join(resourceDir, "content.txt"), content);
}

describe("native revision transport — in-process backend reuses the shared revision core", () => {
  it("creates, reads, sets canonical, and deletes revisions with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    const resourceId = generateUUID();
    await seedResourceContent(fs, projectId, resourceId, "seed content");

    const transport = createNativeRevisionTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });
    const context: RevisionRequestContext = { projectId, resourceId };

    const first = await transport.create(context, "First");
    expect(first.metadata).toMatchObject({ name: "First" });
    expect(first.isCanonical).toBe(false);

    const read = await transport.read(context, first.id);
    expect(read.revision.id).toBe(first.id);
    expect(read.content).toBe("seed content");

    await transport.setCanonical(context, first.id);
    const afterCanonical = await transport.read(context, first.id);
    expect(afterCanonical.revision.isCanonical).toBe(true);

    const second = await transport.create(context, "Second");

    await expect(transport.delete(context, first.id)).rejects.toThrow(
      "Cannot delete the canonical revision; promote another revision first.",
    );

    await transport.delete(context, second.id);
    await expect(transport.read(context, second.id)).rejects.toThrow(
      `Revision ${second.id} not found.`,
    );

    fetchMock.restore();
  });

  it("updateInPlace rejects non-canonical revisions, matching the route's guard", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    const resourceId = generateUUID();
    await seedResourceContent(fs, projectId, resourceId, "seed content");

    const transport = createNativeRevisionTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });
    const context: RevisionRequestContext = { projectId, resourceId };

    const revision = await transport.create(context, "Only revision");

    await expect(
      transport.updateInPlace(context, revision.id, "new content"),
    ).rejects.toThrow("Only the canonical revision can be updated in place.");

    await transport.setCanonical(context, revision.id);
    const updated = await transport.updateInPlace(
      context,
      revision.id,
      "new content",
    );
    expect(updated.updatedAt).toBeDefined();

    const read = await transport.read(context, revision.id);
    expect(read.content).toBe("new content");

    fetchMock.restore();
  });

  it("rejects an invalid projectId without ever touching the filesystem", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeRevisionTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.read(
        { projectId: "not-a-uuid", resourceId: generateUUID() },
        generateUUID(),
      ),
    ).rejects.toThrow(/Invalid projectId/);
  });
});

/**
 * Fails the test if `fetch` is called — proves the native path never hits
 * HTTP, mirroring `transport-collapse.spike.test.ts`'s guard.
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
