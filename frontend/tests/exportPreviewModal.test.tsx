import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExportPreviewModal from "../components/common/ExportPreviewModal";

describe("ExportPreviewModal", () => {
    it("shows preview and calls onConfirmExport when Export clicked", () => {
        const onConfirmExport = vi.fn();
        const onClose = vi.fn();

        render(
            <ExportPreviewModal
                isOpen={true}
                resourceTitle={"My Resource"}
                preview={"Preview content"}
                onConfirmExport={onConfirmExport}
                onClose={onClose}
            />,
        );

        expect(screen.getByText("Export My Resource")).toBeInTheDocument();
        expect(screen.getByText("Preview content")).toBeInTheDocument();

        const exportBtn = screen.getByText("Export");
        fireEvent.click(exportBtn);

        expect(onConfirmExport).toHaveBeenCalledTimes(1);
    });
});
