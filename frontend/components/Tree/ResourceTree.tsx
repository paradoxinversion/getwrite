import React, { useMemo, useState } from "react";
import type { Resource } from "../../lib/types";

export interface ResourceTreeProps {
    resources: Resource[];
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    className?: string;
    reorderable?: boolean;
    onReorder?: (ids: string[]) => void;
}

type TreeNode = {
    resource: Resource;
    children: TreeNode[];
};

function FolderIcon({ className = "w-4 h-4" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
            <path
                d="M3 7.5A2.5 2.5 0 015.5 5h3l1.5 2h7A2 2 0 0120 9v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7.5z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function FileIcon({ className = "w-4 h-4" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
            <path
                d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M14 3v6h6"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ChevronRight({ className = "w-3 h-3" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
            <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ChevronDown({ className = "w-3 h-3" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
            <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function ResourceTree({
    resources,
    selectedId,
    onSelect,
    className = "",
    reorderable = false,
    onReorder,
}: ResourceTreeProps) {
    const [localOrder, setLocalOrder] = useState<string[]>(() =>
        resources.map((r) => r.id),
    );

    React.useEffect(() => {
        setLocalOrder(resources.map((r) => r.id));
    }, [resources]);

    const nodes = useMemo(() => {
        const map = new Map<string, TreeNode>();
        resources.forEach((r) => map.set(r.id, { resource: r, children: [] }));
        const roots: TreeNode[] = [];
        const orderedIds = reorderable
            ? localOrder
            : resources.map((r) => r.id);
        orderedIds.forEach((id) => {
            const node = map.get(id);
            if (!node) return;
            const parentId = node.resource.parentId;
            if (parentId && map.has(parentId)) {
                map.get(parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        });
        // keep children order stable (we already used orderedIds for top-level)
        function sortRec(_nodesList: TreeNode[]) {
            return;
        }
        sortRec(roots);
        return roots;
    }, [resources, localOrder, reorderable]);

    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggle = (id: string) => {
        setExpanded((s) => ({ ...s, [id]: !s[id] }));
    };

    // Drag state
    const dragIdRef = React.useRef<string | null>(null);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        dragIdRef.current = id;
        e.dataTransfer.effectAllowed = "move";
        try {
            e.dataTransfer.setData("text/plain", id);
        } catch (_err) {
            // ignore in environments that don't support it
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const sourceId =
            dragIdRef.current ?? e.dataTransfer.getData("text/plain");
        if (!sourceId || sourceId === targetId) return;
        const from = localOrder.indexOf(sourceId);
        const to = localOrder.indexOf(targetId);
        if (from === -1 || to === -1) return;
        const next = [...localOrder];
        next.splice(from, 1);
        next.splice(to, 0, sourceId);
        setLocalOrder(next);
        onReorder?.(next);
        dragIdRef.current = null;
    };

    const renderNode = (node: TreeNode, depth = 0) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = !!expanded[node.resource.id];
        const isSelected = selectedId === node.resource.id;
        return (
            <li
                key={node.resource.id}
                className="select-none"
                draggable={reorderable}
                onDragStart={(e) => handleDragStart(e, node.resource.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, node.resource.id)}
            >
                <div
                    className={`flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700 ${isSelected ? "bg-surface-300 dark:bg-surface-800" : ""}`}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                    {reorderable ? (
                        <button
                            aria-label="Drag"
                            className="cursor-grab p-1 text-muted-500 hover:text-muted-700"
                            data-testid="drag-handle"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className="w-3 h-3"
                                fill="none"
                                aria-hidden
                            >
                                <path
                                    d="M10 6h.01M14 6h.01M10 12h.01M14 12h.01M10 18h.01M14 18h.01"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    ) : (
                        <span className="w-4" />
                    )}
                    <button
                        type="button"
                        aria-label={
                            hasChildren
                                ? isExpanded
                                    ? "Collapse"
                                    : "Expand"
                                : ""
                        }
                        onClick={() =>
                            hasChildren
                                ? toggle(node.resource.id)
                                : onSelect?.(node.resource.id)
                        }
                        className="flex items-center gap-2 text-sm text-muted-700 dark:text-muted-300"
                    >
                        <span className="flex items-center w-4 h-4">
                            {hasChildren ? (
                                isExpanded ? (
                                    <ChevronDown />
                                ) : (
                                    <ChevronRight />
                                )
                            ) : (
                                <span className="w-3" />
                            )}
                        </span>
                        <span className="flex items-center gap-2">
                            {node.resource.type === "folder" ? (
                                <FolderIcon />
                            ) : (
                                <FileIcon />
                            )}
                        </span>
                        <span
                            onClick={() => onSelect?.(node.resource.id)}
                            className={`ml-1 truncate max-w-[200px] ${isSelected ? "font-semibold" : ""}`}
                        >
                            {node.resource.title}
                        </span>
                    </button>
                </div>
                {hasChildren && isExpanded ? (
                    <ul className="mt-1" role="group">
                        {node.children.map((c) => renderNode(c, depth + 1))}
                    </ul>
                ) : null}
            </li>
        );
    };

    return (
        <nav
            className={`w-full text-sm ${className}`}
            aria-label="Resource tree"
        >
            <ul className="space-y-1" role="tree">
                {nodes.map((n) => renderNode(n, 0))}
            </ul>
        </nav>
    );
}
