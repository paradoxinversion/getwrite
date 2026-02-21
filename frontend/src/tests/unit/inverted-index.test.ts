import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../../src/lib/models/io";
import { createTextResource } from "../../../src/lib/models/resource";
import {
    indexResource,
    search,
    removeResourceFromIndex,
} from "../../../src/lib/models/inverted-index";

describe("inverted index (T025)", () => {
    beforeEach(() => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem);
    });

    it("indexes resources and returns results by term frequency", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-idx-"));

        const a = createTextResource({
            name: "A",
            plainText: "apple banana apple",
        });
        const b = createTextResource({ name: "B", plainText: "banana cherry" });
        const c = createTextResource({
            name: "C",
            plainText: "apple cherry apple apple",
        });

        await indexResource(projectRoot, a);
        await indexResource(projectRoot, b);
        await indexResource(projectRoot, c);

        const r1 = await search(projectRoot, "apple");
        // c has 3 apples, a has 2 apples
        expect(r1).toEqual([c.id, a.id]);

        const r2 = await search(projectRoot, "banana");
        expect(r2.sort()).toEqual([a.id, b.id].sort());

        const r3 = await search(projectRoot, "apple banana");
        // scores: c=3, a=3 (2 apple +1 banana) -> c then a
        expect(r3[0]).toBe(c.id);
        expect(r3[1]).toBe(a.id);
    });

    it("removes resources from index", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-idx-"));
        const a = createTextResource({ name: "A", plainText: "apple banana" });

        await indexResource(projectRoot, a);
        let r = await search(projectRoot, "apple");
        expect(r).toEqual([a.id]);

        await removeResourceFromIndex(projectRoot, a.id);
        r = await search(projectRoot, "apple");
        expect(r).toEqual([]);
    });
});
