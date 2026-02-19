import React, { useEffect, useRef } from "react";

/** Allowed context menu actions exposed to callers; UI-only signals. */
export type ResourceContextAction =
    | "create"
    | "copy"
    | "duplicate"
    | "delete"
    | "export";

/**
 * Props controlling visibility, position (`x`,`y`), and callbacks.
 * `onAction` is invoked with the selected `ResourceContextAction`.
 */
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

/**
 * Positionable context menu for a resource with five placeholder actions.
 * - Renders at fixed `left: x, top: y` when `open` is true.
 * - Adds a document `mousedown` listener to close on outside click (cleaned up on unmount).
 * - Calls `onAction(action, resourceId)` then `onClose`.
 *
 * Accessibility notes: `role="menu"` and `role="menuitem"` are used; callers should ensure keyboard focus is managed (future T030).
 */
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
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const root = containerRef.current;
        function onDocumentClick(e: MouseEvent) {
            // only close when clicking outside the menu
            if (!root) return;
            const target = e.target as Node | null;
            if (target && root.contains(target)) return;
            onClose?.();
        }

        if (open) {
            // attach in capture phase to ensure we observe clicks before other handlers
            document.addEventListener("mousedown", onDocumentClick, {
                capture: true,
            });
            return () =>
                document.removeEventListener("mousedown", onDocumentClick, {
                    capture: true,
                } as EventListenerOptions);
        }
        return undefined;
    }, [open, onClose]);

    const handle = (action: ResourceContextAction) => {
        onAction?.(action, resourceId);
        onClose?.();
    };

    // Focus management: focus the first menu item when opened and allow
    // arrow-key navigation + Escape to close.
    useEffect(() => {
        if (!open) return;
        const root = containerRef.current;
        if (!root) return;
        const items = Array.from(
            root.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        );
        items[0]?.focus();

        function onKey(e: KeyboardEvent) {
            const active = document.activeElement as HTMLElement | null;
            const idx = items.indexOf(active as HTMLElement);
            if (e.key === "ArrowDown") {
                const next = items[idx + 1] ?? items[0];
                next?.focus();
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                const prev = items[idx - 1] ?? items[items.length - 1];
                prev?.focus();
                e.preventDefault();
            } else if (e.key === "Escape") {
                onClose?.();
                e.preventDefault();
            }
        }

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="menu"
            aria-label={
                resourceTitle ? `${resourceTitle} options` : "Resource options"
            }
            ref={containerRef}
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
