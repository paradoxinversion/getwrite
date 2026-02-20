import { describe, it, expect } from "vitest";
import {
    createTextResource,
    createImageResource,
    createAudioResource,
    validateResource,
} from "../../../lib/models/resource";

describe("models/resource", () => {
    it("creates and validates TextResource", () => {
        const r = createTextResource({
            name: "Chapter 1",
            plainText: "Hello world\n\nSecond para",
        });
        expect(r.type).toBe("text");
        expect(r.wordCount).toBeGreaterThan(0);
        const v = validateResource(r);
        expect(v.type).toBe("text");
    });

    it("creates and validates ImageResource", () => {
        const r = createImageResource({
            name: "Cover",
            width: 600,
            height: 800,
        });
        expect(r.type).toBe("image");
        const v = validateResource(r);
        expect(v.type).toBe("image");
    });

    it("creates and validates AudioResource", () => {
        const r = createAudioResource({
            name: "Narration",
            durationSeconds: 120.5,
            format: "mp3",
        });
        expect(r.type).toBe("audio");
        const v = validateResource(r);
        expect(v.type).toBe("audio");
    });
});
