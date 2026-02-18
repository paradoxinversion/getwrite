import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotesInput from "../components/Sidebar/controls/NotesInput";
import StatusSelector from "../components/Sidebar/controls/StatusSelector";
import MultiSelectList from "../components/Sidebar/controls/MultiSelectList";
import POVAutocomplete from "../components/Sidebar/controls/POVAutocomplete";

describe("Sidebar Controls", () => {
    it("NotesInput calls onChange", () => {
        const onChange = vi.fn();
        render(<NotesInput onChange={onChange} />);
        const ta = screen.getByLabelText("notes-input");
        fireEvent.change(ta, { target: { value: "hello" } });
        expect(onChange).toHaveBeenCalledWith("hello");
    });

    it("StatusSelector calls onChange", () => {
        const onChange = vi.fn();
        render(<StatusSelector onChange={onChange} />);
        const sel = screen.getByLabelText("status-select");
        fireEvent.change(sel, { target: { value: "review" } });
        expect(onChange).toHaveBeenCalledWith("review");
    });

    it("MultiSelectList toggles selection", () => {
        const onChange = vi.fn();
        render(<MultiSelectList items={["A", "B"]} onChange={onChange} />);
        const checkbox = screen.getByLabelText("A") as HTMLInputElement;
        fireEvent.click(checkbox);
        expect(onChange).toHaveBeenCalled();
    });

    it("POVAutocomplete calls onChange", () => {
        const onChange = vi.fn();
        render(<POVAutocomplete onChange={onChange} options={["X"]} />);
        const input = screen.getByLabelText("pov-input");
        fireEvent.change(input, { target: { value: "X" } });
        expect(onChange).toHaveBeenCalledWith("X");
    });
});
