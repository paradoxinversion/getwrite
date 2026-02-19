import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CreateResourceModal from "../components/Tree/CreateResourceModal";

describe("CreateResourceModal", () => {
    it("calls onCreate with entered title and type", () => {
        const onCreate = vi.fn();
        const onClose = vi.fn();

        render(
            <CreateResourceModal
                isOpen={true}
                initialTitle={""}
                initialType={"document"}
                parentId={"parent_1"}
                onCreate={onCreate}
                onClose={onClose}
            />,
        );

        const titleInput = screen.getByLabelText(
            "resource-title",
        ) as HTMLInputElement;
        fireEvent.change(titleInput, { target: { value: "New Test" } });

        const typeSelect = screen.getByLabelText(
            "resource-type",
        ) as HTMLSelectElement;
        fireEvent.change(typeSelect, { target: { value: "note" } });

        const createBtn = screen.getByText("Create");
        fireEvent.click(createBtn);

        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onCreate).toHaveBeenCalledWith(
            { title: "New Test", type: "note" },
            "parent_1",
        );
    });
});
