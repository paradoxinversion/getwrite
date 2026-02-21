import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    saveResourceTemplate,
    loadResourceTemplate,
    exportResourceTemplate,
    importResourceTemplates,
} from "../../lib/models/resource-templates";

test("T033: export/import template roundtrip", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-rt-"));
    try {
        const tpl = {
            id: "tpl-export-1",
            name: "Exported Template",
            type: "text",
            plainText: "Hello {{NAME}}",
        } as const;

        // save
        await saveResourceTemplate(tmp, tpl as any);

        // export
        const out = path.join(tmp, "tpl-export.zip");
        await exportResourceTemplate(tmp, tpl.id, out);
        const stat = await fs.stat(out);
        expect(stat.size).toBeGreaterThan(0);

        // remove the saved template file
        const tplFile = path.join(tmp, "meta", "templates", `${tpl.id}.json`);
        await fs.unlink(tplFile);
        // ensure removed
        let exists = true;
        try {
            await fs.access(tplFile);
        } catch (_) {
            exists = false;
        }
        expect(exists).toBe(false);

        // import back
        const imported = await importResourceTemplates(tmp, out);
        expect(imported).toContain(tpl.id);

        const loaded = await loadResourceTemplate(tmp, tpl.id);
        expect(loaded.name).toBe(tpl.name);
        expect(loaded.plainText).toBe(tpl.plainText);
    } finally {
        // cleanup
        const { removeDirRetry } = await import("./helpers/fs-utils");
        await removeDirRetry(tmp);
    }
});
