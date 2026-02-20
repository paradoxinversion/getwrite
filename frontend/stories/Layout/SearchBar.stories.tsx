import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SearchBar from "../../components/Layout/SearchBar";
import { sampleProjects } from "../../lib/placeholders";
import type { Resource } from "../../lib/types";

const resources: Resource[] = sampleProjects(1)[0].resources;

const meta: Meta<typeof SearchBar> = {
    title: "Layout/SearchBar",
    component: SearchBar,
    argTypes: {
        onSelect: { action: "select" },
        resources: { control: "object" },
        placeholder: { control: "text" },
    },
};

export default meta;
type Story = StoryObj<typeof SearchBar>;

export const Default: Story = {
    args: {
        resources: [],
        placeholder: "Search resources...",
    },
};

export const WithResults: Story = {
    args: {
        resources,
        placeholder: "Search resources...",
    },
};

export const Interactive: Story = {
    render: (args) => {
        const Wrapper = () => {
            const [selected, setSelected] = React.useState<string | null>(null);
            return (
                <div>
                    <SearchBar
                        {...args}
                        onSelect={(id: string) => setSelected(id)}
                    />
                    <div
                        data-testid="search-last-selected"
                        aria-hidden
                        style={{ display: "none" }}
                    >
                        {selected}
                    </div>
                </div>
            );
        };

        return <Wrapper />;
    },
    args: {
        resources,
        placeholder: "Search resources...",
    },
};
