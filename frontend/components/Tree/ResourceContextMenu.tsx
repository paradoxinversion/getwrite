import React, { useEffect } from "react";

export type ResourceContextAction =
    | "create"
    | "copy"
    | "duplicate"
    | "delete"
    | "export";

export interface ResourceContextMenuProps {
    open: boolean;
    x?: number;
    y?: number;
    resourceId?: string;
    resourceTitle?: string;
    onClose?: () => void;
    onAction?: (action: ResourceContextAction, resourceId?: string) => void;
    className?: string;
}

export default function ResourceContextMenu({
    open,
    x = 0,
    y = 0,
    resourceId,
    resourceTitle,
    onClose,
    onAction,
    className = "",
}: ResourceContextMenuProps) {
    useEffect(() => {
        function onDocumentClick(e: MouseEvent) {
            // close on outside click
            onClose?.();
        }

        if (open) {
            document.addEventListener("mousedown", onDocumentClick);
            return () =>
                document.removeEventListener("mousedown", onDocumentClick);
        }
        return undefined;
    }, [open, onClose]);

    if (!open) return null;

    const handle = (action: ResourceContextAction) => {
        onAction?.(action, resourceId);
        onClose?.();
    };

    return (
        <div
            role="menu"
            aria-label={
                resourceTitle ? `${resourceTitle} options` : "Resource options"
            }
            className={`absolute z-50 min-w-[160px] rounded-md bg-white dark:bg-surface-800 shadow-md ring-1 ring-black/5 ${className}`}
            style={{ left: x, top: y }}
        >
            <ul className="py-1">
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700"
                        onClick={() => handle("create")}
                    >
                        Create
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700"
                        onClick={() => handle("copy")}
                    >
                        Copy
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700"
                        onClick={() => handle("duplicate")}
                    >
                        Duplicate
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-surface-100 dark:hover:bg-surface-700"
                        onClick={() => handle("delete")}
                    >
                        Delete
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700"
                        onClick={() => handle("export")}
                    >
                        Export
                    </button>
                </li>
            </ul>
        </div>
    );
}
