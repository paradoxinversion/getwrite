import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect } from "vitest";
import { writeRevision } from "../../../../src/lib/models/revisionStorage";
import { pruneAllResources } from "../../../../src/lib/models/pruneExecutor";

async function makeTmpProject() {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "gw-prune-"));
    return dir;
}

describe("pruneExecutor", () => {
    it("prunes resources across project", async () => {
        const projectRoot = await makeTmpProject();

        // create 2 resources with 3 revisions each; set maxRevisions=2 => expect 1 pruned per resource
        const resources = ["res-a", "res-b"];
        for (const r of resources) {
            await writeRevision(projectRoot, r, 1, Buffer.from("first"));
            await writeRevision(projectRoot, r, 2, Buffer.from("second"));
            await writeRevision(projectRoot, r, 3, Buffer.from("third"));
        }

        const results = await pruneAllResources(projectRoot, 2);
        expect(Object.keys(results).length).toBe(2);
        for (const r of resources) {
            expect(results[r]).toBe(1);
        }
    });
});
