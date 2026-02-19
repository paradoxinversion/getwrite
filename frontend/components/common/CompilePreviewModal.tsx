import React, { useEffect, useMemo, useState } from "react";
import type { Resource } from "../../lib/types";

export interface CompilePreviewModalProps {
    isOpen: boolean;
    projectId: string;
    resources?: Resource[];
    onClose?: () => void;
    /** Called with selected resource ids to include in the package. */
    onConfirmCompile?: (selectedIds: string[]) => void;
}

export default function CompilePreviewModal(
    props: CompilePreviewModalProps & {
        resource?: Resource;
        onConfirm?: () => void;
    },
): JSX.Element | null {
    const {
        isOpen,
        projectId,
        resources = [],
        onClose,
        onConfirmCompile,
        resource,
        onConfirm,
    } = props;
    const [scope, setScope] = useState<"project" | "folder" | "resource">(
        "project",
    );
    const folderOptions = resources.filter((r) => r.type === "folder");
    const [selectedFolder, setSelectedFolder] = useState<string | "">("");
    const [selectedResource, setSelectedResource] = useState<string | "">("");
    const [selectedIds, setSelectedIds] = useState<string[]>(
        resources.map((r) => r.id),
    );
    const [preview, setPreview] = useState<string>("");

    // Backwards compatible: if a single `resource` prop was provided by older
    // callers, pre-select it and generate a preview automatically.
    useEffect(() => {
        if (isOpen) {
            setScope("project");
            setSelectedFolder("");
            setSelectedResource("");
            setSelectedIds(resources.map((r) => r.id));
            setPreview("");
        }
    }, [isOpen, resources]);

    // If a legacy single `resource` prop was passed, auto-populate preview
    // so older callers/tests that expect immediate content continue to work.
    useEffect(() => {
        if (isOpen && resource) {
            setScope("resource");
            setSelectedResource(resource.id);
            setSelectedIds([resource.id]);
            const text = `Compiled package for project ${projectId}\n\nIncluded resources:\n- ${resource.title} (${resource.type})`;
            setPreview(text);
        }
    }, [isOpen, resource, projectId]);

    // Build parent->children map for descendant lookup
    const childrenMap = useMemo(() => {
        const map = new Map<string, string[]>();
        resources.forEach((r) => {
            if (r.parentId) {
                const arr = map.get(r.parentId) ?? [];
                arr.push(r.id);
                map.set(r.parentId, arr);
            }
        });
        return map;
    }, [resources]);

    const getDescendants = (id: string) => {
        const out: string[] = [];
        const walk = (cur: string) => {
            const kids = childrenMap.get(cur) ?? [];
            kids.forEach((k) => {
                out.push(k);
                walk(k);
            });
        };
        walk(id);
        return out;
    };

    const generatePreview = () => {
        let ids: string[] = [];
        if (scope === "project") {
            ids = resources.map((r) => r.id);
        } else if (scope === "folder") {
            if (selectedFolder)
                ids = [selectedFolder, ...getDescendants(selectedFolder)];
            else ids = [];
        } else if (scope === "resource") {
            ids = selectedResource ? [selectedResource] : [];
        }

        const included = resources.filter((r) => ids.includes(r.id));
        const text = `Compiled package for project ${projectId}\n\nIncluded resources:\n${included
            .map((r) => `- ${r.title} (${r.type})`)
            .join("\n")}`;
        setSelectedIds(ids);
        setPreview(text);
    };

    // Legacy compatibility: accept a single `resource` prop and an `onConfirm`
    // callback. If `resource` is provided, auto-select it and generate
    // preview so older tests/components keep working.
    // We don't add `resource` to props interface formally above to avoid
    // changing current callers, but support it via `any`-style access.
    // However TypeScript callers can still pass it; ensure runtime handling.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeResource = undefined as any as Resource | undefined;

    if (!isOpen) return null;

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
                    Choose a scope and generate a visual-only compiled package
                    preview.
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm font-medium">Scope</label>
                        <select
                            value={scope}
                            onChange={(e) => setScope(e.target.value as any)}
                            className="w-full border rounded px-2 py-1 mt-1"
                            aria-label="compile-scope"
                        >
                            <option value="project">Entire project</option>
                            <option value="folder">Folder</option>
                            <option value="resource">Single resource</option>
                        </select>
                    </div>

                    {scope === "folder" ? (
                        <div>
                            <label className="text-sm font-medium">
                                Folder
                            </label>
                            <select
                                value={selectedFolder}
                                onChange={(e) =>
                                    setSelectedFolder(e.target.value)
                                }
                                className="w-full border rounded px-2 py-1 mt-1"
                                aria-label="compile-folder"
                            >
                                <option value="">(select folder)</option>
                                {folderOptions.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}

                    {scope === "resource" ? (
                        <div>
                            <label className="text-sm font-medium">
                                Resource
                            </label>
                            <select
                                value={selectedResource}
                                onChange={(e) =>
                                    setSelectedResource(e.target.value)
                                }
                                className="w-full border rounded px-2 py-1 mt-1"
                                aria-label="compile-resource"
                            >
                                <option value="">(select resource)</option>
                                {resources.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}
                </div>

                <div className="mt-4">
                    <button
                        type="button"
                        onClick={generatePreview}
                        className="px-3 py-1 rounded bg-slate-100"
                    >
                        Generate preview
                    </button>
                </div>

                <div className="mt-4">
                    <textarea
                        readOnly
                        value={preview}
                        className="w-full h-64 border rounded p-2 font-mono text-xs"
                        aria-label="compile-preview"
                    />
                </div>

                <div className="mt-4 flex justify-between items-center">
                    <div className="text-xs text-slate-600">
                        {selectedIds.length} resource(s) selected
                    </div>
                    <div className="flex justify-end gap-3">
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
                                onConfirmCompile?.(selectedIds);
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
        </div>
    );
}
