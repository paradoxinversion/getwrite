import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../../src/lib/models/io";
import { persistResourceContent } from "../../../src/lib/tiptap-utils";
import {
    computeBacklinks,
    persistBacklinks,
    loadBacklinks,
} from "../../../src/lib/models/backlinks";
import { generateUUID } from "../../../src/lib/models/uuid";

describe("backlinks (T024)", () => {
    beforeEach(() => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem as any);
    });

    it("discovers backlinks between resources and persists index", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));

        const r1 = generateUUID();
        const r2 = generateUUID();
        const r3 = generateUUID();

        // r1 references r2 and r3
        await persistResourceContent(projectRoot, r1, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: `links: ${r2} and ${r3}` }],
                },
            ],
        } as any);

        // r2 references none
        await persistResourceContent(projectRoot, r2, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "no refs" }],
                },
            ],
        } as any);

        // r3 references r2
        await persistResourceContent(projectRoot, r3, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: `see ${r2}` }],
                },
            ],
        } as any);

        const idx = await computeBacklinks(projectRoot);
        expect(idx[r1].sort()).toEqual([r2, r3].sort());
        expect(idx[r2]).toEqual([]);
        expect(idx[r3]).toEqual([r2]);

        await persistBacklinks(projectRoot, idx);
        const loaded = await loadBacklinks(projectRoot);
        expect(loaded[r1].sort()).toEqual([r2, r3].sort());
    });

    it("updates backlinks after edits", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));
        const a = generateUUID();
        const b = generateUUID();

        await persistResourceContent(projectRoot, a, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: `ref ${b}` }],
                },
            ],
        } as any);

        let idx = await computeBacklinks(projectRoot);
        expect(idx[a]).toEqual([b]);

        // edit a to remove reference
        await persistResourceContent(projectRoot, a, {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: `no refs now` }],
                },
            ],
        } as any);

        idx = await computeBacklinks(projectRoot);
        expect(idx[a]).toEqual([]);
    });
});
