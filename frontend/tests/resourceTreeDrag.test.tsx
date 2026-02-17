import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ResourceTree from "../components/Tree/ResourceTree";
import { createProject } from "../lib/placeholders";

describe("ResourceTree drag UI", () => {
    it("shows drag handle when reorderable is enabled", () => {
        const project = createProject("Drag Project");
        const resources = project.resources;
        render(
            <ResourceTree
                resources={resources}
                reorderable
                onReorder={() => {}}
            />,
        );

        const handle = screen.getAllByTestId("drag-handle");
        expect(handle.length).toBeGreaterThan(0);
    });
});
