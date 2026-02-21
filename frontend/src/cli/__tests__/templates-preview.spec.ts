import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../cli/templates";
import { saveResourceTemplate } from "../../lib/models/resource-templates";

test("CLI preview writes substituted plainText to file with --out", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-"));
    try {
        const tpl = {
            id: "cli-preview-1",
            name: "{{TITLE}}",
            type: "text",
            plainText: "Hello {{TITLE}}",
        } as const;

        await saveResourceTemplate(tmp, tpl as any);

        const out = path.join(tmp, "preview.txt");
        const code = await main([
            "node",
            "templates.ts",
            "preview",
            tmp,
            tpl.id,
            "--vars",
            JSON.stringify({ TITLE: "World" }),
            "--out",
            out,
        ]);
        expect(code).toBe(0);
        const got = await fs.readFile(out, "utf8");
        expect(got).toContain("Hello World");
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
