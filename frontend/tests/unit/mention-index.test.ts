import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { setStorageAdapter, readFile } from "../../src/lib/models/io";
import {
  loadMentionIndex,
  persistMentionIndex,
  invertMentionIndex,
  type MentionIndex,
  type MentionRecord,
} from "../../src/lib/models/mention-index";

describe("mention-index (Task 4)", () => {
  beforeEach(() => {
    const mem = createMemoryAdapter();
    setStorageAdapter(mem);
  });

  it("round-trips a MentionRecord[] through persist and load, including offsets and counts", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-mi-"));

    const resourceId = "resource-a";
    const record: MentionRecord = {
      entityId: "entity-x",
      resourceId,
      count: 2,
      offsets: [10, 42],
    };
    const index: MentionIndex = { [resourceId]: [record] };

    await persistMentionIndex(projectRoot, index);
    const loaded = await loadMentionIndex(projectRoot);

    expect(loaded).toEqual(index);
    expect(loaded[resourceId]?.[0]?.offsets).toEqual([10, 42]);
    expect(loaded[resourceId]?.[0]?.count).toBe(2);
  });

  it("persists to meta/index/mentions.json, separate from backlinks.json and inverted.json", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-mi-"));

    await persistMentionIndex(projectRoot, {
      "resource-a": [
        {
          entityId: "entity-x",
          resourceId: "resource-a",
          count: 1,
          offsets: [0],
        },
      ],
    });

    const raw = await readFile(
      path.join(projectRoot, "meta", "index", "mentions.json"),
      "utf8",
    );
    expect(JSON.parse(raw)).toEqual({
      "resource-a": [
        {
          entityId: "entity-x",
          resourceId: "resource-a",
          count: 1,
          offsets: [0],
        },
      ],
    });
  });

  it("groups records by entity across multiple resources via invertMentionIndex", () => {
    const recordA: MentionRecord = {
      entityId: "entity-x",
      resourceId: "resource-a",
      count: 1,
      offsets: [5],
    };
    const recordB: MentionRecord = {
      entityId: "entity-x",
      resourceId: "resource-b",
      count: 2,
      offsets: [1, 8],
    };
    const recordC: MentionRecord = {
      entityId: "entity-y",
      resourceId: "resource-a",
      count: 1,
      offsets: [20],
    };

    const index: MentionIndex = {
      "resource-a": [recordA, recordC],
      "resource-b": [recordB],
    };

    const byEntity = invertMentionIndex(index);

    expect(byEntity["entity-x"]).toEqual([recordA, recordB]);
    expect(byEntity["entity-y"]).toEqual([recordC]);
  });

  it("returns an empty index when the mentions file is missing, mirroring loadBacklinks", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-mi-"));

    const loaded = await loadMentionIndex(projectRoot);

    expect(loaded).toEqual({});
  });
});
