import { test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../cli/templates";

test("CLI export fails when output directory is not writable", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-"));
    const outDir = path.join(tmp, "protected");
    try {
        await fs.mkdir(outDir, { recursive: true });
        // remove write permissions
        await fs.chmod(outDir, 0o444);

        const out = path.join(outDir, "should-fail.zip");
        const code = await main([
            "node",
            "templates.ts",
            "export",
            tmp,
            "nope",
            out,
        ]);
        expect(code).toBe(2);
    } finally {
        // restore permissions so cleanup succeeds
        try {
            await fs.chmod(outDir, 0o700);
        } catch (_) {}
        await fs.rm(tmp, { recursive: true, force: true });
    }
});

test("CLI import fails on invalid zip file", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-"));
    try {
        const bad = path.join(tmp, "not-a-zip.pack");
        await fs.writeFile(bad, "this is not a zip file", "utf8");
        const code = await main(["node", "templates.ts", "import", tmp, bad]);
        expect(code).toBe(2);
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
});
