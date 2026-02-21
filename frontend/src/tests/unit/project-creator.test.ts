import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createAndAssertProject } from "./helpers/project-creator";
import { flushIndexer } from "../../lib/models/indexer-queue";

describe("models/project-creator", () => {
    it("creates project structure and resource placeholders from spec", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-pc-"));
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
                    name: "My Novel",
                });

            // project.json exists
            const pj = await fs.readFile(
                path.join(projectPath, "project.json"),
                "utf8",
            );
            expect(pj).toBeTruthy();

            // folders directory exists and has workspace
            const foldersDir = path.join(projectPath, "folders");
            const entries = await fs.readdir(foldersDir);
            expect(entries.length).toBeGreaterThanOrEqual(1);

            // resources dir exists and resources have sidecars
            const meta = await fs.readdir(path.join(projectPath, "meta"));
            expect(meta.length).toBeGreaterThanOrEqual(resources.length);
            // ensure background indexing finished before cleanup
            await flushIndexer();
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });
});
