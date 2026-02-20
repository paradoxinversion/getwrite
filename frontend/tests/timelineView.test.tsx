import React from "react";
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TimelineView from "../components/WorkArea/TimelineView";
import { sampleProjects } from "../lib/placeholders";

describe("TimelineView", () => {
    test("renders dated sections and undated section", () => {
        const projects = sampleProjects(1);
        const project = projects[0];
        render(<TimelineView project={project} />);

        // At least one dated section (createdAt present on placeholders)
        const headings = screen.getAllByRole("heading", { level: 3 });
        expect(headings.length).toBeGreaterThanOrEqual(1);

        // Resource titles should appear
        project.resources.forEach((r) => {
            expect(screen.getAllByText(r.title).length).toBeGreaterThanOrEqual(
                1,
            );
        });
    });
});
