import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    saveResourceTemplate,
    createResourceFromTemplate,
    duplicateResource,
} from "../../lib/models/resource-templates";
import { saveResourceTemplateFromResource } from "../../lib/models/resource-templates";
import { main as templatesMain } from "../../cli/templates";
import { createAndAssertProject } from "./helpers/project-creator";
import { flushIndexer } from "../../lib/models/indexer-queue";
import { readSidecar } from "../../lib/models/sidecar";

describe("models/resource-templates (T027)", () => {
    // cleanup uses direct recursive removal now that meta writes are serialized
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
            // wait for background indexing to finish before cleanup
            await flushIndexer();
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
            // wait for background indexing to finish before cleanup
            await flushIndexer();
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });

    it("captures a resource as a template via helper", async () => {
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
                { projectRoot: tmp, name: "Capture Template Test" },
            );
            if (resources.length === 0) return;

            const original = resources[0];
            const tplId = "from-helper";
            await saveResourceTemplateFromResource(
                projectPath,
                original.id,
                tplId,
                { name: "From Helper" },
            );

            const tplPath = path.join(
                projectPath,
                "meta",
                "templates",
                `${tplId}.json`,
            );
            const raw = await fs.readFile(tplPath, "utf8");
            const parsed = JSON.parse(raw);
            expect(parsed.id).toBe(tplId);
            expect(parsed.name).toBe("From Helper");
            expect(parsed.type).toBe("text");
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });

    it("captures a resource as a template via CLI", async () => {
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
                { projectRoot: tmp, name: "CLI Capture Test" },
            );
            if (resources.length === 0) return;

            const original = resources[0];
            const tplId = "from-cli";

            const argv = [
                "node",
                "templates",
                "save-from-resource",
                projectPath,
                original.id,
                tplId,
                "--name",
                "From CLI",
            ];

            const code = await templatesMain(argv);
            expect(code).toBe(0);

            const tplPath = path.join(
                projectPath,
                "meta",
                "templates",
                `${tplId}.json`,
            );
            const raw = await fs.readFile(tplPath, "utf8");
            const parsed = JSON.parse(raw);
            expect(parsed.id).toBe(tplId);
            expect(parsed.name).toBe("From CLI");
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });

    it("parametrizes a template via helper and CLI", async () => {
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
                name: "Param Test",
            });

            const tplId = "tpl-param";
            const template = {
                id: tplId,
                name: "Chapter One",
                type: "text" as const,
                plainText: "Chapter One\n\nContent here",
            };
            await saveResourceTemplate(projectPath, template as any);

            // helper
            const { parametrizeResourceTemplate } =
                await import("../../lib/models/resource-templates");
            const vars = await parametrizeResourceTemplate(
                projectPath,
                tplId,
                "{{TITLE}}",
            );
            expect(vars).toContain("TITLE");

            const raw = await fs.readFile(
                path.join(projectPath, "meta", "templates", `${tplId}.json`),
                "utf8",
            );
            const parsed = JSON.parse(raw);
            expect(parsed.name).toBe("{{TITLE}}");
            expect(parsed.plainText.startsWith("{{TITLE}}"));

            // CLI
            const tplCliId = "tpl-param-cli";
            const tpl2 = { ...template, id: tplCliId };
            await saveResourceTemplate(projectPath, tpl2 as any);
            const argv = [
                "node",
                "templates",
                "parametrize",
                projectPath,
                tplCliId,
                "--placeholder",
                "{{TITLE}}",
            ];
            const code = await templatesMain(argv);
            expect(code).toBe(0);
            const raw2 = await fs.readFile(
                path.join(projectPath, "meta", "templates", `${tplCliId}.json`),
                "utf8",
            );
            const parsed2 = JSON.parse(raw2);
            expect(parsed2.name).toBe("{{TITLE}}");
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });

    it("creates from template with vars (dry-run and real)", async () => {
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
                name: "Vars Test",
            });

            const tplId = "tpl-vars";
            const template = {
                id: tplId,
                name: "My {{TITLE}}",
                type: "text" as const,
                plainText: "{{TITLE}}\n\nBody",
            };
            await saveResourceTemplate(projectPath, template as any);

            // dry-run
            const { plannedWrites } = (
                await import("../../lib/models/resource-templates")
            ).createResourceFromTemplate(projectPath, tplId, {
                name: undefined,
                vars: { TITLE: "Draft" },
                dryRun: true,
            }) as any;
            expect(Array.isArray(await plannedWrites)).toBeTruthy();

            // CLI dry-run
            const argvDry = [
                "node",
                "templates",
                "create",
                projectPath,
                tplId,
                "--vars",
                JSON.stringify({ TITLE: "CLI" }),
                "--dry-run",
            ];
            const codeDry = await templatesMain(argvDry);
            expect(codeDry).toBe(0);

            // real create
            const result = (await (
                await import("../../lib/models/resource-templates")
            ).createResourceFromTemplate(projectPath, tplId, {
                vars: { TITLE: "Final" },
            })) as any;
            expect(result.id).toBeTruthy();

            const resourcesDir = path.join(projectPath, "resources");
            const entries = await fs.readdir(resourcesDir);
            const found = entries.find((e) => e.includes(result.id));
            expect(found).toBeTruthy();
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });
});
