import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResourceTree from "../components/Tree/ResourceTree";
import ClientProvider from "../src/store/ClientProvider";
import { setProject } from "../src/store/projectsSlice";
import store from "../src/store/store";
import type { Resource } from "../lib/types";

describe("ResourceTree context menu", () => {
    it("forwards context menu actions to onResourceAction", async () => {
        const now = new Date().toISOString();
        const resources: Resource[] = [
            {
                id: "root",
                projectId: "proj_1",
                title: "Root",
                type: "folder",
                createdAt: now,
                updatedAt: now,
                metadata: {},
            },
            {
                id: "scene_a",
                projectId: "proj_1",
                parentId: "root",
                title: "Scene A",
                type: "scene",
                content: "Hello",
                createdAt: now,
                updatedAt: now,
                metadata: {},
            },
        ];

        const onResourceAction = vi.fn();
        store.dispatch(setProject({ id: "proj_1", name: "proj_1", resources }));
        render(
            <ClientProvider>
                <ResourceTree
                    projectId="proj_1"
                    onResourceAction={onResourceAction}
                />
            </ClientProvider>,
        );

        // Expand the root so child nodes are rendered, then right-click the resource title to open the context menu
        const rootNode = screen.getByText("Root");
        const rootBtn = rootNode.closest("button");
        expect(rootBtn).toBeTruthy();
        fireEvent.click(rootBtn as HTMLElement);

        // Right-click the resource title to open the context menu
        fireEvent.contextMenu(screen.getByText("Scene A"));

        // Menu should appear
        const menu = await screen.findByRole("menu");
        expect(menu).toBeInTheDocument();

        // Click the Copy action
        const copyBtn = screen.getByText("Copy");
        fireEvent.click(copyBtn);

        expect(onResourceAction).toHaveBeenCalledTimes(1);
        expect(onResourceAction).toHaveBeenCalledWith("copy", "scene_a");
    });
});
