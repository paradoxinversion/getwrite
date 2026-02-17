import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const AppShell: React.FC = () => (
    <div className="h-[600px] flex bg-slate-50 border rounded">
        <aside className="w-64 bg-white p-4 border-r">
            Resource Tree (placeholder)
        </aside>
        <main className="flex-1 p-6">Work Area (placeholder)</main>
        <aside className="w-80 bg-white p-4 border-l">
            Metadata Sidebar (placeholder)
        </aside>
    </div>
);

const meta: Meta<typeof AppShell> = {
    title: "AppShell",
    component: AppShell,
};

export default meta;

export const Default: StoryObj<typeof AppShell> = {};
