import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../cli/templates";
import {
    saveResourceTemplate,
    loadResourceTemplate,
} from "../../lib/models/resource-templates";

test("version creates snapshot and history lists it", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-"));
    try {
        const tpl = {
            id: "cli-v-1",
            name: "Original",
            type: "text",
            plainText: "A",
        } as const;
        await saveResourceTemplate(tmp, tpl as any);

        const code = await main([
            "node",
            "templates.ts",
            "version",
            tmp,
            tpl.id,
        ]);
        expect(code).toBe(0);

        const hist = await main([
            "node",
            "templates.ts",
            "history",
            tmp,
            tpl.id,
        ]);
        expect(hist).toBe(0);

        // modify template
        const modified = { ...tpl, plainText: "B" } as any;
        await saveResourceTemplate(tmp, modified);

        // rollback to v1
        const rb = await main([
            "node",
            "templates.ts",
            "rollback",
            tmp,
            tpl.id,
            "1",
        ]);
        expect(rb).toBe(0);

        const reloaded = await loadResourceTemplate(tmp, tpl.id);
        expect(reloaded.plainText).toBe("A");
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
