import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { setStorageAdapter } from "../../src/lib/models/io";
import { createTextResource } from "../../src/lib/models/resource";

// This suite exercises real fs writes (writeResourceToFile calls fs.mkdirSync
// directly) alongside the storage adapter used by sidecar/indexer-queue, so —
// mirroring indexer-queue.test.ts's "entity mention detection" describe
// block — it installs a real-fs-backed StorageAdapter rather than the
// in-memory one.
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

describe("targeted entity rescan on alias/name change (Task 6 / FR-8)", () => {
  beforeEach(() => {
    setStorageAdapter(realFsAdapter as any);
  });

  it("drops mentions attributed to an old alias and adds mentions under the new alias, without touching an unrelated entity's records", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-entity-rescan-"),
    );

    const { writeResourceToFile } =
      await import("../../src/lib/models/resource");
    const { writeSidecar } = await import("../../src/lib/models/sidecar");
    const { loadMentionIndex } =
      await import("../../src/lib/models/mention-index");
    const { flushIndexer } = await import("../../src/lib/models/indexer-queue");

    // Entity under test: "Aria", aliased as "The Wanderer".
    const aria = createTextResource({ name: "Aria", plainText: "" });
    await writeResourceToFile(projectRoot, aria);
    await writeSidecar(projectRoot, aria.id, {
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    });

    // An unrelated entity whose records must be left untouched.
    const bram = createTextResource({ name: "Bram", plainText: "" });
    await writeResourceToFile(projectRoot, bram);
    await writeSidecar(projectRoot, bram.id, {
      name: "Bram",
      entityKind: "character",
      aliases: [],
    });

    // A resource whose text is never re-saved for the rest of this test —
    // it mentions Aria under her OLD alias ("The Wanderer"), Aria under a
    // term that will only later become her NEW alias ("Nightshade"), and
    // Bram by name. Holding the resource's own content fixed for the whole
    // test isolates the assertion to the entity rescan's effect: any change
    // in Bram's offsets, or in which of Aria's terms match, can only come
    // from the alias-table change, not from re-indexed content.
    const chapter = createTextResource({
      name: "Chapter One",
      plainText:
        "The Wanderer chatted with Bram, who once called her Nightshade too.",
    });
    await writeResourceToFile(projectRoot, chapter);

    await flushIndexer(3000);

    const beforeIndex = await loadMentionIndex(projectRoot);
    const beforeAriaRecord = beforeIndex[chapter.id]?.find(
      (r) => r.entityId === aria.id,
    );
    const beforeBramRecord = beforeIndex[chapter.id]?.find(
      (r) => r.entityId === bram.id,
    );
    // Only the OLD alias ("The Wanderer") is in Aria's alias table yet, so
    // that's the only term of hers that should have matched.
    expect(beforeAriaRecord).toBeDefined();
    expect(beforeAriaRecord!.count).toBe(1);
    expect(beforeBramRecord).toBeDefined();

    // Capture Bram's record by value so we can assert it is byte-for-byte
    // unchanged after the targeted rescan — proving the whole index was NOT
    // rebuilt.
    const bramRecordSnapshot = JSON.parse(JSON.stringify(beforeBramRecord));

    // Rename Aria's alias from "The Wanderer" to "Nightshade" — a change to
    // the entity's own metadata only; the resource's text above is untouched.
    await writeSidecar(projectRoot, aria.id, {
      name: "Aria",
      entityKind: "character",
      aliases: ["Nightshade"],
    });
    await flushIndexer(3000);

    const afterIndex = await loadMentionIndex(projectRoot);
    const afterAriaRecord = afterIndex[chapter.id]?.find(
      (r) => r.entityId === aria.id,
    );
    const afterBramRecord = afterIndex[chapter.id]?.find(
      (r) => r.entityId === bram.id,
    );

    // The mention previously attributed to the old alias is gone, and a new
    // one under the new alias appears instead — same single match count,
    // different (later) offset, since "Nightshade" occurs later in the text
    // than "The Wanderer" did.
    expect(afterAriaRecord).toBeDefined();
    expect(afterAriaRecord!.count).toBe(1);
    expect(afterAriaRecord!.offsets).not.toEqual(beforeAriaRecord!.offsets);

    // Bram's record for the same resource must be completely untouched by
    // the targeted rescan of Aria's entity.
    expect(afterBramRecord).toEqual(bramRecordSnapshot);
  });

  it("removes an entity's mention records project-wide once its old alias no longer matches anywhere and the new alias appears nowhere else", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-entity-rescan2-"),
    );

    const { writeResourceToFile } =
      await import("../../src/lib/models/resource");
    const { writeSidecar } = await import("../../src/lib/models/sidecar");
    const { loadMentionIndex } =
      await import("../../src/lib/models/mention-index");
    const { flushIndexer } = await import("../../src/lib/models/indexer-queue");

    const aria = createTextResource({ name: "Aria", plainText: "" });
    await writeResourceToFile(projectRoot, aria);
    await writeSidecar(projectRoot, aria.id, {
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    });

    const chapter = createTextResource({
      name: "Chapter One",
      plainText: "The Wanderer walked alone.",
    });
    await writeResourceToFile(projectRoot, chapter);
    await flushIndexer(3000);

    let index = await loadMentionIndex(projectRoot);
    expect(
      index[chapter.id]?.find((r) => r.entityId === aria.id),
    ).toBeDefined();

    // Rename the alias to something that does not occur anywhere in the
    // project's persisted text.
    await writeSidecar(projectRoot, aria.id, {
      name: "Aria",
      entityKind: "character",
      aliases: ["Nightshade"],
    });
    await flushIndexer(3000);

    index = await loadMentionIndex(projectRoot);
    // "The Wanderer" no longer matches and "Aria"/"Nightshade" don't occur
    // in the chapter text either, so the entity's record for this resource
    // must be dropped.
    expect(
      index[chapter.id]?.find((r) => r.entityId === aria.id),
    ).toBeUndefined();
  });
});
