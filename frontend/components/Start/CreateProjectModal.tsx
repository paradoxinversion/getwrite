import React, { useEffect, useRef, useState } from "react";
import type { ResourceType } from "../../lib/types";

export interface CreateProjectPayload {
    name: string;
    projectType: string;
}

export interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (payload: CreateProjectPayload) => void;
    defaultName?: string;
    defaultType?: CreateProjectPayload["projectType"];
}

/**
 * Controlled modal that:
 * - validates non-empty name,
 * - focuses the name input on open,
 * - emits `onCreate(payload)` and closes on success.
 *
 * Note: uses `setTimeout` to focus reliably; replace with a focus-trap for T030 if needed.
 */
export default function CreateProjectModal({
    isOpen,
    onClose,
    onCreate,
    defaultName = "",
    defaultType = "novel",
}: CreateProjectModalProps): JSX.Element | null {
    const [name, setName] = useState<string>(defaultName);
    const [projectType, setProjectType] =
        useState<CreateProjectPayload["projectType"]>(defaultType);
    const [types, setTypes] = useState<
        | {
              id: string;
              name: string;
              description?: string;
          }[]
        | null
    >(null);
    const [loadingTypes, setLoadingTypes] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nameRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName(defaultName);
            setProjectType(defaultType);
            setError(null);
            // load project types when modal opens via API
            setLoadingTypes(true);
            fetch("/api/project-types")
                .then((r) => r.json())
                .then(
                    (
                        list: {
                            id: string;
                            name: string;
                            description?: string;
                        }[],
                    ) => {
                        setTypes(list);
                        if (!defaultType && list.length > 0)
                            setProjectType(list[0].id);
                    },
                )
                .catch(() => setTypes([]))
                .finally(() => setLoadingTypes(false));
            // focus the name input when opening
            setTimeout(() => nameRef.current?.focus(), 50);
            // basic focus trap: keep focus inside the form while modal is open
            const handleKeyDown = (ev: KeyboardEvent) => {
                if (ev.key === "Escape") {
                    onClose();
                    return;
                }
                if (ev.key === "Tab") {
                    const root = nameRef.current?.closest("form");
                    if (!root) return;
                    const focusable = Array.from(
                        root.querySelectorAll<HTMLElement>(
                            "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])",
                        ),
                    ).filter(Boolean);
                    if (focusable.length === 0) return;
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    if (ev.shiftKey) {
                        if (document.activeElement === first) {
                            last.focus();
                            ev.preventDefault();
                        }
                    } else {
                        if (document.activeElement === last) {
                            first.focus();
                            ev.preventDefault();
                        }
                    }
                }
            };
            document.addEventListener("keydown", handleKeyDown);
            return () => document.removeEventListener("keydown", handleKeyDown);
        }
    }, [isOpen, defaultName, defaultType]);

    if (!isOpen) return null;

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!name.trim()) {
            setError("Please enter a project name.");
            nameRef.current?.focus();
            return;
        }

        const payload: CreateProjectPayload = {
            name: name.trim(),
            projectType,
        };
        onCreate(payload);
        onClose();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
            <div
                className="fixed inset-0 bg-black/40"
                onClick={onClose}
                aria-hidden="true"
            />

            <form
                onSubmit={handleSubmit}
                className="relative bg-white rounded-lg shadow-lg w-full max-w-md z-10 p-6"
                onKeyDown={(ev) => {
                    if (ev.key === "Escape") onClose();
                }}
            >
                <h2 id="create-project-title" className="text-lg font-medium">
                    Create Project
                </h2>

                <label className="block mt-4">
                    <div className="text-sm text-slate-700">Name</div>
                    <input
                        ref={nameRef}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
                        aria-required
                    />
                </label>

                <label className="block mt-4">
                    <div className="text-sm text-slate-700">Project Type</div>
                    <select
                        value={projectType}
                        onChange={(e) =>
                            setProjectType(e.target.value as string)
                        }
                        className="mt-1 block w-full border rounded px-3 py-2"
                        disabled={loadingTypes || (types && types.length === 0)}
                    >
                        {loadingTypes ? (
                            <option>Loading...</option>
                        ) : types && types.length > 0 ? (
                            types.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                    {/* {t.description ? ` — ${t.description}` : ""} */}
                                </option>
                            ))
                        ) : (
                            <option value="">No project types available</option>
                        )}
                    </select>
                    {types && types.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1">
                            {
                                types.find((t) => t.id === projectType)
                                    ?.description
                            }
                        </div>
                    )}
                </label>

                {error ? (
                    <div className="text-sm text-red-600 mt-3">{error}</div>
                ) : null}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded border"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-3 py-1 rounded bg-brand-500 text-white"
                    >
                        Create
                    </button>
                </div>
            </form>
        </div>
    );
}
