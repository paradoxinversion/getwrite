import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ResourceTree from "../components/Tree/ResourceTree";
import { createProject } from "../lib/placeholders";
import ClientProvider from "../src/store/ClientProvider";
import { setProject } from "../src/store/projectsSlice";
import store from "../src/store/store";

describe("ResourceTree drag UI", () => {
    it("shows drag handle when reorderable is enabled", () => {
        const project = createProject("Drag Project");
        const resources = project.resources;
        store.dispatch(
            setProject({ id: project.id, name: project.name, resources }),
        );
        render(
            <ClientProvider>
                <ResourceTree
                    projectId={project.id}
                    reorderable
                    onReorder={() => {}}
                />
            </ClientProvider>,
        );

        const handle = screen.getAllByTestId("drag-handle");
        expect(handle.length).toBeGreaterThan(0);
    });
});
