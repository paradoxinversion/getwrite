import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    writeRevision,
    listRevisions,
    pruneRevisions,
    revisionsBaseDir,
} from "../../../src/lib/models/revision";
import { generateUUID } from "../../../src/lib/models/uuid";
import { removeDirRetry } from "./helpers/fs-utils";

describe("models/revision", () => {
    it("writes revisions and prunes oldest non-canonical", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-rev-"));
        const resourceId = generateUUID();

        // write 4 revisions, mark v4 as canonical
        await writeRevision(tmp, resourceId, 1, "one");
        await writeRevision(tmp, resourceId, 2, "two");
        await writeRevision(tmp, resourceId, 3, "three");
        await writeRevision(tmp, resourceId, 4, "four", { isCanonical: true });

        const all = await listRevisions(tmp, resourceId);
        expect(all.length).toBe(4);

        // prune to max 2 -> should remove two oldest non-canonical (1 and 2)
        const deleted = await pruneRevisions(tmp, resourceId, 2);
        expect(deleted.map((d) => d.versionNumber)).toEqual([1, 2]);

        // verify directories removed
        const base = revisionsBaseDir(tmp, resourceId);
        const remaining = await fs.readdir(base);
        expect(remaining).toContain("v-3");
        expect(remaining).toContain("v-4");

        await removeDirRetry(tmp);
    });
});

import { describe as d2, it as it2, expect as expect2 } from "vitest";
import { selectPruneCandidates } from "../../../src/lib/models/revision";

function makeRev(
    id: string,
    ver: number,
    canonical = false,
    createdAt?: string,
) {
    return {
        id,
        resourceId: "resource-id",
        versionNumber: ver,
        createdAt: createdAt ?? new Date(2020, 0, ver).toISOString(),
        filePath: `/path/${id}.txt`,
        isCanonical: canonical,
    } as const;
}

d2("models/revision.selectPruneCandidates", () => {
    it2("returns empty when within limit", () => {
        const revs = [makeRev("a", 1, true), makeRev("b", 2), makeRev("c", 3)];
        expect2(selectPruneCandidates(revs as any, 3)).toEqual([]);
    });

    it2("selects oldest non-canonical when over limit", () => {
        const revs = [
            makeRev("a", 1, false),
            makeRev("b", 2, false),
            makeRev("c", 3, true),
        ];
        const candidates = selectPruneCandidates(revs as any, 2);
        // total 3 -> need to remove 1; oldest non-canonical is version 1
        expect2(candidates.map((r) => r.versionNumber)).toEqual([1]);
    });

    it2("never returns canonical revisions", () => {
        const revs = [
            makeRev("a", 1, true),
            makeRev("b", 2, true),
            makeRev("c", 3, false),
        ];
        const candidates = selectPruneCandidates(revs as any, 1);
        // Only non-canonical revision 3 is available; total 3 -> need remove 2,
        // but we only return non-canonical ones (just 3)
        expect2(candidates.every((r) => !r.isCanonical)).toBe(true);
        expect2(candidates.map((r) => r.versionNumber)).toEqual([3]);
    });

    it2("returns multiple candidates in ascending order", () => {
        const revs = [
            makeRev("a", 1),
            makeRev("b", 2),
            makeRev("c", 3),
            makeRev("d", 4, true),
        ];
        const candidates = selectPruneCandidates(revs as any, 1);
        // total 4 -> need to remove 3; non-canonical are versions 1,2,3 -> return all three
        expect2(candidates.map((r) => r.versionNumber)).toEqual([1, 2, 3]);
    });

    it2("throws on negative maxRevisions", () => {
        expect2(() => selectPruneCandidates([], -1)).toThrow();
    });
});
