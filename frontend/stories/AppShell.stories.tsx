import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AppShell from "../components/Layout/AppShell";
import { sampleProjects } from "../lib/placeholders";
import type { Project } from "../lib/types";

const meta: Meta<typeof AppShell> = {
    title: "AppShell",
    component: AppShell,
};

export default meta;

type Story = StoryObj<typeof AppShell>;

export const Default: Story = {
    render: () => {
        const projects: Project[] = sampleProjects(3);

        return (
            <AppShell>
                <div>
                    <h2 className="text-xl font-semibold">Projects</h2>
                    <div className="mt-4 space-y-3">
                        {projects.map((p) => (
                            <div
                                key={p.id}
                                className="border rounded p-3 bg-slate-50"
                            >
                                <div className="font-medium">{p.name}</div>
                                <div className="text-xs text-slate-600 mt-1">
                                    {p.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </AppShell>
        );
    },
};
