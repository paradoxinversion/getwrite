import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import {
    setStorageAdapter,
    writeFile,
    mkdir,
} from "../../../src/lib/models/io";
import { persistResourceContent } from "../../../src/lib/tiptap-utils";
import { writeSidecar } from "../../../src/lib/models/sidecar";
import { computeBacklinks } from "../../../src/lib/models/backlinks";
import { generateUUID } from "../../../src/lib/models/uuid";

describe("backlinks wiki-link edge cases", () => {
    beforeEach(() => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem);
    });

    it("handles pipe-syntax and uses left side for resolution", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));
        const a = generateUUID();
        const b = generateUUID();

        await writeSidecar(projectRoot, b, {
            name: "Chapter One",
            slug: "chapter-one",
        });
        await persistResourceContent(projectRoot, b, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "target" }],
                },
            ],
        } as any);

        await persistResourceContent(projectRoot, a, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: `see [[Chapter One|ch1 alias]]` },
                    ],
                },
            ],
        } as any);

        const idx = await computeBacklinks(projectRoot);
        expect(idx[a]).toEqual([b]);
    });

    it("resolves aliases array from sidecar", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));
        const a = generateUUID();
        const b = generateUUID();

        await writeSidecar(projectRoot, b, {
            name: "My Target",
            slug: "my-target",
            aliases: ["MT", "target-alias"],
        });
        await persistResourceContent(projectRoot, b, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "target" }],
                },
            ],
        } as any);

        await persistResourceContent(projectRoot, a, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: `linking to [[MT]] and [[target-alias]]`,
                        },
                    ],
                },
            ],
        } as any);

        const idx = await computeBacklinks(projectRoot);
        // duplicates should be deduped by computeBacklinks set
        expect(idx[a].sort()).toEqual([b]);
    });

    it("slug fallback matches slugified title when sidecar slug absent", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));
        const a = generateUUID();
        const b = generateUUID();

        // sidecar has name but no slug; resolver slugifies name
        await writeSidecar(projectRoot, b, { name: "A Fancy Title" });
        await persistResourceContent(projectRoot, b, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "target" }],
                },
            ],
        } as any);

        await persistResourceContent(projectRoot, a, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: `see [[A Fancy Title]] and [[a-fancy-title]]`,
                        },
                    ],
                },
            ],
        } as any);

        const idx = await computeBacklinks(projectRoot);
        expect(idx[a]).toEqual([b]);
    });

    it("ignores unresolved wiki-links", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));
        const a = generateUUID();

        await persistResourceContent(projectRoot, a, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: `see [[Does Not Exist]]` }],
                },
            ],
        } as any);

        const idx = await computeBacklinks(projectRoot);
        expect(idx[a]).toEqual([]);
    });
});
