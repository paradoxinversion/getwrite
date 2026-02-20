import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MetadataSidebar from "../components/Sidebar/MetadataSidebar";
import { createResource } from "../lib/placeholders";

describe("MetadataSidebar", () => {
    it("renders notes and status and invokes callbacks", () => {
        const res = createResource("Notes", "note");
        const onNotes = vi.fn();
        const onStatus = vi.fn();

        render(
            <MetadataSidebar
                resource={res}
                onChangeNotes={onNotes}
                onChangeStatus={onStatus}
            />,
        );

        const notes = screen.getByLabelText("notes") as HTMLTextAreaElement;
        expect(notes).toBeInTheDocument();

        const status = screen.getByLabelText("status") as HTMLSelectElement;
        expect(status).toBeInTheDocument();

        fireEvent.change(notes, { target: { value: "Updated notes" } });
        expect(onNotes).toHaveBeenCalledWith("Updated notes");

        fireEvent.change(status, { target: { value: "review" } });
        expect(onStatus).toHaveBeenCalledWith("review");
    });
});
