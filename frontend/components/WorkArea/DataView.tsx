import React from "react";
import type { Project, Resource } from "../../lib/types";
import { createProject } from "../../lib/placeholders";

export interface DataViewProps {
    /** Optional list of projects to show aggregate statistics for */
    projects?: Project[];
    /** The single project to display statistics for (used when `projects` is not provided) */
    project?: Project;
    /** Optional override flat list of resources to render (uses project(s).resources by default) */
    resources?: Resource[];
    className?: string;
}

/**
 * `DataView` renders statistics scoped to a single project and a simple
 * resource list. When `project` is omitted a placeholder project is used so
 * the component remains usable in isolation.
 */
export default function DataView({
    projects,
    project,
    resources,
    className = "",
}: DataViewProps): JSX.Element {
    const effectiveProject = React.useMemo(
        () => project ?? createProject("Sample Project"),
        [project],
    );

    const flatResources = React.useMemo(() => {
        if (resources) return resources;
        if (projects && projects.length > 0)
            return projects.flatMap((p) => p.resources);
        return effectiveProject.resources;
    }, [resources, projects, effectiveProject]);

    const totalResources = flatResources.length;
    const totalWords = flatResources.reduce(
        (acc, r) => acc + (r.metadata?.wordCount ?? 0),
        0,
    );

    const projectsCount = projects ? projects.length : project ? 1 : 1;

    return (
        <div className={`p-4 ${className}`}>
            <h2 className="text-lg font-semibold mb-4">
                Data — {effectiveProject.name}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-3 bg-white rounded-md border text-sm">
                    <div className="text-slate-500">Projects</div>
                    <div className="text-xl font-medium">{projectsCount}</div>
                </div>
                <div className="p-3 bg-white rounded-md border text-sm">
                    <div className="text-slate-500">Resources</div>
                    <div className="text-xl font-medium">{totalResources}</div>
                </div>
                <div className="p-3 bg-white rounded-md border text-sm">
                    <div className="text-slate-500">Total words</div>
                    <div className="text-xl font-medium">{totalWords}</div>
                </div>
            </div>

            <section>
                <h3 className="text-sm font-medium mb-2">Resources</h3>
                <ul className="space-y-2">
                    {flatResources.map((r) => (
                        <li
                            key={r.id}
                            className="p-3 bg-white rounded-md border flex items-center justify-between"
                        >
                            <div>
                                <div className="text-sm font-medium">
                                    {r.title}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {r.type}
                                </div>
                            </div>
                            <div className="text-xs text-slate-500">
                                {r.metadata?.wordCount ?? 0} words
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
