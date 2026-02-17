import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import StartPage from "../../../frontend/components/Start/StartPage";
import { sampleProjects } from "../../../frontend/lib/placeholders";

const meta: Meta<typeof StartPage> = {
    title: "Start/StartPage",
    component: StartPage,
};

export default meta;

type Story = StoryObj<typeof StartPage>;

export const Default: Story = {
    args: {
        projects: sampleProjects(3),
        onCreate: (name: string) => console.log("create", name),
        onOpen: (id: string) => console.log("open", id),
    },
    render: (args) => <StartPage {...args} />,
};
