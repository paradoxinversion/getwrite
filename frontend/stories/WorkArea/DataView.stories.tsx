import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DataView, { DataViewProps } from "../../components/WorkArea/DataView";
import { sampleProjects, createProject } from "../../lib/placeholders";

const meta: Meta<typeof DataView> = {
    title: "WorkArea/DataView",
    component: DataView,
};

export default meta;
type Story = StoryObj<typeof DataView>;

const project = createProject("Sample Project");

export const Default: Story = {
    args: {
        project,
    },
};

export const WithResources: Story = {
    render: (args: DataViewProps) => <DataView {...args} />,
    args: {
        project,
        resources: project.resources,
    },
};
