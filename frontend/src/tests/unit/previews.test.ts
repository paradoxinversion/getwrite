import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generatePreview, loadPreview } from "../../../src/lib/models/previews";
import { createAndAssertProject } from "./helpers/project-creator";
import type { TextResource } from "../../../src/lib/models/types";

describe("models/previews (T028)", () => {
    it("generates and persists an image preview using custom generator", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-pr-"));
        try {
            const specPath = path.join(
                process.cwd(),
                "..",
                "specs",
                "002-define-data-models",
                "project-types",
                "novel_project_type.json",
            );
            const { projectPath } = await createAndAssertProject(specPath, {
                projectRoot: tmp,
                name: "Preview Test",
            });

            const fakeImage: any = {
                id: "img-1",
                type: "image",
                name: "Pic",
            };

            await generatePreview(projectPath, fakeImage, {
                image: async (r) => ({
                    type: "image",
                    width: 32,
                    height: 32,
                    thumbnail: "data:...",
                }),
            });

            const saved = await loadPreview(projectPath, "img-1");
            expect(saved).not.toBeNull();
            expect((saved as any).type).toBe("image");
            expect((saved as any).width).toBe(32);
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });

    it("generates and persists a text preview using default generator", async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-pr-"));
        try {
            const specPath = path.join(
                process.cwd(),
                "..",
                "specs",
                "002-define-data-models",
                "project-types",
                "novel_project_type.json",
            );
            const { projectPath } = await createAndAssertProject(specPath, {
                projectRoot: tmp,
                name: "Preview Test",
            });

            const fakeText = {
                id: "txt-1",
                type: "text",
                name: "Note",
                plainText: "hello world this is a preview test",
            } as unknown as TextResource;

            await generatePreview(projectPath, fakeText);

            const saved = await loadPreview(projectPath, "txt-1");
            expect(saved).not.toBeNull();
            expect((saved as any).type).toBe("text");
            expect((saved as any).wordCount).toBeGreaterThan(0);
        } finally {
            await fs.rm(tmp, { recursive: true, force: true });
        }
    });
});
