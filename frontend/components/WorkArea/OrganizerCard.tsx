import React from "react";
import type { Resource } from "../../lib/types";

export interface OrganizerCardProps {
    resource: Resource;
    showBody?: boolean;
}

/**
 * Presentational card for a single `Resource` used by `OrganizerView`.
 * Keeps markup small and re-usable; uses project utilities where applicable.
 */
export default function OrganizerCard({
    resource,
    showBody = true,
}: OrganizerCardProps): JSX.Element {
    return (
        <article
            className="border rounded-md p-4 bg-white shadow-card"
            aria-labelledby={`res-${resource.id}-title`}
        >
            <header className="flex items-center justify-between mb-2">
                <div>
                    <h3
                        id={`res-${resource.id}-title`}
                        className="text-sm font-medium"
                    >
                        {resource.title}
                    </h3>
                    <div className="text-xs text-slate-500">
                        {resource.type}
                    </div>
                </div>
                <div className="text-xs text-slate-600">
                    {new Date(resource.updatedAt).toLocaleDateString()}
                </div>
            </header>

            {showBody && (
                <div className="text-sm text-slate-700 mb-3 truncate-2">
                    {resource.content}
                </div>
            )}

            <footer className="text-xs text-slate-500 flex items-center justify-between">
                <div>Words: {resource.metadata?.wordCount ?? 0}</div>
                <div>Status: {resource.metadata?.status ?? "unknown"}</div>
            </footer>
        </article>
    );
}
