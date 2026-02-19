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
