import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewSwitcher from "../components/WorkArea/ViewSwitcher";

describe("ViewSwitcher", () => {
    it("renders all view buttons and calls onChange when clicked", () => {
        const onChange = vi.fn();
        render(<ViewSwitcher view="edit" onChange={onChange} />);

        const organizer = screen.getByRole("tab", { name: /Organizer/i });
        expect(organizer).toBeTruthy();

        fireEvent.click(organizer);
        expect(onChange).toHaveBeenCalledWith("organizer");

        const dataBtn = screen.getByRole("tab", { name: /Data/i });
        fireEvent.click(dataBtn);
        expect(onChange).toHaveBeenCalledWith("data");
    });
});
