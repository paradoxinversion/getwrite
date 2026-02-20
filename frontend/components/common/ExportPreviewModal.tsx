import React from "react";
import ConfirmDialog from "./ConfirmDialog";

export interface ExportPreviewModalProps {
    isOpen: boolean;
    resourceTitle?: string;
    preview?: string;
    onClose?: () => void;
    onConfirmExport?: () => void;
    onShowCompile?: () => void;
}

export default function ExportPreviewModal({
    isOpen,
    resourceTitle,
    preview,
    onClose,
    onConfirmExport,
    onShowCompile,
}: ExportPreviewModalProps): JSX.Element | null {
    if (!isOpen) return null;

    return (
        <>
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

            {onShowCompile ? (
                <div className="fixed bottom-6 right-6 z-[60]">
                    <button
                        type="button"
                        className="px-3 py-2 rounded bg-slate-700 text-white"
                        onClick={() => onShowCompile()}
                    >
                        View compiled
                    </button>
                </div>
            ) : null}
        </>
    );
}
