import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    saveResourceTemplate,
    listResourceTemplates,
    inspectResourceTemplate,
} from "../../lib/models/resource-templates";
import { createAndAssertProject } from "./helpers/project-creator";
import { removeDirRetry } from "./helpers/fs-utils";

describe("resource templates list & inspect (T032)", () => {
    it("lists templates and inspects details", async () => {
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
                name: "ListInspect",
            });

            const tplA = {
                id: "tpl-a",
                name: "Alpha",
                type: "text" as const,
                plainText: "Hello",
            };
            const tplB = {
                id: "tpl-b",
                name: "Beta",
                type: "text" as const,
                plainText: "{{TITLE}} intro",
                metadata: { foo: "bar" },
            };
            await saveResourceTemplate(projectPath, tplA as any);
            await saveResourceTemplate(projectPath, tplB as any);

            const all = await listResourceTemplates(projectPath);
            expect(all.map((x) => x.id).sort()).toEqual(
                ["tpl-a", "tpl-b"].sort(),
            );

            const q = await listResourceTemplates(projectPath, "alpha");
            expect(q.length).toBe(1);
            expect(q[0].id).toBe("tpl-a");

            const info = await inspectResourceTemplate(projectPath, "tpl-b");
            expect(info.placeholders).toContain("TITLE");
            expect(info.metadataKeys).toContain("foo");
        } finally {
            await removeDirRetry(tmp);
        }
    });
});
