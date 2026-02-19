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

    const results = query
        ? resources.filter((r) =>
              r.title.toLowerCase().includes(query.toLowerCase()),
          )
        : [];

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
                    {results.slice(0, 8).map((r, i) => (
                        <li key={r.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect?.(r.id);
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${i === highlight ? "bg-slate-100" : ""}`}
                            >
                                {r.title}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
