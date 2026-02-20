import React, { useEffect, useRef, useState } from "react";
import type { Resource } from "../../lib/types";

export interface SearchBarProps {
    resources?: Resource[];
    placeholder?: string;
    onSelect?: (id: string) => void;
}

export default function SearchBar({
    resources = [],
    placeholder = "Search resources...",
    onSelect,
}: SearchBarProps): JSX.Element {
    const [query, setQuery] = useState<string>("");
    const [open, setOpen] = useState<boolean>(false);
    const [highlight, setHighlight] = useState<number>(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Lightweight fuzzy scoring: prefer exact substring matches, then
    // subsequence matches where characters appear in order. Returns an
    // object with `score` (higher means better) and `indices` of matched
    // characters in the title for highlighting.
    const fuzzyMatch = (
        q: string,
        text: string,
    ): { score: number; indices: number[] } | null => {
        if (!q) return null;
        const ql = q.toLowerCase();
        const tl = text.toLowerCase();

        // Exact substring check
        const idx = tl.indexOf(ql);
        if (idx !== -1) {
            // give high score, earlier matches rank higher
            const indices: number[] = [];
            for (let i = idx; i < idx + ql.length; i += 1) indices.push(i);
            return { score: 100 - idx, indices };
        }

        // Subsequence match (chars in order, possibly non-contiguous)
        const indices: number[] = [];
        let pos = 0;
        for (let i = 0; i < ql.length; i += 1) {
            const ch = ql[i];
            const found = tl.indexOf(ch, pos);
            if (found === -1) return null;
            indices.push(found);
            pos = found + 1;
        }

        // score inversely proportional to total gaps: contiguous is better
        let gaps = 0;
        for (let i = 1; i < indices.length; i += 1)
            gaps += indices[i] - indices[i - 1] - 1;
        const score = Math.max(1, 80 - gaps);
        return { score, indices };
    };

    const results = query
        ? (resources
              .map((r) => {
                  const match = fuzzyMatch(query, r.title);
                  return match ? { resource: r, match } : null;
              })
              .filter(Boolean) as {
              resource: Resource;
              match: { score: number; indices: number[] };
          }[])
        : [];

    // Sort by descending score, then by title
    results.sort((a, b) => {
        if (b.match.score !== a.match.score)
            return b.match.score - a.match.score;
        return a.resource.title.localeCompare(b.resource.title);
    });

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    useEffect(() => setHighlight(0), [query]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open) return;
        if (e.key === "ArrowDown") {
            setHighlight((h) => Math.min(h + 1, results.length - 1));
            e.preventDefault();
        } else if (e.key === "ArrowUp") {
            setHighlight((h) => Math.max(h - 1, 0));
            e.preventDefault();
        } else if (e.key === "Enter") {
            const r = results[highlight];
            if (r) {
                onSelect?.(r.id);
                setOpen(false);
                setQuery("");
            }
            e.preventDefault();
        } else if (e.key === "Escape") {
            setOpen(false);
            e.preventDefault();
        }
    };

    const renderHighlighted = (text: string, indices: number[]) => {
        if (!indices || indices.length === 0) return <>{text}</>;
        const parts: React.ReactNode[] = [];
        let last = 0;
        const set = new Set(indices);
        for (let i = 0; i < text.length; i += 1) {
            if (set.has(i)) {
                if (last < i)
                    parts.push(
                        <span key={`t-${last}`}>{text.slice(last, i)}</span>,
                    );
                parts.push(
                    <span key={`h-${i}`} className="font-semibold">
                        {text[i]}
                    </span>,
                );
                last = i + 1;
            }
        }
        if (last < text.length)
            parts.push(<span key={`t-last`}>{text.slice(last)}</span>);
        return <>{parts}</>;
    };

    return (
        <div className="relative w-full max-w-md" ref={containerRef}>
            <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(e.target.value.length > 0);
                }}
                onFocus={() => setOpen(query.length > 0)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label="resource-search"
                className="w-full border rounded px-2 py-1"
            />

            {open && results.length > 0 ? (
                <ul className="absolute z-50 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto text-sm">
                    {results.slice(0, 8).map(({ resource, match }, i) => (
                        <li key={resource.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect?.(resource.id);
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${i === highlight ? "bg-slate-100" : ""}`}
                            >
                                {renderHighlighted(
                                    resource.title,
                                    match.indices,
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
