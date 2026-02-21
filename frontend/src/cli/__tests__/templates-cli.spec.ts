import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../cli/templates";
import { saveResourceTemplate } from "../../lib/models/resource-templates";

test("CLI export command writes zip and returns 0", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-"));
    try {
        const tpl = {
            id: "cli-export-1",
            name: "CLI Export Template",
            type: "text",
            plainText: "Sample",
        } as const;

        await saveResourceTemplate(tmp, tpl as any);

        const out = path.join(tmp, "out", "cli-export.zip");
        const code = await main([
            "node",
            "templates.ts",
            "export",
            tmp,
            tpl.id,
            out,
        ]);
        expect(code).toBe(0);
        const stat = await fs.stat(out);
        expect(stat.size).toBeGreaterThan(0);
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
});
