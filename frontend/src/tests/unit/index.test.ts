import { describe, it, expect } from "vitest";
import { ProjectSchema } from "../../lib/models/schemas";

/**
 * Placeholder unit test for model schemas.
 * Ensures the ProjectSchema accepts a minimal valid project object.
 */
describe("models: ProjectSchema", () => {
    it("accepts a minimal valid project", () => {
        const sample = {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Test Project",
            createdAt: new Date().toISOString(),
        };

        expect(() => ProjectSchema.parse(sample)).not.toThrow();
    });
});
