import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OrganizerView from "../components/WorkArea/OrganizerView";
import { createProject } from "../lib/placeholders";

describe("OrganizerView", () => {
    it("renders header, toggle and a card per resource", () => {
        const resources = createProject("P").resources;
        render(<OrganizerView resources={resources} showBody={true} />);

        expect(screen.getByText(/Organizer/i)).toBeTruthy();
        // there should be as many headings (resource titles) as resources
        const headings = screen.getAllByRole("heading", { level: 3 });
        expect(headings.length).toBe(resources.length);
    });

    it("calls onToggleBody when toggle button is clicked", () => {
        const resources = createProject("P").resources;
        const onToggle = vi.fn();
        render(
            <OrganizerView
                resources={resources}
                showBody={true}
                onToggleBody={onToggle}
            />,
        );

        const button = screen.getByRole("button", {
            name: /Hide bodies|Show bodies/i,
        });
        fireEvent.click(button);
        expect(onToggle).toHaveBeenCalled();
    });
});
