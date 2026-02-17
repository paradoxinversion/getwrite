import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ResourceTree from "../components/Tree/ResourceTree";
import { createProject, createResource } from "../lib/placeholders";

describe("ResourceTree", () => {
    it("renders and expands folder nodes and calls onSelect", () => {
        const project = createProject("Test Project");
        const folder = createResource("Folder A", "folder", project.id);
        const item = createResource(
            "Child Item",
            "document",
            project.id,
            folder.id,
        );
        const resources = [folder, ...project.resources, item];

        const onSelect = vi.fn();
        render(<ResourceTree resources={resources} onSelect={onSelect} />);

        // folder title should be in the document
        const folderNode = screen.getByText("Folder A");
        expect(folderNode).toBeTruthy();

        // click the expand button (chevron) which has aria-label "Expand"
        const expandBtn = screen.getByLabelText("Expand");
        fireEvent.click(expandBtn);

        // after toggling expand, the child item should be visible
        const childNode = screen.getByText("Child Item");
        expect(childNode).toBeTruthy();

        fireEvent.click(childNode);
        expect(onSelect).toHaveBeenCalledWith(item.id);
    });
});
