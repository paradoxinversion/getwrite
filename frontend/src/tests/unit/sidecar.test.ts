import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    sidecarFilename,
    readSidecar,
    writeSidecar,
} from "../../../src/lib/models/sidecar";
import { flushIndexer } from "../../../src/lib/models/indexer-queue";
import { generateUUID } from "../../../src/lib/models/uuid";

describe("models/sidecar", () => {
    it("writes and reads a sidecar file in project meta folder", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-test-"));
        const resourceId = generateUUID();
        const meta = { title: "Sample", tags: ["a", "b"] } as const;

        await writeSidecar(
            tmp,
            resourceId,
            meta as unknown as Record<string, unknown>,
        );

        const expectedPath = path.join(
            tmp,
            "meta",
            sidecarFilename(resourceId),
        );
        const exists = await fs.readFile(expectedPath, "utf8");
        expect(typeof exists).toBe("string");

        const read = await readSidecar(tmp, resourceId);
        expect(read).not.toBeNull();
        expect((read as any).title).toBe("Sample");

        // ensure background indexing finished before cleanup
        await flushIndexer();

        // cleanup
        await fs.rm(tmp, { recursive: true, force: true });
    });

    it("returns null when sidecar is missing", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-test-"));
        const resourceId = generateUUID();
        const read = await readSidecar(tmp, resourceId);
        expect(read).toBeNull();
        await fs.rm(tmp, { recursive: true, force: true });
    });
});
