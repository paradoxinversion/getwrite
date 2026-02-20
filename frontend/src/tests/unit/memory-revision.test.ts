import { describe, it, expect } from "vitest";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../../src/lib/models/io";
import {
    writeRevision,
    listRevisions,
    pruneRevisions,
    revisionsBaseDir,
} from "../../../src/lib/models/revision";
import { generateUUID } from "../../../src/lib/models/uuid";

describe("memory-backed revision storage", () => {
    it("writes and prunes revisions in-memory", async () => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem as any);

        const projectRoot = "/proj-" + generateUUID();
        const resourceId = generateUUID();

        await writeRevision(projectRoot, resourceId, 1, "one");
        await writeRevision(projectRoot, resourceId, 2, "two");
        await writeRevision(projectRoot, resourceId, 3, "three");
        await writeRevision(projectRoot, resourceId, 4, "four", {
            isCanonical: true,
        });

        const all = await listRevisions(projectRoot, resourceId);
        expect(all.length).toBe(4);

        const deleted = await pruneRevisions(projectRoot, resourceId, 2);
        expect(deleted.map((d) => d.versionNumber)).toEqual([1, 2]);

        const base = revisionsBaseDir(projectRoot, resourceId);
        // readdir via adapter: expect v-3 and v-4 remain
        const entries = await (mem as any).readdir(base, {
            withFileTypes: true,
        });
        const names = entries.map((e: any) => e.name);
        expect(names).toContain("v-3");
        expect(names).toContain("v-4");
    });
});
