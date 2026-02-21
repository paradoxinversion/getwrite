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

        // Build a UI view from canonical project/folders/resources
        const { buildProjectView } = await import(
            "../src/lib/models/project-view"
        );
        const view = buildProjectView({
            project: created.project,
            folders: created.folders,
            resources: created.resources,
        });

        const project = {
            id: view.project.id,
            name: view.project.name,
            description: undefined,
            createdAt: view.project.createdAt ?? new Date().toISOString(),
            updatedAt: view.project.updatedAt ?? view.project.createdAt,
            resources: view.resources,
        };

        // render using `project` prop (preferred) and expand the first folder
        render(<ResourceTree project={project as any} />);

        // The scaffolder creates top-level folders (e.g. "Workspace"); expand the first folder
        const rootNode = screen.getByText(project.resources[0].title);
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
        const idxFront = titles.findIndex((t) => t.includes("Front Matter"));

        // The project-type spec used by the scaffolder includes "Workspace" and
        // "Front Matter" folders — assert both exist and that Workspace appears first.
        expect(idxWorkspace).toBeGreaterThanOrEqual(0);
        expect(idxFront).toBeGreaterThanOrEqual(0);
        expect(idxWorkspace).toBeLessThan(idxFront);

        // The very first visible treeitem should correspond to the first resource
        const first = treeItems[0];
        expect(first.tabIndex).toBe(0);
        expect(first.textContent).toContain(project.resources[0].title);
    });
});
