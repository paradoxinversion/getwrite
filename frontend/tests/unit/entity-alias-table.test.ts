import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { setStorageAdapter, mkdir, writeFile } from "../../src/lib/models/io";
import { buildEntityAliasTable } from "../../src/lib/models/entity-alias-table";

async function makeProject(): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-eat-"));
  await mkdir(path.join(projectRoot, "resources"), { recursive: true });
  await mkdir(path.join(projectRoot, "meta"), { recursive: true });
  return projectRoot;
}

async function addResource(
  projectRoot: string,
  resourceId: string,
): Promise<void> {
  await mkdir(path.join(projectRoot, "resources", resourceId), {
    recursive: true,
  });
}

async function writeEntitySidecar(
  projectRoot: string,
  resourceId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const filePath = path.join(
    projectRoot,
    "meta",
    `resource-${resourceId}.meta.json`,
  );
  await writeFile(filePath, JSON.stringify(fields, null, 2), "utf8");
}

describe("buildEntityAliasTable (Task 3)", () => {
  beforeEach(() => {
    const mem = createMemoryAdapter();
    setStorageAdapter(mem);
  });

  it("includes a single entity with unique aliases and reports no ambiguity", async () => {
    const projectRoot = await makeProject();
    await addResource(projectRoot, "entity-aria");
    await writeEntitySidecar(projectRoot, "entity-aria", {
      name: "Aria",
      entityKind: "character",
      aliases: ["Ari", "The Wanderer"],
    });

    const table = await buildEntityAliasTable(projectRoot);

    expect(table.entities["entity-aria"]).toEqual({
      entityId: "entity-aria",
      entityKind: "character",
      name: "Aria",
      aliases: ["Ari", "The Wanderer"],
      terms: ["Aria", "Ari", "The Wanderer"],
    });

    // No term of this entity should appear as ambiguous (claimed by >1 entity).
    for (const term of table.entities["entity-aria"].terms) {
      const normalized = term.trim().toLowerCase();
      expect(table.claimedBy[normalized]).toBeUndefined();
    }
  });

  it("flags two entities that share one alias, listing both as claimants", async () => {
    const projectRoot = await makeProject();
    await addResource(projectRoot, "entity-aria");
    await writeEntitySidecar(projectRoot, "entity-aria", {
      name: "Aria",
      entityKind: "character",
      aliases: ["The Wanderer"],
    });

    await addResource(projectRoot, "entity-jones");
    await writeEntitySidecar(projectRoot, "entity-jones", {
      name: "Jones",
      entityKind: "character",
      // Shares a case-variant of "the wanderer" with entity-aria.
      aliases: ["The WANDERER"],
    });

    const table = await buildEntityAliasTable(projectRoot);

    expect(table.claimedBy["the wanderer"]).toBeDefined();
    expect(new Set(table.claimedBy["the wanderer"])).toEqual(
      new Set(["entity-aria", "entity-jones"]),
    );

    // Non-shared terms remain unambiguous.
    expect(table.claimedBy["aria"]).toBeUndefined();
    expect(table.claimedBy["jones"]).toBeUndefined();
  });

  it("includes an entity with no aliases, matching on name only", async () => {
    const projectRoot = await makeProject();
    await addResource(projectRoot, "entity-solo");
    await writeEntitySidecar(projectRoot, "entity-solo", {
      name: "Solo",
      entityKind: "character",
    });

    const table = await buildEntityAliasTable(projectRoot);

    expect(table.entities["entity-solo"]).toEqual({
      entityId: "entity-solo",
      entityKind: "character",
      name: "Solo",
      aliases: [],
      terms: ["Solo"],
    });
    expect(table.claimedBy["solo"]).toBeUndefined();
  });

  it("excludes resources without entityKind set", async () => {
    const projectRoot = await makeProject();
    await addResource(projectRoot, "plain-resource");
    await writeEntitySidecar(projectRoot, "plain-resource", {
      name: "Not An Entity",
    });

    const table = await buildEntityAliasTable(projectRoot);

    expect(table.entities["plain-resource"]).toBeUndefined();
    expect(Object.keys(table.entities)).toHaveLength(0);
    expect(Object.keys(table.claimedBy)).toHaveLength(0);
  });
});
