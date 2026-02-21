import React, { useState } from "react";
import type { Project } from "../../lib/types";
import { sampleProjects, createProject } from "../../lib/placeholders";
import { buildProjectView } from "../../src/lib/models/project-view";
import CreateProjectModal, {
    type CreateProjectPayload,
} from "./CreateProjectModal";
import ManageProjectMenu from "./ManageProjectMenu";

export interface StartPageProps {
    projects?: Project[];
    onCreate?: (name: string) => void;
    onOpen?: (projectId: string) => void;
}

/** Optional `projects` prop for server-driven lists; callbacks `onCreate` and `onOpen` used by parent wiring. */
export default function StartPage({
    projects = sampleProjects(3),
    onCreate,
    onOpen,
}: StartPageProps): JSX.Element {
    const [localProjects, setLocalProjects] = useState<Project[]>(projects);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const projectViews = React.useMemo(() => {
        return localProjects.map((p) =>
            buildProjectView({
                project: p as any,
                folders: (p as any).folders ?? [],
                resources: (p as any).resources ?? [],
            }),
        );
    }, [localProjects]);

    const handleOpen = (id: string): void => {
        if (onOpen) onOpen(id);
    };

    const handleModalCreate = (payload: CreateProjectPayload): void => {
        const newProject: Project = createProject(payload.name);
        setLocalProjects((prev) => [newProject, ...prev]);
        if (onCreate) onCreate(payload.name);
        setIsModalOpen(false);
    };

    const handleCreateClick = (): void => {
        setIsModalOpen(true);
    };

    return (
        <section aria-labelledby="start-projects" className="p-6">
            <CreateProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleModalCreate}
            />

            <div className="flex items-center justify-between">
                <h1 id="start-projects" className="text-2xl font-semibold">
                    Projects
                </h1>
                <button
                    type="button"
                    onClick={handleCreateClick}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-500 text-white rounded hover:opacity-95"
                >
                    New Project
                </button>
            </div>

            <div className="mt-6 grid gap-4">
                {localProjects.map((p, idx) => {
                    const view = projectViews[idx];
                    const resourceList = view
                        ? view.resources.filter((r) => r.type !== "folder")
                        : p.resources;
                    const projName = view?.project?.name ?? p.name;

                    return (
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
                                {projName}
                            </h2>
                            {p.description ? (
                                <p className="text-sm text-slate-600 mt-1 truncate-2">
                                    {p.description}
                                </p>
                            ) : null}
                            <div className="text-xs text-slate-500 mt-2">
                                {resourceList.length} resources
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <ManageProjectMenu
                                projectId={p.id}
                                projectName={projName}
                                onRename={(id, newName) => {
                                    setLocalProjects((prev) =>
                                        prev.map((proj) =>
                                            proj.id === id
                                                ? { ...proj, name: newName }
                                                : proj,
                                        ),
                                    );
                                }}
                                onDelete={(id) => {
                                    setLocalProjects((prev) =>
                                        prev.filter((proj) => proj.id !== id),
                                    );
                                }}
                                onPackage={(id, selectedIds) => {
                                    // UI-only placeholder action — show selected ids if provided
                                    const proj = localProjects.find(
                                        (x) => x.id === id,
                                    );
                                    const selText = selectedIds
                                        ? `\nSelected: ${selectedIds.join(", ")}`
                                        : "";
                                    window.alert(
                                        `Package placeholder for ${proj?.name ?? id}${selText}`,
                                    );
                                }}
                                resources={resourceList as any}
                            />

                            <button
                                type="button"
                                onClick={() => handleOpen(p.id)}
                                className="px-3 py-1 rounded border text-sm bg-slate-50 hover:bg-slate-100"
                            >
                                Open
                            </button>
                        </div>
                    </article>
                    );
                })}
            </div>
        </section>
    );
}
