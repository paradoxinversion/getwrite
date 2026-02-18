import React from "react";
import type { Resource } from "../../lib/types";

export interface OrganizerViewProps {
    /** Resources to display as cards */
    resources: Resource[];
    /** Whether to show the body/content of each resource */
    showBody?: boolean;
    /** Callback when the user toggles body visibility */
    onToggleBody?: (show: boolean) => void;
    /** Optional className for outer container */
    className?: string;
}

/**
 * `OrganizerView` renders a simple, responsive grid of resource cards used
 * to visually browse resources. Each card shows the title, type and a small
 * metadata summary. The parent may control whether the resource body is
 * visible via `showBody` or toggle it with `onToggleBody`.
 *
 * This component is intentionally presentational and uses the `resources`
 * prop as its single source of truth.
 */
export default function OrganizerView({
    resources,
    showBody = true,
    onToggleBody,
    className = "",
}: OrganizerViewProps): JSX.Element {
    const handleToggle = React.useCallback(() => {
        if (onToggleBody) onToggleBody(!showBody);
    }, [onToggleBody, showBody]);

    return (
        <div className={`p-4 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Organizer</h2>
                <div>
                    <button
                        type="button"
                        onClick={handleToggle}
                        className="px-3 py-1 text-sm border rounded-md bg-white hover:bg-slate-50"
                    >
                        {showBody ? "Hide bodies" : "Show bodies"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((r) => (
                    <article
                        key={r.id}
                        className="border rounded-md p-4 bg-white shadow-sm"
                        aria-labelledby={`res-${r.id}-title`}
                    >
                        <header className="flex items-center justify-between mb-2">
                            <div>
                                <h3
                                    id={`res-${r.id}-title`}
                                    className="text-sm font-medium"
                                >
                                    {r.title}
                                </h3>
                                <div className="text-xs text-slate-500">
                                    {r.type}
                                </div>
                            </div>
                            <div className="text-xs text-slate-600">
                                {new Date(r.updatedAt).toLocaleDateString()}
                            </div>
                        </header>

                        {showBody && (
                            <div className="text-sm text-slate-700 mb-3">
                                {r.content}
                            </div>
                        )}

                        <footer className="text-xs text-slate-500 flex items-center justify-between">
                            <div>Words: {r.metadata?.wordCount ?? 0}</div>
                            <div>Status: {r.metadata?.status ?? "unknown"}</div>
                        </footer>
                    </article>
                ))}
            </div>
        </div>
    );
}
