/**
 * Unit tests for `mentions-core.ts` (Task 10).
 *
 * Exercises `getResourceMentions` (FR-9) and `getEntityMentionedIn` (FR-10)
 * against a fixture mention index, real sidecars, and real resource content
 * files under a temp project root — following the real-fs-adapter pattern
 * established in `resource-detail-route.test.ts`.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { persistMentionIndex } from "../../src/lib/models/mention-index";
import { writeSidecar } from "../../src/lib/models/sidecar";
import {
  getResourceMentions,
  getEntityMentionedIn,
} from "../../src/lib/models/mentions-core";
import { removeDirRetry } from "./helpers/fs-utils";

const tmpDirs: string[] = [];

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) await removeDirRetry(dir);
  }
});

async function makeTmpProjectRoot(): Promise<string> {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "gw-mentions-core-"),
  );
  tmpDirs.push(projectRoot);
  return projectRoot;
}

async function writeResourceContent(
  projectRoot: string,
  resourceId: string,
  plainText: string,
): Promise<void> {
  const dir = path.join(projectRoot, "resources", resourceId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "content.txt"), plainText, "utf8");
}

describe("getResourceMentions (FR-9)", () => {
  it("returns every entity mentioned in a resource, with resolved names", async () => {
    const projectRoot = await makeTmpProjectRoot();
    const sceneId = "scene-1";
    const ariaId = "entity-aria";
    const jonesId = "entity-jones";

    await writeSidecar(projectRoot, ariaId, { id: ariaId, name: "Aria" });
    await writeSidecar(projectRoot, jonesId, { id: jonesId, name: "Jones" });

    await persistMentionIndex(projectRoot, {
      [sceneId]: [
        { entityId: ariaId, resourceId: sceneId, count: 1, offsets: [0] },
        { entityId: jonesId, resourceId: sceneId, count: 1, offsets: [20] },
      ],
    });

    const mentions = await getResourceMentions(projectRoot, sceneId);

    expect(mentions).toEqual(
      expect.arrayContaining([
        { entityId: ariaId, name: "Aria" },
        { entityId: jonesId, name: "Jones" },
      ]),
    );
    expect(mentions).toHaveLength(2);
  });

  it("returns an empty array for a resource with no mentions", async () => {
    const projectRoot = await makeTmpProjectRoot();
    const mentions = await getResourceMentions(projectRoot, "no-mentions");
    expect(mentions).toEqual([]);
  });

  it("falls back to the entity id when its sidecar is missing", async () => {
    const projectRoot = await makeTmpProjectRoot();
    const sceneId = "scene-2";
    const ghostId = "entity-ghost";

    await persistMentionIndex(projectRoot, {
      [sceneId]: [
        { entityId: ghostId, resourceId: sceneId, count: 1, offsets: [0] },
      ],
    });

    const mentions = await getResourceMentions(projectRoot, sceneId);
    expect(mentions).toEqual([{ entityId: ghostId, name: ghostId }]);
  });

  it("deduplicates multiple records naming the same entity", async () => {
    const projectRoot = await makeTmpProjectRoot();
    const sceneId = "scene-3";
    const ariaId = "entity-aria";
    await writeSidecar(projectRoot, ariaId, { id: ariaId, name: "Aria" });

    await persistMentionIndex(projectRoot, {
      [sceneId]: [
        { entityId: ariaId, resourceId: sceneId, count: 1, offsets: [0] },
        { entityId: ariaId, resourceId: sceneId, count: 1, offsets: [50] },
      ],
    });

    const mentions = await getResourceMentions(projectRoot, sceneId);
    expect(mentions).toEqual([{ entityId: ariaId, name: "Aria" }]);
  });
});

describe("getEntityMentionedIn (FR-10)", () => {
  it("returns every resource mentioning an entity, one snippet per occurrence", async () => {
    const projectRoot = await makeTmpProjectRoot();
    const ariaId = "entity-aria";
    const sceneOneId = "scene-1";
    const sceneTwoId = "scene-2";

    await writeSidecar(projectRoot, sceneOneId, {
      id: sceneOneId,
      name: "Chapter One",
    });
    await writeSidecar(projectRoot, sceneTwoId, {
      id: sceneTwoId,
      name: "Chapter Two",
    });

    const sceneOneText = "Aria drew her blade and stepped into the light.";
    const sceneTwoText = "Far away, Aria's letter finally arrived at the keep.";
    await writeResourceContent(projectRoot, sceneOneId, sceneOneText);
    await writeResourceContent(projectRoot, sceneTwoId, sceneTwoText);

    await persistMentionIndex(projectRoot, {
      [sceneOneId]: [
        { entityId: ariaId, resourceId: sceneOneId, count: 1, offsets: [0] },
      ],
      [sceneTwoId]: [
        { entityId: ariaId, resourceId: sceneTwoId, count: 1, offsets: [11] },
      ],
    });

    const mentionedIn = await getEntityMentionedIn(projectRoot, ariaId);

    expect(mentionedIn).toHaveLength(2);
    const byResource = new Map(mentionedIn.map((m) => [m.resourceId, m]));

    expect(byResource.get(sceneOneId)?.name).toBe("Chapter One");
    expect(byResource.get(sceneOneId)?.snippets).toHaveLength(1);
    expect(byResource.get(sceneOneId)?.snippets[0]).toContain(
      "Aria drew her blade",
    );

    expect(byResource.get(sceneTwoId)?.name).toBe("Chapter Two");
    expect(byResource.get(sceneTwoId)?.snippets).toHaveLength(1);
    expect(byResource.get(sceneTwoId)?.snippets[0]).toContain("Aria's letter");
  });

  it("returns one snippet per occurrence when an entity is mentioned multiple times in one resource", async () => {
    const projectRoot = await makeTmpProjectRoot();
    const ariaId = "entity-aria";
    const sceneId = "scene-multi";

    await writeSidecar(projectRoot, sceneId, { id: sceneId, name: "Scene" });
    const text = "Aria walked in. Later, Aria walked out.";
    await writeResourceContent(projectRoot, sceneId, text);

    const firstOffset = text.indexOf("Aria");
    const secondOffset = text.indexOf("Aria", firstOffset + 1);

    await persistMentionIndex(projectRoot, {
      [sceneId]: [
        {
          entityId: ariaId,
          resourceId: sceneId,
          count: 2,
          offsets: [firstOffset, secondOffset],
        },
      ],
    });

    const mentionedIn = await getEntityMentionedIn(projectRoot, ariaId);
    expect(mentionedIn).toHaveLength(1);
    expect(mentionedIn[0]?.snippets).toHaveLength(2);
    expect(mentionedIn[0]?.snippets[0]).toContain("Aria walked in");
    expect(mentionedIn[0]?.snippets[1]).toContain("Aria walked out");
  });

  it("returns an empty array for an entity with no mentions", async () => {
    const projectRoot = await makeTmpProjectRoot();
    const mentionedIn = await getEntityMentionedIn(
      projectRoot,
      "entity-unmentioned",
    );
    expect(mentionedIn).toEqual([]);
  });

  it("skips a mentioning resource whose content can no longer be loaded", async () => {
    const projectRoot = await makeTmpProjectRoot();
    const ariaId = "entity-aria";
    const deletedResourceId = "deleted-scene";

    // No sidecar and no content.txt written for deletedResourceId — it was
    // removed after indexing but before the mention index was rebuilt.
    await persistMentionIndex(projectRoot, {
      [deletedResourceId]: [
        {
          entityId: ariaId,
          resourceId: deletedResourceId,
          count: 1,
          offsets: [0],
        },
      ],
    });

    const mentionedIn = await getEntityMentionedIn(projectRoot, ariaId);
    expect(mentionedIn).toEqual([]);
  });
});
