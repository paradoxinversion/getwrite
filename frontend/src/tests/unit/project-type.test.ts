import { describe, it, expect } from "vitest";
import { validateProjectType } from "../../../src/lib/models/schemas";

describe("project-type schema (T016/T017)", () => {
    it("accepts a valid project-type spec", () => {
        const spec = {
            id: "novel",
            name: "Novel",
            folders: [{ name: "Workspace" }, { name: "Chapters" }],
            defaultResources: [
                { name: "Title Page", type: "text", template: "" },
            ],
        };

        const res = validateProjectType(spec);
        expect(res.success).toBe(true);
        if (res.success) expect(res.value.id).toBe("novel");
    });

    it("rejects a spec missing the required Workspace folder", () => {
        const spec = {
            id: "article",
            name: "Article",
            folders: [{ name: "Chapters" }],
        };
        const res = validateProjectType(spec);
        expect(res.success).toBe(false);
        // refinement error placed on `folders`
        expect(JSON.stringify(res.errors)).toContain("Workspace");
    });

    it("rejects a spec with invalid id pattern", () => {
        const spec = {
            id: "Bad ID!",
            name: "Bad",
            folders: [{ name: "Workspace" }],
        };
        const res = validateProjectType(spec);
        expect(res.success).toBe(false);
        // zod produces a human-friendly message for regex failures
        expect(JSON.stringify(res.errors)).toContain("must match pattern");
    });
});
