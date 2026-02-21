import React, { useMemo, useState, useEffect, useRef } from "react";
import type { Resource, Project } from "../../lib/types";
import ResourceContextMenu, {
    type ResourceContextAction,
} from "./ResourceContextMenu";

export interface ResourceTreeProps {
    /** Either pass a `project` object (preferred) or a raw `resources` array. */
    project?: Project;
    resources?: Resource[];
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    className?: string;
    reorderable?: boolean;
    onReorder?: (ids: string[]) => void;
    /** Optional callback when a context-menu action is taken for a resource */
    onResourceAction?: (
        action: ResourceContextAction,
        resourceId?: string,
    ) => void;
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
    project,
    resources,
    selectedId,
    onSelect,
    className = "",
    reorderable = false,
    onReorder,
    onResourceAction,
}: ResourceTreeProps) {
    // prefer project resources when provided
    const resourcesList: Resource[] = project
        ? project.resources
        : (resources ?? []);

    const [localOrder, setLocalOrder] = useState<string[]>(() =>
        resourcesList.map((r) => r.id),
    );
    const [contextMenu, setContextMenu] = useState<{
        open: boolean;
        x: number;
        y: number;
        resourceId?: string;
        resourceTitle?: string;
    }>({ open: false, x: 0, y: 0 });

    useEffect(() => {
        setLocalOrder(resourcesList.map((r) => r.id));
    }, [resourcesList]);

    const nodes = useMemo(() => {
        const map = new Map<string, TreeNode>();
        resourcesList.forEach((r) =>
            map.set(r.id, { resource: r, children: [] }),
        );
        const roots: TreeNode[] = [];
        const orderedIds = reorderable
            ? localOrder
            : resourcesList.map((r) => r.id);
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
    const dragIdRef = useRef<string | null>(null);

    /** Set drag source id and configure DataTransfer. May noop in jsdom. */
    const handleDragStart = (e: React.DragEvent, id: string) => {
        dragIdRef.current = id;
        e.dataTransfer.effectAllowed = "move";
        try {
            e.dataTransfer.setData("text/plain", id);
        } catch (_err) {
            // ignore in environments that don't support it (tests)
        }
    };

    // Reference to the nav element so we can position a fixed footer aligned
    // to the tree's horizontal position and width without changing layout height.
    const navRef = useRef<HTMLElement | null>(null);
    const [footerRect, setFooterRect] = useState({ left: 0, width: 0 });

    useEffect(() => {
        function updateRect() {
            const el = navRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            setFooterRect({
                left: Math.round(r.left),
                width: Math.round(r.width),
            });
        }
        updateRect();
        window.addEventListener("resize", updateRect);
        return () => window.removeEventListener("resize", updateRect);
    }, []);

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
    const getFirstVisibleId = (nodesList: TreeNode[]): string | undefined => {
        if (!nodesList || nodesList.length === 0) return undefined;
        const first = nodesList[0];
        if (!first) return undefined;
        if (first.resource) return first.resource.id;
        return undefined;
    };

    const firstVisibleId = getFirstVisibleId(nodes);

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
                    style={{ paddingLeft: `${depth * 10 + 4}px` }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        // open context menu at mouse position for this resource
                        const rectX = e.clientX;
                        const rectY = e.clientY;
                        setContextMenu({
                            open: true,
                            x: rectX,
                            y: rectY,
                            resourceId: node.resource.id,
                            resourceTitle: node.resource.title,
                        });
                    }}
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
                        aria-selected={isSelected}
                        tabIndex={
                            isSelected ||
                            (!selectedId && node.resource.id === firstVisibleId)
                                ? 0
                                : -1
                        }
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
                            } else if (
                                e.key === "ContextMenu" ||
                                (e.shiftKey && e.key === "F10")
                            ) {
                                // Open the context menu for this node via keyboard
                                const rect = (
                                    e.currentTarget as HTMLElement
                                ).getBoundingClientRect();
                                setContextMenu({
                                    open: true,
                                    x: Math.round(rect.left + 8),
                                    y: Math.round(rect.top + 24),
                                    resourceId: node.resource.id,
                                    resourceTitle: node.resource.title,
                                });
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
        <>
            <nav
                ref={navRef}
                className={`w-full text-sm flex flex-col ${className}`}
                aria-label="Resource tree"
            >
                <ul className="space-y-1 overflow-auto flex-1" role="tree">
                    {nodes.map((n) => renderNode(n, 0))}
                </ul>

                <ResourceContextMenu
                    open={contextMenu.open}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    resourceId={contextMenu.resourceId}
                    resourceTitle={contextMenu.resourceTitle}
                    onClose={() =>
                        setContextMenu((s) => ({ ...s, open: false }))
                    }
                    onAction={(action, resourceId) => {
                        onResourceAction?.(action, resourceId);
                    }}
                />
            </nav>

            {/* Fixed footer aligned to tree nav rect so it sits at the bottom of the viewport */}
            {(() => {
                const selectedResource = selectedId
                    ? resourcesList.find((r) => r.id === selectedId)
                    : undefined;
                const style: React.CSSProperties = {
                    position: "fixed",
                    bottom: 0,
                    left: footerRect.left,
                    width: footerRect.width,
                    zIndex: 40,
                };
                return (
                    <div style={style} className="pointer-events-auto">
                        <div className="border-t bg-background/80 backdrop-blur-sm px-3 py-1 text-xs text-muted-700 dark:text-muted-300">
                            Selected:{" "}
                            <span className="font-medium">
                                {selectedResource
                                    ? selectedResource.title
                                    : "None"}
                            </span>
                        </div>
                    </div>
                );
            })()}
        </>
    );
}
