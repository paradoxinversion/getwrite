import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DataView from "../components/WorkArea/DataView";
import { sampleProjects } from "../lib/placeholders";

describe("DataView", () => {
    it("shows project/resource counts and lists resources", () => {
        const projects = sampleProjects(2);
        render(<DataView projects={projects} />);

        // Projects count
        expect(screen.getByText(/Projects/i)).toBeTruthy();
        expect(screen.getByText("2")).toBeTruthy();

        // Resources list contains sample titles
        projects
            .flatMap((p) => p.resources)
            .forEach((r) => {
                expect(screen.getByText(r.title)).toBeTruthy();
            });
    });
});
it("shows project/resource counts and lists resources for a single project", () => {
    const projects = sampleProjects(1);
    const project = projects[0];
    render(<DataView project={project} />);

    // Projects count should be 1
    expect(screen.getByText(/Projects/i)).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();

    // Resources list contains sample titles from the single project
    project.resources.forEach((r) => {
        expect(screen.getByText(r.title)).toBeTruthy();
    });
});
