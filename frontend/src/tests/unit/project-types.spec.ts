import { describe, it, expect, beforeEach } from "vitest";
import {
    setStorageAdapter,
    writeFile,
    mkdir,
} from "../../../src/lib/models/io";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import {
    listProjectTypes,
    getProjectType,
    clearProjectTypeCache,
} from "../../../src/lib/projectTypes";

describe("projectTypes loader (T005)", () => {
    beforeEach(async () => {
        setStorageAdapter(createMemoryAdapter());
        clearProjectTypeCache();
        // ensure templates dir exists
        await mkdir("getwrite-config/templates/project-types", {
            recursive: true,
        });
    });

    it("loads valid project-type JSON files", async () => {
        const spec = {
            id: "novel",
            name: "Novel",
            folders: [{ name: "Workspace" }, { name: "Chapters" }],
        };
        await writeFile(
            "getwrite-config/templates/project-types/novel.json",
            JSON.stringify(spec),
        );

        const list = await listProjectTypes(true);
        expect(list.length).toBe(1);
        expect(list[0].spec.id).toBe("novel");

        const byId = await getProjectType("novel", false);
        expect(byId).toBeDefined();
        expect(byId?.spec.name).toBe("Novel");
    });

    it("skips invalid JSON or invalid specs", async () => {
        // invalid JSON
        await writeFile(
            "getwrite-config/templates/project-types/bad.json",
            "{ not: valid json",
        );

        // invalid schema (missing Workspace folder)
        const invalidSpec = {
            id: "no-workspace",
            name: "Bad",
            folders: [{ name: "Chapters" }],
        };
        await writeFile(
            "getwrite-config/templates/project-types/invalid.json",
            JSON.stringify(invalidSpec),
        );

        // valid one
        const ok = {
            id: "short",
            name: "Short",
            folders: [{ name: "Workspace" }],
        };
        await writeFile(
            "getwrite-config/templates/project-types/short.json",
            JSON.stringify(ok),
        );

        const list = await listProjectTypes(true);
        // only the valid one should be returned
        expect(list.map((l) => l.spec.id)).toEqual(["short"]);
    });
});
