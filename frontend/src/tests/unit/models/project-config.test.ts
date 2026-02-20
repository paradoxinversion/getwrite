import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    loadProject,
    loadProjectConfig,
    PROJECT_FILENAME,
} from "../../../../src/lib/models/project-config";
import { generateUUID } from "../../../../src/lib/models/uuid";

describe("models/project-config", () => {
    it("loads project.json and applies defaults to config", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-pcfg-"));
        try {
            const proj = {
                id: generateUUID(),
                name: "CfgTest",
                createdAt: new Date().toISOString(),
            };
            await fs.writeFile(
                path.join(tmp, PROJECT_FILENAME),
                JSON.stringify(proj, null, 2),
                "utf8",
            );

            const loaded = await loadProject(tmp);
            expect(loaded.config).toBeTruthy();
            expect(loaded.config?.maxRevisions).toBe(50);
            expect(loaded.config?.autoPrune).toBe(true);

            const cfg = await loadProjectConfig(tmp);
            expect(cfg.maxRevisions).toBe(50);
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });

    it("throws when project.json is invalid JSON", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-pcfg-"));
        try {
            await fs.writeFile(
                path.join(tmp, PROJECT_FILENAME),
                "not-json",
                "utf8",
            );
            await expect(loadProject(tmp)).rejects.toThrow();
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });
});
