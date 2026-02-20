import { describe, it, expect, afterEach } from "vitest";
import * as io from "../../../../src/lib/models/io";
import { createMemoryAdapter } from "../../../../src/lib/models/memoryAdapter";

describe("io adapter", () => {
    const original = io.getStorageAdapter();

    afterEach(() => {
        io.setStorageAdapter(original);
    });

    it("replaces adapter and routes calls to the new adapter", async () => {
        // use an in-memory adapter for isolation
        const mem = createMemoryAdapter();
        io.setStorageAdapter(mem as any);

        await io.mkdir("/project-x", { recursive: true });
        await io.writeFile("/project-x/content", "hi");
        const content = await io.readFile("/project-x/content", "utf8");
        await io.readdir("/project-x", { withFileTypes: true });
        await io.stat("/project-x");
        await io.rm("/project-x", { recursive: true, force: true });
        await io.writeFile("/a", "x");
        await io.rename("/a", "/b");

        expect(content).toBe("hi");
        const moved = await io.readFile("/b", "utf8");
        expect(moved).toBe("x");
    });
});
