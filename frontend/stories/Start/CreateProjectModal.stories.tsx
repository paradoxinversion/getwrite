import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CreateProjectModal, {
    CreateProjectModalProps,
    CreateProjectPayload,
} from "../../../frontend/components/Start/CreateProjectModal";

const meta: Meta<typeof CreateProjectModal> = {
    title: "Start/CreateProjectModal",
    component: CreateProjectModal,
};

export default meta;

type Story = StoryObj<typeof CreateProjectModal>;

export const Open: Story = {
    args: {
        isOpen: true,
        defaultName: "My Project",
        defaultType: "novel",
        onClose: () => console.log("close"),
        onCreate: (payload: CreateProjectPayload) =>
            console.log("create", payload),
    },
    render: (args: CreateProjectModalProps) => <CreateProjectModal {...args} />,
};
