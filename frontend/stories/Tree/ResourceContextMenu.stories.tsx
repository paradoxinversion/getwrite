import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ResourceContextMenu from "../../components/Tree/ResourceContextMenu";

const meta: Meta<typeof ResourceContextMenu> = {
    title: "Tree/ResourceContextMenu",
    component: ResourceContextMenu,
};

export default meta;

type Story = StoryObj<typeof ResourceContextMenu>;

export const Default: Story = {
    args: {
        open: false,
        x: 100,
        y: 100,
        resourceId: "res_123",
        resourceTitle: "Sample Resource",
        onClose: () => undefined,
        onAction: (action: string) => console.log("action", action),
    },
};

export const Open: Story = {
    args: {
        open: true,
        x: 120,
        y: 80,
        resourceId: "res_123",
        resourceTitle: "Sample Resource",
        onClose: () => console.log("closed"),
        onAction: (action: string) => console.log("action", action),
    },
};
