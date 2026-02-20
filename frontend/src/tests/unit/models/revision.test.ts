import { describe, it, expect } from "vitest";
import { selectPruneCandidates } from "../../../../src/lib/models/revision";

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

describe("models/revision.selectPruneCandidates", () => {
    it("returns empty when within limit", () => {
        const revs = [makeRev("a", 1, true), makeRev("b", 2), makeRev("c", 3)];
        expect(selectPruneCandidates(revs as any, 3)).toEqual([]);
    });

    it("selects oldest non-canonical when over limit", () => {
        const revs = [
            makeRev("a", 1, false),
            makeRev("b", 2, false),
            makeRev("c", 3, true),
        ];
        const candidates = selectPruneCandidates(revs as any, 2);
        // total 3 -> need to remove 1; oldest non-canonical is version 1
        expect(candidates.map((r) => r.versionNumber)).toEqual([1]);
    });

    it("never returns canonical revisions", () => {
        const revs = [
            makeRev("a", 1, true),
            makeRev("b", 2, true),
            makeRev("c", 3, false),
        ];
        const candidates = selectPruneCandidates(revs as any, 1);
        // Only non-canonical revision 3 is available; total 3 -> need remove 2,
        // but we only return non-canonical ones (just 3)
        expect(candidates.every((r) => !r.isCanonical)).toBe(true);
        expect(candidates.map((r) => r.versionNumber)).toEqual([3]);
    });

    it("returns multiple candidates in ascending order", () => {
        const revs = [
            makeRev("a", 1),
            makeRev("b", 2),
            makeRev("c", 3),
            makeRev("d", 4, true),
        ];
        const candidates = selectPruneCandidates(revs as any, 1);
        // total 4 -> need to remove 3; non-canonical are versions 1,2,3 -> return all three
        expect(candidates.map((r) => r.versionNumber)).toEqual([1, 2, 3]);
    });

    it("throws on negative maxRevisions", () => {
        expect(() => selectPruneCandidates([], -1)).toThrow();
    });
});
