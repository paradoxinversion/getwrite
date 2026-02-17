import React, { useEffect, useRef } from "react";

export interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    isOpen,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
}: ConfirmDialogProps): JSX.Element | null {
    const confirmRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            // focus confirm button for quick keyboard action
            setTimeout(() => confirmRef.current?.focus(), 50);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="fixed inset-0 bg-black/40"
                onClick={onCancel}
                aria-hidden="true"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                className="z-10 bg-white rounded-md shadow-lg max-w-lg w-full p-6"
            >
                <h3 id="confirm-dialog-title" className="text-lg font-medium">
                    {title}
                </h3>
                {description ? (
                    <p className="mt-2 text-sm text-slate-600">{description}</p>
                ) : null}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1 rounded border"
                    >
                        {cancelLabel}
                    </button>

                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={onConfirm}
                        className="px-3 py-1 rounded bg-red-600 text-white"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
