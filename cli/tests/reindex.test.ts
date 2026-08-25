import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import registerReindex from "../src/commands/reindex";

describe("reindex command — registration", () => {
  it("registers reindex on the CLI program", () => {
    const program = new Command();
    registerReindex(program);
    const names = program.commands.map((c) => c.name());
    expect(names).toContain("reindex");
  });
});

describe("reindex command — functional", () => {
  let tmpDir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-reindex-"));
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("rebuilds inverted index from resources on disk", async () => {
    const resourceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const resourceDir = path.join(tmpDir, "resources", resourceId);
    await fs.mkdir(resourceDir, { recursive: true });
    await fs.writeFile(
      path.join(resourceDir, "content.txt"),
      "reindex hello world unique",
    );

    const program = new Command();
    registerReindex(program);
    process.env.GETWRITE_CLI_TESTING = "1";
    await program.parseAsync(["node", "test", "reindex", tmpDir]);
    delete process.env.GETWRITE_CLI_TESTING;

    const indexPath = path.join(tmpDir, "meta", "index", "inverted.json");
    const raw = await fs.readFile(indexPath, "utf8");
    const index = JSON.parse(raw) as Record<string, Record<string, number>>;

    expect(index["reindex"]).toBeDefined();
    expect(Object.keys(index["reindex"]!)).toContain(resourceId);
  });

  it("writes backlinks.json even when no wiki links exist", async () => {
    const resourceId = "11111111-2222-4333-8444-555555555555";
    const resourceDir = path.join(tmpDir, "resources", resourceId);
    await fs.mkdir(resourceDir, { recursive: true });
    await fs.writeFile(path.join(resourceDir, "content.txt"), "no links here");

    const program = new Command();
    registerReindex(program);
    process.env.GETWRITE_CLI_TESTING = "1";
    await program.parseAsync(["node", "test", "reindex", tmpDir]);
    delete process.env.GETWRITE_CLI_TESTING;

    const backlinksPath = path.join(tmpDir, "meta", "backlinks.json");
    const raw = await fs.readFile(backlinksPath, "utf8");
    const backlinks = JSON.parse(raw) as Record<string, unknown>;
    expect(backlinks).toBeDefined();
  });

  it("exits cleanly when no resources exist", async () => {
    const program = new Command();
    registerReindex(program);
    process.env.GETWRITE_CLI_TESTING = "1";
    await expect(
      program.parseAsync(["node", "test", "reindex", tmpDir]),
    ).resolves.not.toThrow();
    delete process.env.GETWRITE_CLI_TESTING;
  });

  it("rebuilds meta/index/mentions.json from a declared entity and a mentioning resource", async () => {
    const entityId = "22222222-3333-4444-8555-666666666666";
    const entityDir = path.join(tmpDir, "resources", entityId);
    await fs.mkdir(entityDir, { recursive: true });
    await fs.writeFile(path.join(entityDir, "content.txt"), "");

    const metaDir = path.join(tmpDir, "meta");
    await fs.mkdir(metaDir, { recursive: true });
    await fs.writeFile(
      path.join(metaDir, `resource-${entityId}.meta.json`),
      JSON.stringify({
        name: "Aria",
        entityKind: "character",
        aliases: ["Aria Vale"],
      }),
    );

    const mentioningId = "33333333-4444-4555-8666-777777777777";
    const mentioningDir = path.join(tmpDir, "resources", mentioningId);
    await fs.mkdir(mentioningDir, { recursive: true });
    await fs.writeFile(
      path.join(mentioningDir, "content.txt"),
      "Aria walked into the room. Aria Vale smiled.",
    );

    const program = new Command();
    registerReindex(program);
    process.env.GETWRITE_CLI_TESTING = "1";
    await program.parseAsync(["node", "test", "reindex", tmpDir]);
    delete process.env.GETWRITE_CLI_TESTING;

    const mentionsPath = path.join(tmpDir, "meta", "index", "mentions.json");
    const raw = await fs.readFile(mentionsPath, "utf8");
    const mentions = JSON.parse(raw) as Record<
      string,
      Array<{
        entityId: string;
        resourceId: string;
        count: number;
        offsets: number[];
      }>
    >;

    expect(mentions[mentioningId]).toBeDefined();
    expect(mentions[mentioningId]).toHaveLength(1);
    const record = mentions[mentioningId]![0]!;
    expect(record.entityId).toBe(entityId);
    expect(record.resourceId).toBe(mentioningId);
    // "Aria" matches twice (offset 0 and the "Aria" inside "Aria Vale" at
    // offset 27); the alias "Aria Vale" also matches at offset 27. Mirroring
    // indexer-queue.ts's aggregation, offsets are combined across every term
    // of the entity without deduplication, so the same span can appear twice.
    expect(record.count).toBe(3);
    expect(record.offsets).toEqual([0, 27, 27]);
    // The entity resource itself has empty content, so it should not
    // appear as a key in the from-scratch rebuild.
    expect(mentions[entityId]).toBeUndefined();
  });
});
