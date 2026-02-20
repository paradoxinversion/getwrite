import { describe, it, expect, afterEach } from "vitest";
import * as io from "../../../../src/lib/models/io";

describe("io adapter", () => {
    const original = io.getStorageAdapter();

    afterEach(() => {
        io.setStorageAdapter(original);
    });

    it("replaces adapter and routes calls to the new adapter", async () => {
        const calls: Record<string, number> = {
            mkdir: 0,
            writeFile: 0,
            readFile: 0,
            readdir: 0,
            stat: 0,
            rm: 0,
            rename: 0,
        };

        const fake = {
            mkdir: async (p: string, o?: any) => {
                calls.mkdir++;
            },
            writeFile: async (p: string, d: string | Buffer, o?: any) => {
                calls.writeFile++;
            },
            readFile: async (p: string, e?: string) => {
                calls.readFile++;
                return "fake-content";
            },
            readdir: async (p: string, o?: any) => {
                calls.readdir++;
                return [];
            },
            stat: async (p: string) => {
                calls.stat++;
                return { isFile: () => false } as any;
            },
            rm: async (p: string, o?: any) => {
                calls.rm++;
            },
            rename: async (a: string, b: string) => {
                calls.rename++;
            },
        } as unknown as typeof original;

        io.setStorageAdapter(fake as any);

        await io.mkdir("/tmp/x", { recursive: true });
        await io.writeFile("/tmp/x/content", "hi");
        const content = await io.readFile("/tmp/x/content", "utf8");
        await io.readdir("/tmp/x", { withFileTypes: true });
        await io.stat("/tmp/x");
        await io.rm("/tmp/x", { recursive: true, force: true });
        await io.rename("/tmp/a", "/tmp/b");

        expect(content).toBe("fake-content");
        expect(calls).toEqual({
            mkdir: 1,
            writeFile: 1,
            readFile: 1,
            readdir: 1,
            stat: 1,
            rm: 1,
            rename: 1,
        });
    });
});
