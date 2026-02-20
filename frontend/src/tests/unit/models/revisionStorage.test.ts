import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    writeRevision,
    listRevisions,
    pruneRevisions,
    revisionsBaseDir,
} from "../../../../src/lib/models/revisionStorage";
import { generateUUID } from "../../../../src/lib/models/uuid";

describe("models/revisionStorage", () => {
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

        await fs.rm(tmp, { recursive: true, force: true });
    });
});
