import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../../src/lib/models/io";
import { generateUUID } from "../../../src/lib/models/uuid";
import {
    writeRevision,
    listRevisions,
    pruneRevisions,
    getCanonicalRevision,
    selectPruneCandidates,
} from "../../../src/lib/models/revision";

describe("revision invariants (T014)", () => {
    beforeEach(() => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem as any);
    });

    it("ensures a canonical revision can be observed", async () => {
        const projectRoot = "/proj-" + generateUUID();
        const resourceId = generateUUID();

        await writeRevision(projectRoot, resourceId, 1, "one");
        await writeRevision(projectRoot, resourceId, 2, "two", {
            isCanonical: true,
        });
        await writeRevision(projectRoot, resourceId, 3, "three");

        const canonical = await getCanonicalRevision(projectRoot, resourceId);
        expect(canonical).not.toBeNull();
        expect(canonical!.versionNumber).toBe(2);
    });

    it("prune does not delete the canonical revision", async () => {
        const projectRoot = "/proj-" + generateUUID();
        const resourceId = generateUUID();

        // create 4 revisions, mark v4 canonical
        await writeRevision(projectRoot, resourceId, 1, "one");
        await writeRevision(projectRoot, resourceId, 2, "two");
        await writeRevision(projectRoot, resourceId, 3, "three");
        await writeRevision(projectRoot, resourceId, 4, "four", {
            isCanonical: true,
        });

        // prune to max 1 -> should attempt to remove 3; canonical v4 must remain
        const deleted = await pruneRevisions(projectRoot, resourceId, 1);
        const deletedVersions = deleted.map((d) => d.versionNumber);
        expect(deletedVersions).not.toContain(4);

        const remaining = await listRevisions(projectRoot, resourceId);
        const remainingVersions = remaining.map((r) => r.versionNumber);
        expect(remainingVersions).toContain(4);
    });

    it("signals when pruning cannot reach target because canonical must be preserved (prompt simulation)", () => {
        // Build a small revisions set where canonical prevents removing enough items
        const revs = [
            { versionNumber: 1, isCanonical: true },
            { versionNumber: 2, isCanonical: false },
        ] as any;

        const maxRevisions = 0; // requires removing 2 items (total 2 -> remove 2)
        const candidates = selectPruneCandidates(revs, maxRevisions);
        const toRemoveCount = revs.length - maxRevisions;

        // Because one revision is canonical, candidates length will be < toRemoveCount
        expect(candidates.length).toBeLessThan(toRemoveCount);
    });
});
