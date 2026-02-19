import React from "react";
import ConfirmDialog from "./ConfirmDialog";

export interface ExportPreviewModalProps {
    isOpen: boolean;
    resourceTitle?: string;
    preview?: string;
    onClose?: () => void;
    onConfirmExport?: () => void;
}

export default function ExportPreviewModal({
    isOpen,
    resourceTitle,
    preview,
    onClose,
    onConfirmExport,
}: ExportPreviewModalProps): JSX.Element | null {
    if (!isOpen) return null;

    return (
        <ConfirmDialog
            isOpen={isOpen}
            title={resourceTitle ? `Export ${resourceTitle}` : "Export"}
            description={preview ?? "Preview of export (placeholder)"}
            confirmLabel="Export"
            cancelLabel="Cancel"
            onConfirm={() => {
                onConfirmExport?.();
                onClose?.();
            }}
            onCancel={onClose ?? (() => {})}
        />
    );
}
