import React from "react";
import type { Resource } from "../../lib/types";

export interface CompilePreviewModalProps {
    isOpen: boolean;
    resource?: Resource | null;
    resources?: Resource[];
    preview?: string;
    onClose?: () => void;
    onConfirm?: () => void;
}

export default function CompilePreviewModal({
    isOpen,
    resource,
    resources = [],
    preview,
    onClose,
    onConfirm,
}: CompilePreviewModalProps): JSX.Element | null {
    if (!isOpen) return null;

    const computed =
        preview ??
        (resource
            ? `Compiled package for ${resource.title}\n\n` +
              JSON.stringify(resource, null, 2)
            : `Compiled project bundle\n\n` +
              JSON.stringify(resources, null, 2));

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div
                className="fixed inset-0 bg-black/40"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="z-70 bg-white rounded-md shadow-lg max-w-3xl w-full p-6">
                <h3 className="text-lg font-medium">Compile Preview</h3>
                <p className="mt-2 text-sm text-slate-600">
                    This is a UI-only preview of a compiled package for the
                    selected resource or project.
                </p>

                <div className="mt-4">
                    <textarea
                        readOnly
                        value={computed}
                        className="w-full h-64 border rounded p-2 font-mono text-xs"
                        aria-label="compile-preview"
                    />
                </div>

                <div className="mt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded border"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm?.();
                            onClose?.();
                        }}
                        className="px-3 py-1 rounded bg-brand-500 text-white"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
