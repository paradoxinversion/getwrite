import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectFromType } from "../../../../src/lib/models/project-creator";
import spec from "../../../../../specs/002-define-data-models/project-types/novel_project_type.json";

describe("models/project-creator", () => {
    it("creates project structure and resource placeholders from spec", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-pc-"));
        try {
            const { project, folders, resources } = await createProjectFromType(
                {
                    projectRoot: tmp,
                    spec,
                    name: "My Novel",
                },
            );

            // project.json exists
            const pj = await fs.readFile(
                path.join(tmp, "project.json"),
                "utf8",
            );
            expect(pj).toBeTruthy();

            // folders directory exists and has workspace
            const foldersDir = path.join(tmp, "folders");
            const entries = await fs.readdir(foldersDir);
            expect(entries.length).toBeGreaterThanOrEqual(1);

            // resources dir exists and resources have sidecars
            const meta = await fs.readdir(path.join(tmp, "meta"));
            expect(meta.length).toBeGreaterThanOrEqual(resources.length);
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });
});
