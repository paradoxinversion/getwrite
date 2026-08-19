import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { setStorageAdapter, readFile } from "../../src/lib/models/io";
import { generateUUID } from "../../src/lib/models/uuid";
import {
  createRevision,
  updateRevisionInPlace,
} from "../../src/lib/models/revision-core";
import { readSidecar, writeSidecar } from "../../src/lib/models/sidecar";
import { countWords } from "../../src/lib/word-count";

/**
 * A resource's `wordCount` lives in its sidecar and is what list views use to
 * decide whether a resource is a "stub" ("Needs content" — zero words, per the
 * Glossary). Autosave persists through `updateRevisionInPlace`, which used to
 * rewrite the sidecar with only `updatedAt` refreshed — leaving `wordCount` at
 * its creation-time value of 0 forever. The result: a resource with real
 * content permanently misfiled as empty.
 */
function doc(text: string) {
  return {
    type: "doc" as const,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

describe("updateRevisionInPlace keeps the sidecar's wordCount in sync", () => {
  let projectRoot: string;
  let resourceId: string;

  beforeEach(async () => {
    setStorageAdapter(createMemoryAdapter());
    projectRoot = "/proj-" + generateUUID();
    resourceId = generateUUID();
    // A freshly created resource starts at zero words, which is the stale
    // value the bug left behind.
    await writeSidecar(projectRoot, resourceId, {
      id: resourceId,
      name: "Chapter One",
      type: "text",
      wordCount: 0,
    });
  });

  async function canonicalRevisionId(): Promise<string> {
    const revision = await createRevision(projectRoot, resourceId, {
      content: JSON.stringify({ type: "doc", content: [] }),
      isCanonical: true,
    });
    return revision.id;
  }

  it("recomputes wordCount from the content actually saved", async () => {
    const revisionId = await canonicalRevisionId();
    const content = doc("one two three four five");

    await updateRevisionInPlace(
      projectRoot,
      resourceId,
      revisionId,
      JSON.stringify(content),
    );

    const sidecar = await readSidecar(projectRoot, resourceId);
    expect(sidecar?.wordCount).toBe(5);

    // The persisted count must match the content on disk, not merely be
    // non-zero — that is the invariant the stub classification depends on.
    const plain = await readFile(
      `${projectRoot}/resources/${resourceId}/content.txt`,
      "utf8",
    );
    expect(sidecar?.wordCount).toBe(countWords(plain));
  });

  it("drops the count back to zero when content is emptied", async () => {
    const revisionId = await canonicalRevisionId();
    await updateRevisionInPlace(
      projectRoot,
      resourceId,
      revisionId,
      JSON.stringify(doc("something written")),
    );
    await updateRevisionInPlace(
      projectRoot,
      resourceId,
      revisionId,
      JSON.stringify({ type: "doc", content: [] }),
    );

    const sidecar = await readSidecar(projectRoot, resourceId);
    expect(sidecar?.wordCount).toBe(0);
  });

  it("leaves an existing wordCount untouched for non-TipTap content", async () => {
    // A legacy plain-text revision syncs no derived content files, so there is
    // no saved plain text to count — the stored value must not be clobbered
    // with a wrong one.
    await writeSidecar(projectRoot, resourceId, {
      id: resourceId,
      name: "Chapter One",
      type: "text",
      wordCount: 7,
    });
    const revisionId = await canonicalRevisionId();

    await updateRevisionInPlace(
      projectRoot,
      resourceId,
      revisionId,
      "just a plain string, not a TipTap document",
    );

    const sidecar = await readSidecar(projectRoot, resourceId);
    expect(sidecar?.wordCount).toBe(7);
  });

  it("still bumps updatedAt", async () => {
    const revisionId = await canonicalRevisionId();
    const result = await updateRevisionInPlace(
      projectRoot,
      resourceId,
      revisionId,
      JSON.stringify(doc("hello world")),
    );

    const sidecar = await readSidecar(projectRoot, resourceId);
    expect(sidecar?.updatedAt).toBe(result.updatedAt);
  });
});
