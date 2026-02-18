import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DataView from "../components/WorkArea/DataView";
import { sampleProjects } from "../lib/placeholders";

describe("DataView", () => {
    it("shows project/resource counts and lists resources", () => {
        const projects = sampleProjects(2);
        render(<DataView projects={projects} />);

        // Explicit stat checks
        const getStatValue = (label: string) => {
            const labelEl = screen.getByText(label, { exact: false });
            const parent = labelEl.parentElement;
            if (!parent) return null;
            const valueEl = parent.querySelector(".text-xl");
            return valueEl ? (valueEl.textContent?.trim() ?? null) : null;
        };

        expect(getStatValue("Projects")).toBe("2");
        expect(getStatValue("Resources")).toBe("6");

        // Resources list contains sample titles (appear at least once)
        projects
            .flatMap((p) => p.resources)
            .forEach((r) => {
                expect(
                    screen.getAllByText(r.title).length,
                ).toBeGreaterThanOrEqual(1);
            });
    });
});
it("shows project/resource counts and lists resources for a single project", () => {
    const projects = sampleProjects(1);
    const project = projects[0];
    render(<DataView project={project} />);

    // Explicit stat checks for single project
    const getStatValue = (label: string) => {
        const labelEl = screen.getByText(label, { exact: false });
        const parent = labelEl.parentElement;
        if (!parent) return null;
        const valueEl = parent.querySelector(".text-xl");
        return valueEl ? (valueEl.textContent?.trim() ?? null) : null;
    };

    expect(getStatValue("Projects")).toBe("1");
    expect(getStatValue("Resources")).toBe("3");

    // Resources list contains sample titles from the single project
    project.resources.forEach((r) => {
        expect(screen.getAllByText(r.title).length).toBeGreaterThanOrEqual(1);
    });
});
