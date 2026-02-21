import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ResourceTree from "../components/Tree/ResourceTree";
import { createProject as createPlaceholderProject } from "../lib/placeholders";
import { createProjectFromType } from "../src/lib/models/project-creator";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("ResourceTree ordering and defaults", () => {
    it("renders top-level children in resources order and exposes the first visible node", async () => {
        // Create a real project on disk using the project-type spec and map it
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-test-"));
        const specPath = path.resolve(
            process.cwd(),
            "../specs/002-define-data-models/project-types/novel_project_type.json",
        );

        const created = await createProjectFromType({
            projectRoot: tmp,
            spec: specPath,
            name: "Order Project Real",
        });

        // Map returned folders/resources to the UI Resource shape
        const project = {
            id: created.project.id,
            name: created.project.name,
            description: undefined,
            createdAt: created.project.createdAt ?? new Date().toISOString(),
            updatedAt: created.project.updatedAt ?? created.project.createdAt,
            resources: [
                // folders as folder-type resources
                ...created.folders.map((f) => ({
                    id: f.id,
                    projectId: created.project.id,
                    parentId: undefined,
                    title: f.name,
                    type: "folder",
                    content: undefined,
                    createdAt: f.createdAt,
                    updatedAt: f.createdAt,
                    metadata: {},
                })),
                // text resources as documents under their folder
                ...created.resources.map((r) => ({
                    id: r.id,
                    projectId: created.project.id,
                    parentId: r.folderId,
                    title: r.name,
                    type: "document",
                    content: r.plainText ?? "",
                    createdAt: r.createdAt,
                    updatedAt: r.createdAt,
                    metadata: {},
                })),
            ],
        };

        // render using `project` prop (preferred) and expand the first folder
        render(<ResourceTree project={project as any} />);

        const rootNode = screen.getByText(project.name);
        const rootBtn = rootNode.closest("button");
        expect(rootBtn).toBeTruthy();
        fireEvent.click(rootBtn as HTMLElement);

        // Grab the tree nav and all rendered treeitems in DOM order
        const tree = screen.getByLabelText("Resource tree");
        const treeItems = Array.from(
            tree.querySelectorAll('[role="treeitem"]'),
        ) as HTMLElement[];

        // Find the visible occurrences of the two expected children and assert order
        const titles = treeItems.map((t) => t.textContent?.trim() ?? "");
        const idxWorkspace = titles.findIndex((t) => t.includes("Workspace"));
        const idxNotes = titles.findIndex((t) => t.includes("Notes"));

        expect(idxWorkspace).toBeGreaterThanOrEqual(0);
        expect(idxNotes).toBeGreaterThanOrEqual(0);
        expect(idxWorkspace).toBeLessThan(idxNotes);

        // The very first visible treeitem should correspond to the first resource
        const first = treeItems[0];
        expect(first.tabIndex).toBe(0);
        expect(first.textContent).toContain(project.resources[0].title);
    });
});
