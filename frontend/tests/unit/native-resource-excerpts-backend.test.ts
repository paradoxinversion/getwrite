// ADR-021 Phase 2 (Task 3): proves the native resource-excerpts transport
// reuses the shared excerpts core (`lib/models/resource-excerpts-core.ts`)
// over a `capacitorFsAdapter`, with no HTTP at all — the excerpts analogue
// of `native-resource-backend.test.ts`.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateUUID } from "../../src/lib/models/uuid";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createNativeResourceExcerptsTransport } from "../../src/store/transport/native-resource-excerpts-backend";

const PROJECTS_DIR = "/projects";

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

/**
 * Fails the test if `fetch` is called — proves the native path never hits
 * HTTP, mirroring `native-resource-backend.test.ts`'s guard.
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

describe("native resource-excerpts transport — in-process backend reuses the shared excerpts core", () => {
  it("fetches excerpts for multiple resources with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    const resourceA = generateUUID();
    const resourceB = generateUUID();
    await seedResourceContent(fs, projectId, resourceA, "Excerpt A content");
    await seedResourceContent(fs, projectId, resourceB, "Excerpt B content");

    const transport = createNativeResourceExcerptsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const excerpts = await transport.fetch(projectId, [resourceA, resourceB]);
    expect(excerpts[resourceA]).toBe("Excerpt A content");
    expect(excerpts[resourceB]).toBe("Excerpt B content");

    fetchMock.restore();
  });

  it("degrades gracefully to {} on an invalid projectId, matching the HTTP transport's degrade-on-failure contract", async () => {
    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeResourceExcerptsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    await expect(
      transport.fetch("not-a-uuid", [generateUUID()]),
    ).resolves.toEqual({});
  });

  it("skips resources with no content.txt (folders/media), matching readResourceExcerpts", async () => {
    const fs = createFakeCapacitorFilesystem();
    const projectId = generateUUID();
    const withContent = generateUUID();
    const withoutContent = generateUUID();
    await seedResourceContent(fs, projectId, withContent, "Has content");

    const transport = createNativeResourceExcerptsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const excerpts = await transport.fetch(projectId, [
      withContent,
      withoutContent,
    ]);
    expect(excerpts[withContent]).toBe("Has content");
    expect(excerpts).not.toHaveProperty(withoutContent);
  });
});
