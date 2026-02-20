import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ManageProjectMenu, {
    ManageProjectMenuProps,
} from "../../../frontend/components/Start/ManageProjectMenu";

const meta: Meta<typeof ManageProjectMenu> = {
    title: "Start/ManageProjectMenu",
    component: ManageProjectMenu,
};

export default meta;

type Story = StoryObj<typeof ManageProjectMenu>;

export const Default: Story = {
    args: {
        projectId: "proj_1",
        projectName: "Sample Project",
        onRename: (id: string, name: string) => console.log("rename", id, name),
        onDelete: (id: string) => console.log("delete", id),
        onPackage: (id: string) => console.log("package", id),
    },
    render: (args: ManageProjectMenuProps) => <ManageProjectMenu {...args} />,
};
