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

describe("backlinks wiki-links and redirects", () => {
    beforeEach(() => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem as any);
    });

    it("resolves wiki-style links by sidecar name/slug", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-bk-"));

        const a = generateUUID();
        const b = generateUUID();

        // create sidecar on real FS for b with a name (and derived slug)
        await writeSidecar(projectRoot, b, {
            name: "Blue Sky",
            slug: "blue-sky",
        });

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
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "target" }],
                },
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
