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
});
