import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ViewSwitcher from "../../components/WorkArea/ViewSwitcher";

const meta: Meta<typeof ViewSwitcher> = {
    title: "WorkArea/ViewSwitcher",
    component: ViewSwitcher,
};

export default meta;
type Story = StoryObj<typeof ViewSwitcher>;

export const Default: Story = {
    args: {
        view: "edit",
        onChange: (v) => console.log("view changed", v),
    },
};

export const Interactive: Story = {
    render: () => {
        const [view, setView] = React.useState<
            "edit" | "organizer" | "data" | "diff" | "timeline"
        >("edit");
        return <ViewSwitcher view={view} onChange={setView} />;
    },
};
