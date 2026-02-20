import { describe, it, expect } from "vitest";
import { generateUUID, isValidUUID } from "../../../../src/lib/models/uuid";

describe("models/uuid", () => {
    it("generates a valid UUID v4", () => {
        const id = generateUUID();
        expect(typeof id).toBe("string");
        // validator should accept it
        expect(isValidUUID(id)).toBe(true);
        // ensure version nibble is `4`
        expect(id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
    });

    it("rejects invalid UUID strings", () => {
        expect(isValidUUID("not-a-uuid")).toBe(false);
        expect(isValidUUID("00000000-0000-0000-0000-000000000000")).toBe(false);
    });

    it("produces unique values in a small sample", () => {
        const seen = new Set<string>();
        for (let i = 0; i < 10; i++) seen.add(generateUUID());
        expect(seen.size).toBe(10);
    });
});
