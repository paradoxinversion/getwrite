import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../cli/templates";
import { saveResourceTemplate } from "../../lib/models/resource-templates";

test("CLI validate accepts valid template", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-validate-"));
    try {
        const tpl = {
            id: "valid-tpl-1",
            name: "Valid",
            type: "text",
            plainText: "ok",
        } as const;
        await saveResourceTemplate(tmp, tpl as any);
        const code = await main([
            "node",
            "templates.ts",
            "validate",
            tmp,
            tpl.id,
        ]);
        expect(code).toBe(0);
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
});

test("CLI validate rejects invalid template", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-validate-"));
    try {
        // write an invalid template missing `name`
        const tpl = { id: "invalid-tpl-1", type: "text" } as any;
        const dir = path.join(tmp, "meta", "templates");
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(
            path.join(dir, `${tpl.id}.json`),
            JSON.stringify(tpl),
            "utf8",
        );
        const code = await main([
            "node",
            "templates.ts",
            "validate",
            tmp,
            tpl.id,
        ]);
        expect(code).toBe(2);
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
});
