// Integration test for the entity-scoped compile feature
// (specs/features/entity-scoped-compile.md), exercising three properties
// against one fixture project built with the in-memory storage adapter:
//
// - FR-2: the compiled resource set is exactly `getEntityMentionedIn`'s
//   merged output — no narrowing.
// - FR-3: the compiled order is the resource tree's depth-first,
//   orderIndex-sibling order, independent of the mention-index/backlink
//   maps' own iteration order (which the merge function's raw output does
//   reflect, and which this test deliberately permutes to prove the
//   ordering step does not trust it).
// - FR-8: none of `revisions/`, `meta/resource-*.meta.json`, or
//   `meta/index/mentions.json` is modified (content-hash unchanged) by
//   computing the FR-2 set, the FR-3 order, or running the wired compile
//   trigger through to (mocked) download.
//
// Note on FR-8's "mtime AND content hash" wording: the in-memory adapter
// (`memoryAdapter.ts`) used here does not track real file mtimes (its
// `stat()` only reports `isDirectory()`), so mtime invariance cannot be
// measured against it. What this test measures is content-hash invariance
// over every file under the three guarded paths, plus a full-path listing
// diff so a file being added or removed would also be caught.

import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { createHash } from "node:crypto";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import {
  setStorageAdapter,
  readdir,
  readFileBuffer,
  exists,
} from "../../src/lib/models/io";
import {
  createTextResource,
  createImageResource,
  createFolderResource,
} from "../../src/lib/models/resource-factory";
import { writeResourceToFile } from "../../src/lib/models/resource-persistence";
import { writeSidecar } from "../../src/lib/models/sidecar";
import { writeRevision } from "../../src/lib/models/revision";
import {
  persistMentionIndex,
  type MentionIndex,
} from "../../src/lib/models/mention-index";
import { persistBacklinks } from "../../src/lib/models/backlinks";
import { getEntityMentionedIn } from "../../src/lib/models/mentions-core";
import { orderResourceIdsByTreePosition } from "../../components/common/compileSelection";
import type { AnyResource } from "../../src/lib/models/types";
import { runCompileAndDownload } from "../../src/lib/compile/run-compile-and-download";
import type { CompileBody } from "../../src/lib/api/compile";

vi.mock("../../src/lib/api/compile", () => ({
  compilePdf: vi.fn(),
  compileDocx: vi.fn(),
  compileText: vi.fn(async () => ({
    text: "compiled output",
    filename: "compiled.txt",
  })),
  compileMarkdown: vi.fn(),
}));

const PROJECT_ROOT = "/projects/entity-scoped-compile-fixture";

/** Recursively collects every file path under `dir` (empty array if missing). */
async function listFilesRecursive(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(full)));
    } else {
      files.push(full);
    }
  }
  return files.sort();
}

/** Content-hash snapshot of every file under the FR-8 guarded paths. */
async function snapshotGuardedPaths(
  projectRoot: string,
): Promise<Record<string, string>> {
  const revisionsFiles = await listFilesRecursive(
    path.join(projectRoot, "revisions"),
  );
  const metaDir = path.join(projectRoot, "meta");
  const metaEntries = (await exists(metaDir))
    ? await readdir(metaDir, { withFileTypes: true })
    : [];
  const sidecarFiles = metaEntries
    .filter((e) => !e.isDirectory() && /^resource-.*\.meta\.json$/.test(e.name))
    .map((e) => path.join(metaDir, e.name));
  const mentionIndexPath = path.join(metaDir, "index", "mentions.json");
  const mentionIndexFiles = (await exists(mentionIndexPath))
    ? [mentionIndexPath]
    : [];

  const allFiles = [
    ...revisionsFiles,
    ...sidecarFiles,
    ...mentionIndexFiles,
  ].sort();

  const snapshot: Record<string, string> = {};
  for (const file of allFiles) {
    const buf = await readFileBuffer(file);
    snapshot[file] = createHash("sha256").update(buf).digest("hex");
  }
  return snapshot;
}

describe("entity-scoped compile — merged-set fidelity, ordering, and no-write guarantee", () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryAdapter());
  });

  it("compiles exactly the FR-2 merged set, in FR-3 tree order, regardless of merge-map insertion order, without writing to revisions/sidecars/mention index (FR-8)", async () => {
    // --- Variant 1: mentionIndex keyed [mentionOnly, both]; backlinks keyed [image, text, both]. ---
    const fixture1 = await buildFixtureAt(
      PROJECT_ROOT,
      "mentionThenBoth",
      "imageTextBoth",
    );

    const expectedTreeOrder = [
      fixture1.resourceBoth.id,
      fixture1.resourceMentionOnly.id,
      fixture1.resourceImageLinked.id,
      fixture1.resourceLinkOnly.id,
    ];

    const rows1 = await getEntityMentionedIn(PROJECT_ROOT, fixture1.entity.id);

    // FR-2: exact merged set, no narrowing — compare as a set of
    // {resourceId, isLinked, isMentioned}, independent of row array order.
    const actualFlags1 = new Map(
      rows1.map((r) => [
        r.resourceId,
        { isLinked: r.isLinked, isMentioned: r.isMentioned },
      ]),
    );
    expect(actualFlags1.size).toBe(4);
    expect(actualFlags1.get(fixture1.resourceBoth.id)).toEqual({
      isLinked: true,
      isMentioned: true,
    });
    expect(actualFlags1.get(fixture1.resourceMentionOnly.id)).toEqual({
      isLinked: false,
      isMentioned: true,
    });
    expect(actualFlags1.get(fixture1.resourceImageLinked.id)).toEqual({
      isLinked: true,
      isMentioned: false,
    });
    expect(actualFlags1.get(fixture1.resourceLinkOnly.id)).toEqual({
      isLinked: true,
      isMentioned: false,
    });

    // Sanity check that the merge function's own raw array order is NOT
    // already tree order (mentionThenBoth+imageTextBoth's raw processing
    // order is: mentioned records first [mentionOnly, both], then leftover
    // linked-only in backlink key order [image, text/link-only]) — this is
    // what makes the FR-3 assertion below non-vacuous: if the compile
    // wiring forwarded this raw order unchanged, it would NOT match
    // `expectedTreeOrder`.
    const rawOrder1 = rows1.map((r) => r.resourceId);
    expect(rawOrder1).not.toEqual(expectedTreeOrder);

    const mergedResourceIds1 = rows1.map((r) => r.resourceId);
    const orderedIds1 = orderResourceIdsByTreePosition(
      fixture1.allResources,
      mergedResourceIds1,
    );

    // FR-3: tree order, not merge order.
    expect(orderedIds1).toEqual(expectedTreeOrder);

    // FR-8 snapshot before/after computing the FR-2 set + FR-3 order, and
    // before/after running the wired compile trigger through to a (mocked)
    // download.
    const beforeSnapshot = await snapshotGuardedPaths(PROJECT_ROOT);

    // Re-run the exact read paths the wiring uses (mirroring
    // `EntityMentionsSection.tsx`'s effect + memoized derivations).
    await getEntityMentionedIn(PROJECT_ROOT, fixture1.entity.id);
    orderResourceIdsByTreePosition(fixture1.allResources, mergedResourceIds1);

    const compileBody: CompileBody = {
      projectId: PROJECT_ROOT,
      resourceIds: orderedIds1,
      resources: fixture1.allResources.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
      })),
      includeHeaders: true,
      projectName: "Entity Scoped Compile Fixture",
    };
    await runCompileAndDownload(compileBody, {
      format: "txt",
      compilationName: "aria-thread",
    });

    const afterSnapshot = await snapshotGuardedPaths(PROJECT_ROOT);
    expect(afterSnapshot).toEqual(beforeSnapshot);
    // Non-vacuous: there is at least one guarded file present to compare.
    expect(Object.keys(beforeSnapshot).length).toBeGreaterThan(0);

    // --- Variant 2: same logical fixture, opposite insertion order in both
    // the mention index and the backlink map (a fresh project root so the
    // two variants never share state). ---
    const PROJECT_ROOT_2 = `${PROJECT_ROOT}-variant2`;

    const fixture2 = await buildFixtureAt(
      PROJECT_ROOT_2,
      "bothThenMention",
      "bothTextImage",
    );

    const rows2 = await getEntityMentionedIn(
      PROJECT_ROOT_2,
      fixture2.entity.id,
    );
    const rawOrder2 = rows2.map((r) => r.resourceId);

    // The raw merge order differs between variant 1 and variant 2 (proving
    // the permutation actually changed iteration order)...
    expect(rawOrder2).not.toEqual(rawOrder1);

    const mergedResourceIds2 = rows2.map((r) => r.resourceId);
    const orderedIds2 = orderResourceIdsByTreePosition(
      fixture2.allResources,
      mergedResourceIds2,
    );

    const expectedTreeOrder2 = [
      fixture2.resourceBoth.id,
      fixture2.resourceMentionOnly.id,
      fixture2.resourceImageLinked.id,
      fixture2.resourceLinkOnly.id,
    ];

    // ...but the tree-derived compiled order is identical in shape
    // (same relative positions) regardless of that permutation — proving
    // FR-3's ordering is tree-derived, not merge-set-derived.
    expect(orderedIds2).toEqual(expectedTreeOrder2);
  });
});

/**
 * Builds the fixture project's resource tree, associated resources, and
 * persists a mention index + backlink map for the declared entity under
 * `projectRoot` — with the underlying maps' key insertion order controlled
 * by `mentionOrder` / `backlinkOrder`, so two invocations against different
 * project roots (see the test below) produce logically identical data with
 * permuted iteration order.
 *
 * Tree shape (depth-first, orderIndex-sibling order):
 *   root
 *     Chapters (orderIndex 0)
 *       resourceBoth   (orderIndex 0) — linked AND mentioned
 *       resourceMentionOnly (orderIndex 1) — mentioned only
 *     Locations (orderIndex 1)
 *       resourceImageLinked (orderIndex 0) — image, linked only
 *       resourceLinkOnly (orderIndex 1) — text, linked only
 *     Characters (orderIndex 2)
 *       entity (orderIndex 0) — the declared entity itself, not associated
 *
 * So the independently-known correct tree-position order of the associated
 * set is: [resourceBoth, resourceMentionOnly, resourceImageLinked,
 * resourceLinkOnly].
 */
async function buildFixtureAt(
  projectRoot: string,
  mentionOrder: "mentionThenBoth" | "bothThenMention",
  backlinkOrder: "imageTextBoth" | "bothTextImage",
): Promise<{
  entity: AnyResource;
  resourceBoth: AnyResource;
  resourceMentionOnly: AnyResource;
  resourceImageLinked: AnyResource;
  resourceLinkOnly: AnyResource;
  allResources: AnyResource[];
}> {
  const chapters = createFolderResource({ name: "Chapters", orderIndex: 0 });
  const locations = createFolderResource({ name: "Locations", orderIndex: 1 });
  const characters = createFolderResource({
    name: "Characters",
    orderIndex: 2,
  });
  await writeResourceToFile(projectRoot, chapters);
  await writeResourceToFile(projectRoot, locations);
  await writeResourceToFile(projectRoot, characters);

  const entity = createTextResource({
    name: "Aria",
    folderId: characters.id,
    orderIndex: 0,
    plainText: "",
  });
  await writeResourceToFile(projectRoot, entity);
  await writeSidecar(projectRoot, entity.id, {
    name: "Aria",
    entityKind: "character",
    aliases: [],
  });

  const resourceBoth = createTextResource({
    name: "Chapter One",
    folderId: chapters.id,
    orderIndex: 0,
    plainText: "Aria's blade gleamed in the moonlight.",
  });
  const resourceMentionOnly = createTextResource({
    name: "Chapter Two",
    folderId: chapters.id,
    orderIndex: 1,
    plainText: "Aria walked alone through the ruins.",
  });
  const resourceImageLinked = createImageResource({
    name: "Portrait Sketch",
    folderId: locations.id,
    orderIndex: 0,
    file: "portrait.png",
  });
  const resourceLinkOnly = createTextResource({
    name: "Location Notes",
    folderId: locations.id,
    orderIndex: 1,
    plainText: "Notes about the old keep, unrelated in prose.",
  });

  await writeResourceToFile(projectRoot, resourceBoth);
  await writeResourceToFile(projectRoot, resourceMentionOnly);
  await writeResourceToFile(projectRoot, resourceImageLinked);
  await writeResourceToFile(projectRoot, resourceLinkOnly);

  for (const r of [resourceBoth, resourceMentionOnly, resourceLinkOnly]) {
    await writeSidecar(projectRoot, r.id, { name: r.name });
  }

  // One real revision each for two resources, so the FR-8 no-write
  // assertion has actual persisted revision content to check, not just an
  // absent directory.
  await writeRevision(projectRoot, resourceBoth.id, 1, "Chapter One draft.", {
    isCanonical: true,
  });
  await writeRevision(
    projectRoot,
    resourceLinkOnly.id,
    1,
    "Location Notes draft.",
    { isCanonical: true },
  );

  const mentionRecordBoth = {
    entityId: entity.id,
    resourceId: resourceBoth.id,
    count: 1,
    offsets: [resourceBoth.plainText!.indexOf("Aria")],
  };
  const mentionRecordMentionOnly = {
    entityId: entity.id,
    resourceId: resourceMentionOnly.id,
    count: 1,
    offsets: [resourceMentionOnly.plainText!.indexOf("Aria")],
  };
  const mentionIndex: MentionIndex =
    mentionOrder === "mentionThenBoth"
      ? {
          [resourceMentionOnly.id]: [mentionRecordMentionOnly],
          [resourceBoth.id]: [mentionRecordBoth],
        }
      : {
          [resourceBoth.id]: [mentionRecordBoth],
          [resourceMentionOnly.id]: [mentionRecordMentionOnly],
        };
  await persistMentionIndex(projectRoot, mentionIndex);

  const backlinkIndex =
    backlinkOrder === "imageTextBoth"
      ? {
          [resourceImageLinked.id]: [entity.id],
          [resourceLinkOnly.id]: [entity.id],
          [resourceBoth.id]: [entity.id],
        }
      : {
          [resourceBoth.id]: [entity.id],
          [resourceLinkOnly.id]: [entity.id],
          [resourceImageLinked.id]: [entity.id],
        };
  await persistBacklinks(projectRoot, backlinkIndex);

  const allResources = [
    chapters,
    locations,
    characters,
    entity,
    resourceBoth,
    resourceMentionOnly,
    resourceImageLinked,
    resourceLinkOnly,
  ];

  return {
    entity,
    resourceBoth,
    resourceMentionOnly,
    resourceImageLinked,
    resourceLinkOnly,
    allResources,
  };
}
