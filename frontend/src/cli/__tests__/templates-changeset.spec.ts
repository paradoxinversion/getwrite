import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../cli/templates";
import { saveResourceTemplate } from "../../lib/models/resource-templates";

test("changeset shows edits after modifications", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-"));
    try {
        const tpl = {
            id: "cli-chg-1",
            name: "Original",
            type: "text",
            plainText: "A",
        } as const;
        await saveResourceTemplate(tmp, tpl as any);

        // modify via save
        const modified = { ...tpl, plainText: "B" } as any;
        await saveResourceTemplate(tmp, modified);

        const code = await main([
            "node",
            "templates.ts",
            "changeset",
            tmp,
            tpl.id,
        ]);
        expect(code).toBe(0);
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
