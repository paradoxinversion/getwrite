import React, { useEffect, useRef, useState } from "react";

export interface RenameProjectModalProps {
    isOpen: boolean;
    initialName?: string;
    onClose?: () => void;
    onConfirm?: (newName: string) => void;
}

export default function RenameProjectModal({
    isOpen,
    initialName = "",
    onClose,
    onConfirm,
}: RenameProjectModalProps): JSX.Element | null {
    const [name, setName] = useState<string>(initialName);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setName(initialName);
    }, [initialName, isOpen]);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
    }, [isOpen]);

    const handleSave = () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        onConfirm?.(trimmed);
        onClose?.();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="fixed inset-0 bg-black/40"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="z-10 bg-white rounded-md shadow-lg max-w-md w-full p-6">
                <h3 className="text-lg font-medium">Rename project</h3>

                <div className="p-2">
                    <label className="text-sm font-medium">Name</label>
                    <input
                        ref={inputRef}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full border rounded px-2 py-1 mt-1"
                        aria-label="rename-project-input"
                    />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded border"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-3 py-1 rounded bg-brand-500 text-white"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
