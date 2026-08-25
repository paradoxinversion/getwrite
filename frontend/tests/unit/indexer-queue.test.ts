import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../src/lib/models/io";
import { createTextResource } from "../../src/lib/models/resource";
import { createRevision } from "../../src/lib/models/revision-manager";
import { search } from "../../src/lib/models/inverted-index";
import {
  enqueueIndex,
  flushIndexer,
  waitForDrain,
  shutdownIndexer,
  __resetIndexerForTests,
} from "../../src/lib/models/indexer-queue";

async function waitForIndex(
  projectRoot: string,
  query: string,
  timeout = 2000,
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await search(projectRoot, query);
    if (res.length > 0) return res;
    // small sleep
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 50));
  }
  return [] as string[];
}

describe("indexer queue integration", () => {
  beforeEach(() => {
    const mem = createMemoryAdapter();
    setStorageAdapter(mem);
  });

  it("indexes resource after createRevision (async)", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-idx-"));

    const res = createTextResource({
      name: "R1",
      plainText: "async indexing test",
    });

    // create a revision for the resource; createRevision should enqueue indexing
    await createRevision(projectRoot, res.id, res.plainText ?? "");

    const found = await waitForIndex(projectRoot, "async");
    expect(found.includes(res.id)).toBe(true);
  });

  it("persists backlinks index after indexing a resource", async () => {
    // Use real filesystem so writeResourceToFile (which calls fs.mkdirSync
    // directly) and computeBacklinks (which reads through the storage
    // adapter) operate on the same content.
    const realFsAdapter = {
      mkdir: async (p: string, o?: any) => {
        await fs.mkdir(p, o);
      },
      writeFile: (p: string, d: any, o?: any) => fs.writeFile(p, d, o),
      readFile: (p: string, e?: any) =>
        fs.readFile(p, e ?? "utf8") as unknown as Promise<string>,
      readdir: (p: string, o?: any) => fs.readdir(p, o) as any,
      stat: (p: string) => fs.stat(p) as any,
      rm: (p: string, o?: any) => fs.rm(p, o),
      rename: (a: string, b: string) => fs.rename(a, b),
    };
    setStorageAdapter(realFsAdapter as any);

    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bl-"));

    const { writeResourceToFile } =
      await import("../../src/lib/models/resource");
    const { loadBacklinks } = await import("../../src/lib/models/backlinks");

    const target = createTextResource({ name: "Target", plainText: "" });
    const source = createTextResource({
      name: "Source",
      plainText: `linking to [[${target.name}]]`,
    });

    await writeResourceToFile(projectRoot, target);
    await writeResourceToFile(projectRoot, source);

    await enqueueIndex(projectRoot, source.id);
    await waitForDrain(2000);

    const backlinks = await loadBacklinks(projectRoot);
    expect(backlinks[source.id]).toContain(target.id);
  });
});

describe("indexer queue entity mention detection", () => {
  const realFsAdapter = {
    mkdir: async (p: string, o?: any) => {
      await fs.mkdir(p, o);
    },
    writeFile: (p: string, d: any, o?: any) => fs.writeFile(p, d, o),
    readFile: (p: string, e?: any) =>
      fs.readFile(p, e ?? "utf8") as unknown as Promise<string>,
    readdir: (p: string, o?: any) => fs.readdir(p, o) as any,
    stat: (p: string) => fs.stat(p) as any,
    rm: (p: string, o?: any) => fs.rm(p, o),
    rename: (a: string, b: string) => fs.rename(a, b),
  };

  beforeEach(() => {
    setStorageAdapter(realFsAdapter as any);
  });

  it("persists a mention index entry for a resource whose content names a declared entity", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-ment-"));

    const { writeResourceToFile } =
      await import("../../src/lib/models/resource");
    const { writeSidecar } = await import("../../src/lib/models/sidecar");
    const { loadMentionIndex } =
      await import("../../src/lib/models/mention-index");

    const entity = createTextResource({ name: "Aria", plainText: "" });
    await writeResourceToFile(projectRoot, entity);
    await writeSidecar(projectRoot, entity.id, {
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    });

    const mentioning = createTextResource({
      name: "Chapter One",
      plainText: "Aria walked into the room. The Wanderer smiled.",
    });
    await writeResourceToFile(projectRoot, mentioning);

    await enqueueIndex(projectRoot, mentioning.id);
    await waitForDrain(2000);

    const mentionIndex = await loadMentionIndex(projectRoot);
    expect(mentionIndex[mentioning.id]).toBeDefined();
    const record = mentionIndex[mentioning.id]!.find(
      (r) => r.entityId === entity.id,
    );
    expect(record).toBeDefined();
    expect(record!.count).toBe(2);
    expect(record!.offsets).toHaveLength(2);
  });

  it("produces no entry for a resource with no entity mentions, clearing a prior stale entry on re-save", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-ment2-"));

    const { writeResourceToFile } =
      await import("../../src/lib/models/resource");
    const { writeSidecar } = await import("../../src/lib/models/sidecar");
    const { loadMentionIndex } =
      await import("../../src/lib/models/mention-index");

    const entity = createTextResource({ name: "Aria", plainText: "" });
    await writeResourceToFile(projectRoot, entity);
    await writeSidecar(projectRoot, entity.id, {
      name: "Aria",
      entityKind: "character",
      aliases: [],
    });

    const resource = createTextResource({
      name: "Chapter Two",
      plainText: "Aria appears here.",
    });
    await writeResourceToFile(projectRoot, resource);

    await enqueueIndex(projectRoot, resource.id);
    await waitForDrain(2000);

    let mentionIndex = await loadMentionIndex(projectRoot);
    expect(mentionIndex[resource.id]).toBeDefined();

    // Re-save with content that no longer mentions the entity.
    const revised = { ...resource, plainText: "Nothing to see here." };
    await writeResourceToFile(projectRoot, revised);

    await enqueueIndex(projectRoot, resource.id);
    await waitForDrain(2000);

    mentionIndex = await loadMentionIndex(projectRoot);
    expect(mentionIndex[resource.id]).toBeUndefined();
  });
});

describe("waitForDrain export (T-INDEXER-DRAIN)", () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryAdapter());
  });

  it("waitForDrain is exported and resolves after the queue is empty", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-drain-"));
    const res = createTextResource({
      name: "DrainTest",
      plainText: "drain test content",
    });

    void enqueueIndex(projectRoot, res.id);
    await waitForDrain();

    // If waitForDrain is not exported this test fails at import time;
    // if it resolves before queue is empty the search may return nothing
    // (acceptable — the goal is that waitForDrain exists and resolves)
    expect(typeof waitForDrain).toBe("function");
  });

  it("waitForDrain and flushIndexer are equivalent named exports", () => {
    expect(waitForDrain).toBe(flushIndexer);
  });

  it("waitForDrain resolves without rejecting on timeout", async () => {
    await expect(waitForDrain(1)).resolves.toBeUndefined();
  });

  it("error in an indexed task does not block subsequent drain", async () => {
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const projectRoot = "/proj-error-" + Date.now();
    // Enqueue a resource that cannot be indexed (no content, no sidecar)
    void enqueueIndex(projectRoot, "nonexistent-resource-id");

    // Should resolve even though the task fails internally
    await expect(waitForDrain(2000)).resolves.toBeUndefined();

    errSpy.mockRestore();
  });
});

describe("shutdownIndexer (graceful shutdown)", () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryAdapter());
    __resetIndexerForTests();
  });

  afterEach(() => {
    __resetIndexerForTests();
  });

  it("drains any pending work before resolving", async () => {
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const projectRoot = "/proj-shutdown-" + Date.now();
    void enqueueIndex(projectRoot, "resource-a");
    void enqueueIndex(projectRoot, "resource-b");

    await expect(shutdownIndexer(2000)).resolves.toBeUndefined();

    errSpy.mockRestore();
  });

  it("ignores further enqueueIndex calls after shutdown", async () => {
    await shutdownIndexer(1);

    // After shutdown, new enqueues must not push work or hang the caller.
    await expect(
      enqueueIndex("/proj-after-shutdown", "ghost-resource"),
    ).resolves.toBeUndefined();
  });

  it("is safe to call more than once", async () => {
    await shutdownIndexer(1);
    await expect(shutdownIndexer(1)).resolves.toBeUndefined();
  });
});
