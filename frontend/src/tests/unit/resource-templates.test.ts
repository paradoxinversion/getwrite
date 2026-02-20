import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    saveResourceTemplate,
    createResourceFromTemplate,
    duplicateResource,
} from "../../lib/models/resource-templates";
import { createAndAssertProject } from "./helpers/project-creator";
import { readSidecar } from "../../lib/models/sidecar";

describe("models/resource-templates (T027)", () => {
    it("saves a template and creates a resource from it", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-rt-"));
        try {
            const specPath = path.join(
                process.cwd(),
                "..",
                "specs",
                "002-define-data-models",
                "project-types",
                "novel_project_type.json",
            );

            const { projectPath } = await createAndAssertProject(specPath, {
                projectRoot: tmp,
                name: "Template Test",
            });

            const template = {
                id: "tpl-1",
                name: "Template Chapter",
                type: "text" as const,
                plainText: "This is a template",
            };

            await saveResourceTemplate(projectPath, template);
            const created = await createResourceFromTemplate(
                projectPath,
                template.id,
                { name: "From Template" },
            );

            // sidecar exists for created resource
            const meta = await readSidecar(projectPath, created.id);
            expect(meta).not.toBeNull();
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });

    it("duplicates an existing resource", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-rt-"));
        try {
            const specPath = path.join(
                process.cwd(),
                "..",
                "specs",
                "002-define-data-models",
                "project-types",
                "novel_project_type.json",
            );

            const { projectPath, resources } = await createAndAssertProject(
                specPath,
                { projectRoot: tmp, name: "Dup Test" },
            );
            if (resources.length === 0) return;

            const original = resources[0];
            const result = await duplicateResource(projectPath, original.id);
            expect(result.newId).toBeTruthy();
            expect(result.newId).not.toBe(original.id);

            const meta = await readSidecar(projectPath, result.newId);
            expect(meta).not.toBeNull();
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });
});
