import React, { useState, useRef, useEffect } from "react";
import ConfirmDialog from "../common/ConfirmDialog";

export interface ManageProjectMenuProps {
    projectId: string;
    projectName?: string;
    onRename?: (projectId: string, newName: string) => void;
    onDelete?: (projectId: string) => void;
    onPackage?: (projectId: string) => void;
}

/**
 * Callbacks: `onRename`, `onDelete`, and `onPackage`. These are UI signals; actual effects are the caller's responsibility.
 */
export default function ManageProjectMenu({
    projectId,
    projectName = "",
    onRename,
    onDelete,
    onPackage,
}: ManageProjectMenuProps): JSX.Element {
    const [open, setOpen] = useState<boolean>(false);
    const [editing, setEditing] = useState<boolean>(false);
    const [name, setName] = useState<string>(projectName);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
    const [confirmPackageOpen, setConfirmPackageOpen] =
        useState<boolean>(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }

        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, []);

    useEffect(() => {
        setName(projectName);
    }, [projectName]);

    const handleRenameSave = (): void => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (onRename) onRename(projectId, trimmed);
        setEditing(false);
        setOpen(false);
    };

    const handleDeleteConfirm = (): void => {
        if (onDelete) onDelete(projectId);
        setConfirmDeleteOpen(false);
        setOpen(false);
    };

    const handlePackageConfirm = (): void => {
        if (onPackage) onPackage(projectId);
        setConfirmPackageOpen(false);
        setOpen(false);
    };

    // Implementation notes: `menuRef` ensures outside-click detection. Rename only
    // fires `onRename` when value is non-empty.

    return (
        <div className="relative inline-block" ref={menuRef}>
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="px-2 py-1 border rounded text-sm"
            >
                •••
            </button>

            {open ? (
                <div
                    role="menu"
                    aria-label="Manage project"
                    className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-md z-20"
                >
                    <div className="p-2">
                        {editing ? (
                            <div className="flex gap-2">
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="flex-1 border rounded px-2 py-1"
                                    aria-label="Rename project"
                                />
                                <button
                                    type="button"
                                    onClick={handleRenameSave}
                                    className="px-2 py-1 bg-brand-500 text-white rounded"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditing(false)}
                                    className="px-2 py-1 border rounded"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => setEditing(true)}
                                    className="w-full text-left px-2 py-2 text-sm hover:bg-slate-50 rounded"
                                >
                                    Rename
                                </button>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => setConfirmDeleteOpen(true)}
                                    className="w-full text-left px-2 py-2 text-sm hover:bg-slate-50 rounded text-red-600"
                                >
                                    Delete
                                </button>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => setConfirmPackageOpen(true)}
                                    className="w-full text-left px-2 py-2 text-sm hover:bg-slate-50 rounded"
                                >
                                    Package
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : null}

            <ConfirmDialog
                isOpen={confirmDeleteOpen}
                title="Delete project"
                description="This will permanently remove the project and its resources. Are you sure?"
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setConfirmDeleteOpen(false)}
            />

            <ConfirmDialog
                isOpen={confirmPackageOpen}
                title="Package project"
                description="Create a downloadable package of this project (placeholder). Proceed?"
                confirmLabel="Package"
                cancelLabel="Cancel"
                onConfirm={handlePackageConfirm}
                onCancel={() => setConfirmPackageOpen(false)}
            />
        </div>
    );
}
