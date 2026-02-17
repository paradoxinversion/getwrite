import React from "react";
import type { Project } from "../../lib/types";
import { sampleProjects } from "../../lib/placeholders";

export interface StartPageProps {
    projects?: Project[];
    onCreate?: (name: string) => void;
    onOpen?: (projectId: string) => void;
}

export default function StartPage({
    projects = sampleProjects(3),
    onCreate,
    onOpen,
}: StartPageProps): JSX.Element {
    const handleCreate = (): void => {
        if (onCreate) onCreate("New Project");
        // placeholder behaviour: could open a modal in future
    };

    const handleOpen = (id: string): void => {
        if (onOpen) onOpen(id);
        // placeholder: no routing implemented in this milestone
    };

    return (
        <section aria-labelledby="start-projects" className="p-6">
            <div className="flex items-center justify-between">
                <h1 id="start-projects" className="text-2xl font-semibold">
                    Projects
                </h1>
                <button
                    type="button"
                    onClick={handleCreate}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-500 text-white rounded hover:opacity-95"
                >
                    New Project
                </button>
            </div>

            <div className="mt-6 grid gap-4">
                {projects.map((p) => (
                    <article
                        key={p.id}
                        className="rounded bg-white p-4 shadow-card border flex items-start justify-between"
                        aria-labelledby={`proj-${p.id}-title`}
                    >
                        <div>
                            <h2
                                id={`proj-${p.id}-title`}
                                className="font-medium"
                            >
                                {p.name}
                            </h2>
                            {p.description ? (
                                <p className="text-sm text-slate-600 mt-1 truncate-2">
                                    {p.description}
                                </p>
                            ) : null}
                            <div className="text-xs text-slate-500 mt-2">
                                {p.resources.length} resources
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => handleOpen(p.id)}
                                className="px-3 py-1 rounded border text-sm bg-slate-50 hover:bg-slate-100"
                            >
                                Open
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
