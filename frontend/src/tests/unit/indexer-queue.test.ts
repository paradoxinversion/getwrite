import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../../src/lib/models/io";
import { createTextResource } from "../../../src/lib/models/resource";
import { createRevision } from "../../../src/lib/models/revision-manager";
import { search } from "../../../src/lib/models/inverted-index";

async function waitForIndex(
    projectRoot: string,
    query: string,
    timeout = 2000,
) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const res = await search(projectRoot, query);
        if (res.length > 0) return res;
        // small sleep
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
    }
    return [] as string[];
}

describe("indexer queue integration", () => {
    beforeEach(() => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem);
    });

    it("indexes resource after createRevision (async)", async () => {
        const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gw-idx-"));

        const res = createTextResource({
            name: "R1",
            plainText: "async indexing test",
        });

        // create a revision for the resource; createRevision should enqueue indexing
        await createRevision(projectRoot, res.id, res.plainText ?? "");

        const found = await waitForIndex(projectRoot, "async");
        expect(found.includes(res.id)).toBe(true);
    });
});
