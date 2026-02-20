import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createAndAssertProject } from "./helpers/project-creator";
import {
    softDeleteResource,
    restoreResource,
    purgeResource,
} from "../../lib/models/trash";
import { readSidecar } from "../../lib/models/sidecar";

describe("models/trash (T026)", () => {
    it("soft-deletes, restores, and purges a resource", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-trash-"));
        try {
            const specPath = path.join(
                process.cwd(),
                "..",
                "specs",
                "002-define-data-models",
                "project-types",
                "novel_project_type.json",
            );

            const { projectPath, folders, resources } =
                await createAndAssertProject(specPath, {
                    projectRoot: tmp,
                    name: "Trash Test",
                });

            if (resources.length === 0) {
                // Nothing to test for trash behavior
                return;
            }

            const res = resources[0];

            // Ensure sidecar exists before deletion
            const before = await readSidecar(projectPath, res.id);
            expect(before).not.toBeNull();

            await softDeleteResource(projectPath, res.id);

            // Sidecar should no longer be readable from project root
            const after = await readSidecar(projectPath, res.id);
            expect(after).toBeNull();

            // Restore
            await restoreResource(projectPath, res.id);
            const restored = await readSidecar(projectPath, res.id);
            expect(restored).not.toBeNull();

            // Soft-delete again and purge
            await softDeleteResource(projectPath, res.id);
            await purgeResource(projectPath, res.id);

            // Sidecar should not be restorable
            const final = await readSidecar(projectPath, res.id);
            expect(final).toBeNull();
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });
});
