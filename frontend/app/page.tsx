"use client";
import React, { useState } from "react";
import AppShell from "../components/Layout/AppShell";
import StartPage from "../components/Start/StartPage";
import {
    sampleProjects,
    createProject,
    findProjectById,
} from "../lib/placeholders";
import type { Project } from "../lib/types";

/** Root page: render the application's start page inside the main shell. */
export default function Home() {
    const [projects, setProjects] = useState<Project[]>(() =>
        sampleProjects(3),
    );
    const [selectedProject, setSelectedProject] = useState<Project | null>(
        null,
    );
    const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
        null,
    );

    const handleCreate = (name: string) => {
        const p = createProject(name);
        setProjects((prev) => [p, ...prev]);
        setSelectedProject(p);
    };

    const handleOpen = (id: string) => {
        const p = findProjectById(projects, id);
        if (p) setSelectedProject(p);
    };

    const handleResourceSelect = (id: string) => {
        setSelectedResourceId(id);
    };

    return (
        <AppShell
            showSidebars={Boolean(selectedProject)}
            resources={selectedProject?.resources}
            onResourceSelect={handleResourceSelect}
            selectedResourceId={selectedResourceId}
        >
            {!selectedProject ? (
                <StartPage
                    projects={projects}
                    onCreate={handleCreate}
                    onOpen={handleOpen}
                />
            ) : (
                <section className="p-6">
                    <h1 className="text-2xl font-semibold">
                        {selectedProject.name}
                    </h1>
                    <p className="mt-4 text-slate-600">
                        Open a resource from the left-hand contents list, or
                        create a new resource to get started.
                    </p>
                </section>
            )}
        </AppShell>
    );
}
