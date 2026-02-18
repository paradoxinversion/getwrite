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

/** Internal tree node used to build parent/child relationships for rendering. */
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

/**
 * Render a minimal resource tree with:
 * - hierarchical grouping by `parentId`
 * - deterministic ordering (alphabetical or `localOrder` when reorderable)
 * - expand/collapse behavior stored in local state
 * - selection via `onSelect(id)`
 *
 * Important: this component is UI-only and does not mutate external data. When
 * `reorderable` is true it maintains a `localOrder` array and calls `onReorder`
 * with the new id order (visual-only; caller should persist if needed).
 *
 * Accessibility notes:
 * - `role="tree"`/`role="group"` used; expand toggles have `aria-label` (Expand/Collapse).
 * - Keyboard navigation is currently minimal; add arrow-key support in T030.
 */
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

    /** Toggle expanded state for a node id (local UI state). */
    const toggle = (id: string) => {
        setExpanded((s) => ({ ...s, [id]: !s[id] }));
    };

    // Drag state
    // Drag state: stores the id of the currently dragged node.
    const dragIdRef = React.useRef<string | null>(null);

    /**
     * Set drag source id and configure DataTransfer. May noop in jsdom.
     */
    const handleDragStart = (e: React.DragEvent, id: string) => {
        dragIdRef.current = id;
        e.dataTransfer.effectAllowed = "move";
        try {
            e.dataTransfer.setData("text/plain", id);
        } catch (_err) {
            // ignore in environments that don't support it (tests)
        }
    };

    /** Prevent default to allow drop; sets dropEffect to 'move'. */
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    /**
     * Compute new `localOrder` by moving source id to target position,
     * updates local state and invokes `onReorder`. Ignores invalid moves.
     */
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

    /** Render a single TreeNode recursively. `depth` controls left padding. */
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
                        role="treeitem"
                        aria-expanded={hasChildren ? isExpanded : undefined}
                        aria-label={
                            hasChildren
                                ? isExpanded
                                    ? "Collapse"
                                    : "Expand"
                                : undefined
                        }
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() =>
                            hasChildren
                                ? toggle(node.resource.id)
                                : onSelect?.(node.resource.id)
                        }
                        onKeyDown={(e) => {
                            const nav = e.currentTarget.closest("nav");
                            const items = nav
                                ? (Array.from(
                                      nav.querySelectorAll('[role="treeitem"]'),
                                  ) as HTMLElement[])
                                : [];
                            const idx = items.indexOf(
                                e.currentTarget as HTMLElement,
                            );
                            if (e.key === "ArrowDown") {
                                const next =
                                    items[idx + 1] ?? items[items.length - 1];
                                next?.focus();
                                e.preventDefault();
                            } else if (e.key === "ArrowUp") {
                                const prev = items[idx - 1] ?? items[0];
                                prev?.focus();
                                e.preventDefault();
                            } else if (e.key === "ArrowRight") {
                                if (hasChildren && !isExpanded) {
                                    toggle(node.resource.id);
                                } else if (hasChildren && isExpanded) {
                                    // focus first child
                                    const next = items[idx + 1];
                                    next?.focus();
                                }
                                e.preventDefault();
                            } else if (e.key === "ArrowLeft") {
                                if (hasChildren && isExpanded) {
                                    toggle(node.resource.id);
                                } else {
                                    // try to focus parent (best-effort)
                                    // fall back to previous item
                                    const prev = items[idx - 1];
                                    prev?.focus();
                                }
                                e.preventDefault();
                            } else if (e.key === "Enter" || e.key === " ") {
                                if (hasChildren) toggle(node.resource.id);
                                else onSelect?.(node.resource.id);
                                e.preventDefault();
                            }
                        }}
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
