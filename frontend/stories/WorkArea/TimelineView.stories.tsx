import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import TimelineView from "../../components/WorkArea/TimelineView";
import { sampleProjects } from "../../lib/placeholders";

const meta: Meta<typeof TimelineView> = {
    title: "WorkArea/TimelineView",
    component: TimelineView,
};

export default meta;

type Story = StoryObj<typeof TimelineView>;

export const Default: Story = {
    args: {
        project: sampleProjects(1)[0],
    },
};

export const SingleProject: Story = {
    args: {
        project: sampleProjects(1)[0],
    },
};
