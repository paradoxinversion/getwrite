import React, { useMemo, useState } from "react";
import type { Resource } from "../../lib/types";

export interface ResourceTreeProps {
    resources: Resource[];
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    className?: string;
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
}: ResourceTreeProps) {
    const nodes = useMemo(() => {
        const map = new Map<string, TreeNode>();
        resources.forEach((r) => map.set(r.id, { resource: r, children: [] }));
        const roots: TreeNode[] = [];
        map.forEach((node) => {
            const parentId = node.resource.parentId;
            if (parentId && map.has(parentId)) {
                map.get(parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        });
        // sort roots and children by title for deterministic ordering
        function sortRec(nodesList: TreeNode[]) {
            nodesList.sort((a, b) =>
                a.resource.title.localeCompare(b.resource.title),
            );
            nodesList.forEach((n) => sortRec(n.children));
        }
        sortRec(roots);
        return roots;
    }, [resources]);

    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggle = (id: string) => {
        setExpanded((s) => ({ ...s, [id]: !s[id] }));
    };

    const renderNode = (node: TreeNode, depth = 0) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = !!expanded[node.resource.id];
        const isSelected = selectedId === node.resource.id;
        return (
            <li key={node.resource.id} className="select-none">
                <div
                    className={`flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700 ${isSelected ? "bg-surface-300 dark:bg-surface-800" : ""}`}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
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
