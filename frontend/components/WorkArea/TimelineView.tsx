import React from "react";
import type { Project, Resource } from "../../lib/types";
import { createProject } from "../../lib/placeholders";

export interface TimelineViewProps {
    /** Single project to scope timeline (required) */
    project?: Project;
    className?: string;
}

function groupByDate(resources: Resource[]) {
    const dated: Record<string, Resource[]> = {};
    const undated: Resource[] = [];
    resources.forEach((r) => {
        const date = r.createdAt ? r.createdAt.split("T")[0] : null;
        if (date) {
            dated[date] = dated[date] || [];
            dated[date].push(r);
        } else {
            undated.push(r);
        }
    });
    // Sort dates descending
    const dates = Object.keys(dated).sort((a, b) => (a < b ? 1 : -1));
    return { dates, dated, undated };
}

export default function TimelineView({
    project,
    projects,
    className = "",
}: TimelineViewProps) {
    const effectiveProject = React.useMemo(
        () => project ?? createProject("Sample Project"),
        [project],
    );
    const resources = React.useMemo(
        () => effectiveProject.resources,
        [effectiveProject],
    );

    const { dates, dated, undated } = React.useMemo(
        () => groupByDate(resources),
        [resources],
    );

    return (
        <div className={`p-4 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                    Timeline — {effectiveProject.name}
                </h2>
            </div>

            <div className="space-y-6">
                {dates.map((d) => (
                    <section key={d} className="bg-white border rounded-md p-3">
                        <h3 className="text-sm font-medium mb-2">{d}</h3>
                        <ul className="space-y-2">
                            {dated[d].map((r) => (
                                <li
                                    key={r.id}
                                    className="p-2 rounded hover:bg-slate-50"
                                >
                                    <div className="font-medium text-sm">
                                        {r.title}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {r.type}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}

                {undated.length > 0 && (
                    <section className="bg-white border rounded-md p-3">
                        <h3 className="text-sm font-medium mb-2">Undated</h3>
                        <ul className="space-y-2">
                            {undated.map((r) => (
                                <li
                                    key={r.id}
                                    className="p-2 rounded hover:bg-slate-50"
                                >
                                    <div className="font-medium text-sm">
                                        {r.title}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {r.type}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}
