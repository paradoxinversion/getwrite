import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CompilePreviewModal from "../components/common/CompilePreviewModal";
import type { Resource } from "../lib/types";

describe("CompilePreviewModal", () => {
    it("renders preview and calls onConfirm", () => {
        const onConfirm = vi.fn();
        const onClose = vi.fn();

        const resource: Resource = {
            id: "r1",
            projectId: "p1",
            title: "Test Doc",
            type: "document",
            createdAt: "",
            updatedAt: "",
            metadata: {},
        };

        render(
            <CompilePreviewModal
                isOpen={true}
                resource={resource}
                resources={[]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByText("Compile Preview")).toBeInTheDocument();
        const textarea = screen.getByLabelText(
            "compile-preview",
        ) as HTMLTextAreaElement;
        expect(textarea.value).toContain("Test Doc");

        const confirmBtn = screen.getByText("Confirm");
        fireEvent.click(confirmBtn);

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
