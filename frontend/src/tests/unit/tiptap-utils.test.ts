import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter } from "../../../src/lib/models/memoryAdapter";
import { setStorageAdapter } from "../../../src/lib/models/io";
import {
    persistResourceContent,
    tiptapToPlainText,
    plainTextToTiptap,
    loadResourceContent,
} from "../../../src/lib/tiptap-utils";
import { generateUUID } from "../../../src/lib/models/uuid";

describe("tiptap-utils (T015)", () => {
    beforeEach(() => {
        const mem = createMemoryAdapter();
        setStorageAdapter(mem as any);
    });

    it("converts tiptap doc to plain text and back", () => {
        const doc = {
            type: "doc",
            content: [
                { type: "heading", content: [{ type: "text", text: "Title" }] },
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "First line" }],
                },
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "Second line" }],
                },
            ],
        } as any;

        const plain = tiptapToPlainText(doc);
        expect(plain).toContain("Title");
        expect(plain).toContain("First line");

        const round = plainTextToTiptap(plain);
        expect(round.type).toBe("doc");
        expect(round.content.length).toBeGreaterThan(0);
    });

    it("persists both tiptap and plain text forms to disk and can load them", async () => {
        const projectRoot = "/proj-" + generateUUID();
        const resourceId = generateUUID();
        const doc = {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "hello world" }],
                },
            ],
        } as any;

        await persistResourceContent(projectRoot, resourceId, doc);

        const loaded = await loadResourceContent(projectRoot, resourceId);
        expect(loaded.plainText).toBe("hello world");
        expect(loaded.tiptap).toBeDefined();
    });
});
