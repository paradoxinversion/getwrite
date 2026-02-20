import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CompilePreviewModal from "../components/common/CompilePreviewModal";
import type { Resource } from "../lib/types";

const sampleResources: Resource[] = [
    {
        id: "f1",
        projectId: "proj-1",
        title: "Folder A",
        type: "folder",
        createdAt: "",
        updatedAt: "",
        metadata: {},
    },
    {
        id: "r1",
        projectId: "proj-1",
        title: "Test Doc",
        type: "document",
        parentId: "f1",
        createdAt: "",
        updatedAt: "",
        metadata: {},
    },
    {
        id: "r2",
        projectId: "proj-1",
        title: "Another Doc",
        type: "document",
        parentId: "f1",
        createdAt: "",
        updatedAt: "",
        metadata: {},
    },
];

const meta: Meta<typeof CompilePreviewModal> = {
    title: "Common/CompilePreviewModal",
    component: CompilePreviewModal,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof CompilePreviewModal>;

export const ProjectPreview: Story = {
    args: {
        isOpen: true,
        projectId: "proj-1",
        resources: sampleResources,
    },
};

export const ResourcePreview: Story = {
    args: {
        isOpen: true,
        projectId: "proj-1",
        resources: sampleResources,
        // pass `resource` to demonstrate legacy single-resource flow
        resource: sampleResources[1],
    } as any,
};
