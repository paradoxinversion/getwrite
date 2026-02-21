import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ResourceTree from "../components/Tree/ResourceTree";
import ClientProvider from "../src/store/ClientProvider";
import { setProject } from "../src/store/projectsSlice";
import store from "../src/store/store";
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
        // register project in store and render with Provider
        store.dispatch(
            setProject({ id: project.id, name: project.name, resources }),
        );
        render(
            <ClientProvider>
                <ResourceTree projectId={project.id} onSelect={onSelect} />
            </ClientProvider>,
        );

        // folder title should be in the document
        const folderNode = screen.getByText("Folder A");
        expect(folderNode).toBeTruthy();

        // click the folder's button to toggle expand for this specific node
        const folderBtn = folderNode.closest("button");
        expect(folderBtn).toBeTruthy();
        fireEvent.click(folderBtn as HTMLElement);

        // after toggling expand, the child item should be visible
        const childNode = screen.getByText("Child Item");
        expect(childNode).toBeTruthy();

        fireEvent.click(childNode);
        expect(onSelect).toHaveBeenCalledWith(item.id);
    });
});
