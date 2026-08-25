// Integration test: exercises the real save-through-persistence path for
// entity mention detection — enqueueIndex/flushIndexer driving the actual
// indexer-queue task (alias table -> detection -> mention index persist),
// not a hand-rolled call to findMentionOffsets/buildEntityAliasTable.

import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../src/lib/models/io";
import { createTextResource } from "../../src/lib/models/resource";
import { writeResourceToFile } from "../../src/lib/models/resource-persistence";
import { writeSidecar } from "../../src/lib/models/sidecar";
import { loadMentionIndex } from "../../src/lib/models/mention-index";
import { enqueueIndex, flushIndexer } from "../../src/lib/models/indexer-queue";

const PROJECT_ROOT = "/projects/entity-mention-fixture";

describe("entity mention detection — save-through-persistence integration", () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryAdapter());
  });

  it("persists a mention index entry attributing a possessive alias reference to the declared entity", async () => {
    // Entity resource: a character named "Aria" with a declared alias.
    const entity = createTextResource({ name: "Aria", plainText: "" });
    await writeResourceToFile(PROJECT_ROOT, entity);
    await writeSidecar(PROJECT_ROOT, entity.id, {
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    });

    // Prose resource that references the entity's name in possessive form.
    const proseText = "Aria's blade gleamed in the moonlight.";
    const prose = createTextResource({
      name: "Chapter One",
      plainText: proseText,
    });
    await writeResourceToFile(PROJECT_ROOT, prose);

    // Drive the real save path: enqueue + flush, not the unit-level pieces.
    await enqueueIndex(PROJECT_ROOT, prose.id);
    await flushIndexer(2000);

    const mentionIndex = await loadMentionIndex(PROJECT_ROOT);
    const records = mentionIndex[prose.id];
    expect(records).toBeDefined();

    const record = records!.find((r) => r.entityId === entity.id);
    expect(record).toBeDefined();
    expect(record!.count).toBe(1);

    // The possessive match ("Aria's") must start where "Aria" starts in the
    // saved plain text — verify against the real offset, not just a count.
    const expectedOffset = proseText.indexOf("Aria");
    expect(expectedOffset).toBeGreaterThanOrEqual(0);
    expect(record!.offsets).toEqual([expectedOffset]);
  });

  it("produces no mention entry for a resource that names no declared entity", async () => {
    const entity = createTextResource({ name: "Aria", plainText: "" });
    await writeResourceToFile(PROJECT_ROOT, entity);
    await writeSidecar(PROJECT_ROOT, entity.id, {
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    });

    const unrelated = createTextResource({
      name: "Chapter Two",
      plainText: "The city slept under a quiet, unremarkable sky.",
    });
    await writeResourceToFile(PROJECT_ROOT, unrelated);

    await enqueueIndex(PROJECT_ROOT, unrelated.id);
    await flushIndexer(2000);

    const mentionIndex = await loadMentionIndex(PROJECT_ROOT);
    expect(mentionIndex[unrelated.id]).toBeUndefined();
  });

  it("clears a stale mention entry after the alias is removed from the content and re-saved", async () => {
    const entity = createTextResource({ name: "Aria", plainText: "" });
    await writeResourceToFile(PROJECT_ROOT, entity);
    await writeSidecar(PROJECT_ROOT, entity.id, {
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    });

    const prose = createTextResource({
      name: "Chapter Three",
      plainText: "Aria's blade gleamed in the moonlight.",
    });
    await writeResourceToFile(PROJECT_ROOT, prose);

    await enqueueIndex(PROJECT_ROOT, prose.id);
    await flushIndexer(2000);

    let mentionIndex = await loadMentionIndex(PROJECT_ROOT);
    expect(mentionIndex[prose.id]).toBeDefined();
    expect(mentionIndex[prose.id]!.some((r) => r.entityId === entity.id)).toBe(
      true,
    );

    // Re-save the same resource with the alias removed from its content.
    const revised = { ...prose, plainText: "Nothing to see here at all." };
    await writeResourceToFile(PROJECT_ROOT, revised);

    await enqueueIndex(PROJECT_ROOT, prose.id);
    await flushIndexer(2000);

    mentionIndex = await loadMentionIndex(PROJECT_ROOT);
    expect(mentionIndex[prose.id]).toBeUndefined();
  });
});
