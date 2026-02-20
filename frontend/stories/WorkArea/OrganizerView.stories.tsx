import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import OrganizerView, {
    OrganizerViewProps,
} from "../../components/WorkArea/OrganizerView";
import { createProject } from "../../lib/placeholders";

const meta: Meta<typeof OrganizerView> = {
    title: "WorkArea/OrganizerView",
    component: OrganizerView,
};

export default meta;
type Story = StoryObj<typeof OrganizerView>;

const sample = createProject("Sample Project").resources;

export const Default: Story = {
    args: {
        resources: sample,
        showBody: true,
        onToggleBody: (s) => console.log("toggle body", s),
    },
};

export const Interactive: Story = {
    render: (args: OrganizerViewProps) => {
        const [show, setShow] = React.useState(!!args.showBody);
        return (
            <OrganizerView
                {...args}
                resources={args.resources}
                showBody={show}
                onToggleBody={(s) => {
                    setShow(s);
                    if (args.onToggleBody) args.onToggleBody(s);
                }}
            />
        );
    },
    args: {
        resources: sample,
        showBody: true,
    },
};
