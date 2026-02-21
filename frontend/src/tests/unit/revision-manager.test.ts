import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../../src/lib/models/io";
import { generateUUID } from "../../../src/lib/models/uuid";
import {
    nextVersionNumber,
    createRevision,
} from "../../../src/lib/models/revision-manager";
import {
    listRevisions,
    getCanonicalRevision,
    revisionsBaseDir,
} from "../../../src/lib/models/revision";

describe("revision-manager", () => {
    beforeEach(() => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem);
    });

    it("nextVersionNumber starts at 1 and increments after writes", async () => {
        const projectRoot = "/proj-" + generateUUID();
        const resourceId = generateUUID();

        expect(await nextVersionNumber(projectRoot, resourceId)).toBe(1);

        await createRevision(projectRoot, resourceId, "first");
        expect(await nextVersionNumber(projectRoot, resourceId)).toBe(2);
    });

    it("creates revisions, sets canonical, and prunes to maxRevisions", async () => {
        const projectRoot = "/proj-" + generateUUID();
        const resourceId = generateUUID();

        await createRevision(projectRoot, resourceId, "one");
        await createRevision(projectRoot, resourceId, "two");
        await createRevision(projectRoot, resourceId, "three");
        // create canonical revision and request pruning to max 2
        await createRevision(projectRoot, resourceId, "four", {
            isCanonical: true,
            maxRevisions: 2,
        });

        const all = await listRevisions(projectRoot, resourceId);
        // should have at most 2 entries (v-3 and v-4)
        expect(all.length).toBe(2);
        const versions = all.map((r) => r.versionNumber);
        expect(versions).toEqual([3, 4]);

        const canonical = await getCanonicalRevision(projectRoot, resourceId);
        expect(canonical).not.toBeNull();
        expect(canonical!.versionNumber).toBe(4);
    });

    it("handles concurrent creates without version collisions", async () => {
        const projectRoot = "/proj-" + generateUUID();
        const resourceId = generateUUID();

        // Kick off two concurrent creates; locks should serialize them
        await Promise.all([
            createRevision(projectRoot, resourceId, "c1"),
            createRevision(projectRoot, resourceId, "c2"),
        ]);

        const all = await listRevisions(projectRoot, resourceId);
        const versions = all.map((r) => r.versionNumber).sort((a, b) => a - b);
        expect(versions).toEqual([1, 2]);
    });
});
