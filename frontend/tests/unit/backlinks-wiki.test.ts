import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { setStorageAdapter, writeFile, mkdir } from "../../src/lib/models/io";
import { persistResourceContent } from "../../src/lib/tiptap-utils";
import { waitForDrain } from "../../src/lib/models/indexer-queue";
import { writeSidecar } from "../../src/lib/models/sidecar";
import { computeBacklinks } from "../../src/lib/models/backlinks";
import { generateUUID } from "../../src/lib/models/uuid";
import type { TipTapDocument } from "../../src/lib/models/types";

const emptyDoc = (): TipTapDocument => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
});

describe("backlinks wiki-links and redirects", () => {
  beforeEach(() => {
    const mem = createMemoryAdapter();
    setStorageAdapter(mem);
  });

  afterEach(async () => {
    await waitForDrain(2000);
  });

  it("resolves wiki-style links by sidecar name/slug", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));

    const a = generateUUID();
    const b = generateUUID();

    // create sidecar on real FS for b with a name (and derived slug)
    await writeSidecar(projectRoot, b, { name: "Blue Sky", slug: "blue-sky" });

    // persist content (uses storage adapter / memory)
    await persistResourceContent(projectRoot, a, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: `see [[Blue Sky]] here` }],
        },
      ],
    } as any);

    await persistResourceContent(projectRoot, b, {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "target" }] },
      ],
    } as any);

    const idx = await computeBacklinks(projectRoot);
    expect(idx[a]).toEqual([b]);
  });

  it("follows redirects defined in meta/redirects.json (case-insensitive)", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));

    const src = generateUUID();
    const target = generateUUID();

    // write sidecar for the target so resolver can inspect name if needed
    await writeSidecar(projectRoot, target, {
      name: "Final Target",
      slug: "final-target",
    });

    // ensure meta dir exists in adapter and write redirects mapping (memory adapter)
    await mkdir(path.join(projectRoot, "meta"), { recursive: true });
    const redirects = { "old-name": target };
    await writeFile(
      path.join(projectRoot, "meta", "redirects.json"),
      JSON.stringify(redirects),
      "utf8",
    );

    // source uses old name in wiki link (different case)
    await persistResourceContent(projectRoot, src, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: `see [[Old-Name]]` }],
        },
      ],
    } as any);

    const idx = await computeBacklinks(projectRoot);
    expect(idx[src]).toEqual([target]);
  });
});

describe("backlinks — sidecar resource-ref extraction", () => {
  beforeEach(() => {
    const mem = createMemoryAdapter();
    setStorageAdapter(mem);
  });

  afterEach(async () => {
    await waitForDrain(2000);
  });

  it("extracts a backlink from a single resource-ref sidecar field", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-bk-sidecar-"),
    );
    const source = generateUUID();
    const target = generateUUID();

    await persistResourceContent(projectRoot, source, emptyDoc() as any);
    await persistResourceContent(projectRoot, target, emptyDoc() as any);

    await writeSidecar(projectRoot, source, {
      pov: { id: target, name: "Target Character" },
    });

    const idx = await computeBacklinks(projectRoot);
    expect(idx[source]).toContain(target);
    expect(idx[target]).not.toContain(source);
  });

  it("extracts backlinks from a multi-resource-ref sidecar field", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-bk-sidecar-"),
    );
    const source = generateUUID();
    const t1 = generateUUID();
    const t2 = generateUUID();

    await persistResourceContent(projectRoot, source, emptyDoc() as any);
    await persistResourceContent(projectRoot, t1, emptyDoc() as any);
    await persistResourceContent(projectRoot, t2, emptyDoc() as any);

    await writeSidecar(projectRoot, source, {
      characters: [
        { id: t1, name: "Alice" },
        { id: t2, name: "Bob" },
      ],
    });

    const idx = await computeBacklinks(projectRoot);
    expect(idx[source]).toContain(t1);
    expect(idx[source]).toContain(t2);
  });

  it("skips resource-ref entries with a null id (deleted target)", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-bk-sidecar-"),
    );
    const source = generateUUID();

    await persistResourceContent(projectRoot, source, emptyDoc() as any);

    await writeSidecar(projectRoot, source, {
      pov: { id: null, name: "Deleted Character" },
    });

    const idx = await computeBacklinks(projectRoot);
    expect(idx[source]).toEqual([]);
  });

  it("excludes self-references from sidecar refs", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-bk-sidecar-"),
    );
    const source = generateUUID();

    await persistResourceContent(projectRoot, source, emptyDoc() as any);

    await writeSidecar(projectRoot, source, {
      self: { id: source, name: "Itself" },
    });

    const idx = await computeBacklinks(projectRoot);
    expect(idx[source]).toEqual([]);
  });

  it("combines sidecar refs with prose refs without duplicates", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-bk-sidecar-"),
    );
    const source = generateUUID();
    const target = generateUUID();

    await persistResourceContent(projectRoot, source, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: `ref ${target}` }],
        },
      ],
    } as any);
    await persistResourceContent(projectRoot, target, emptyDoc() as any);

    await writeSidecar(projectRoot, source, {
      pov: { id: target, name: "Same Target" },
    });

    const idx = await computeBacklinks(projectRoot);
    expect(idx[source].filter((id) => id === target)).toHaveLength(1);
  });

  it("extracts a backlink from a resource-ref nested under userMetadata", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-bk-sidecar-"),
    );
    const source = generateUUID();
    const target = generateUUID();

    await persistResourceContent(projectRoot, source, emptyDoc() as any);
    await persistResourceContent(projectRoot, target, emptyDoc() as any);

    await writeSidecar(projectRoot, source, {
      userMetadata: { pov: { id: target, name: "Target Character" } },
    });

    const idx = await computeBacklinks(projectRoot);
    expect(idx[source]).toContain(target);
  });

  it("extracts backlinks from a multi-resource-ref array nested under userMetadata", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-bk-sidecar-"),
    );
    const source = generateUUID();
    const t1 = generateUUID();
    const t2 = generateUUID();

    await persistResourceContent(projectRoot, source, emptyDoc() as any);
    await persistResourceContent(projectRoot, t1, emptyDoc() as any);
    await persistResourceContent(projectRoot, t2, emptyDoc() as any);

    await writeSidecar(projectRoot, source, {
      userMetadata: {
        characters: [
          { id: t1, name: "Alice" },
          { id: t2, name: "Bob" },
        ],
      },
    });

    const idx = await computeBacklinks(projectRoot);
    expect(idx[source]).toContain(t1);
    expect(idx[source]).toContain(t2);
  });

  it("does not treat plain string/number sidecar values as refs", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-bk-sidecar-"),
    );
    const source = generateUUID();

    await persistResourceContent(projectRoot, source, emptyDoc() as any);

    await writeSidecar(projectRoot, source, {
      title: "My Scene",
      wordCount: 500,
      tags: ["action", "drama"],
    });

    const idx = await computeBacklinks(projectRoot);
    expect(idx[source]).toEqual([]);
  });
});
