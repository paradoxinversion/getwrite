import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ResourceContextMenu from "../components/Tree/ResourceContextMenu";

describe("ResourceContextMenu", () => {
    it("renders menu items and calls onAction for delete", () => {
        const onAction = vi.fn();
        const onClose = vi.fn();
        render(
            <ResourceContextMenu
                open
                x={10}
                y={10}
                resourceId="res_test"
                resourceTitle="Test Resource"
                onAction={onAction}
                onClose={onClose}
            />,
        );

        const deleteBtn = screen.getByText("Delete");
        expect(deleteBtn).toBeTruthy();

        fireEvent.click(deleteBtn);
        expect(onAction).toHaveBeenCalledWith("delete", "res_test");
        expect(onClose).toHaveBeenCalled();
    });

    it("closes on outside mousedown", () => {
        const onClose = vi.fn();
        render(
            <ResourceContextMenu
                open
                x={10}
                y={10}
                resourceId="res_test"
                resourceTitle="Test Resource"
                onClose={onClose}
            />,
        );

        const menu = screen.getByRole("menu");
        expect(menu).toBeTruthy();

        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalled();
    });

    it("does not close when clicking inside the menu", () => {
        const onClose = vi.fn();
        render(
            <ResourceContextMenu
                open
                x={10}
                y={10}
                resourceId="res_test"
                resourceTitle="Test Resource"
                onClose={onClose}
            />,
        );

        const createBtn = screen.getByText("Create");
        fireEvent.mouseDown(createBtn);
        expect(onClose).not.toHaveBeenCalled();
    });
});
