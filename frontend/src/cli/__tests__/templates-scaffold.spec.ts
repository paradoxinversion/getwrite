import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../cli/templates";
import { saveResourceTemplate } from "../../lib/models/resource-templates";

test("CLI scaffold creates multiple resources", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-"));
    try {
        const tpl = {
            id: "cli-scaffold-1",
            name: "Scaffold Template",
            type: "text",
            plainText: "Hello",
        } as const;

        await saveResourceTemplate(tmp, tpl as any);

        const code = await main([
            "node",
            "templates.ts",
            "scaffold",
            tmp,
            tpl.id,
            "3",
        ]);
        expect(code).toBe(0);

        // Expect 3 meta sidecar files
        const metaDir = path.join(tmp, "meta");
        const entries = await fs.readdir(metaDir);
        const metas = entries.filter(
            (e) => e.startsWith("resource-") && e.endsWith(".meta.json"),
        );
        expect(metas.length).toBeGreaterThanOrEqual(3);
    } finally {
        // best-effort cleanup: retry a few times to avoid transient ENOTEMPTY races
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await fs.rm(tmp, { recursive: true, force: true });
                break;
            } catch (err) {
                if (attempt === 2) throw err;
                await new Promise((r) => setTimeout(r, 50));
            }
        }
    }
});

test("CLI apply-multiple with JSON input creates resources", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-"));
    try {
        const tpl = {
            id: "cli-apply-multi-1",
            name: "{{TITLE}}",
            type: "text",
            plainText: "Body: {{TITLE}}",
        } as const;

        await saveResourceTemplate(tmp, tpl as any);

        const input = [{ TITLE: "One" }, { TITLE: "Two" }, { TITLE: "Three" }];
        const inputPath = path.join(tmp, "rows.json");
        await fs.writeFile(inputPath, JSON.stringify(input, null, 2), "utf8");

        const code = await main([
            "node",
            "templates.ts",
            "apply-multiple",
            tmp,
            tpl.id,
            inputPath,
        ]);
        expect(code).toBe(0);

        const metaDir = path.join(tmp, "meta");
        const entries = await fs.readdir(metaDir);
        const metas = entries.filter(
            (e) => e.startsWith("resource-") && e.endsWith(".meta.json"),
        );
        expect(metas.length).toBeGreaterThanOrEqual(3);
    } finally {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await fs.rm(tmp, { recursive: true, force: true });
                break;
            } catch (err) {
                if (attempt === 2) throw err;
                await new Promise((r) => setTimeout(r, 50));
            }
        }
    }
});
