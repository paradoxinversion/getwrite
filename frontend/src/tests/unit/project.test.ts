import { describe, it, expect } from "vitest";
import { createProject, validateProject } from "../../lib/models/project";
import { isValidUUID } from "../../lib/models/uuid";

describe("models: createProject / validateProject", () => {
    it("createProject applies defaults and returns a valid project", () => {
        const p = createProject({ name: "My Project" });
        expect(p.name).toBe("My Project");
        expect(typeof p.id).toBe("string");
        expect(isValidUUID(p.id)).toBe(true);
        expect(p.config).toBeTruthy();
        expect(p.config?.maxRevisions).toBe(50);
        expect(p.config?.autoPrune).toBe(true);
        expect(typeof p.createdAt).toBe("string");
    });

    it("validateProject throws on invalid input", () => {
        // Missing required `name` should fail
        expect(() =>
            validateProject({
                id: "00000000-0000-4000-8000-000000000000",
                createdAt: new Date().toISOString(),
            }),
        ).toThrow();
    });
});
