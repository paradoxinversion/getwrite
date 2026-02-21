import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ResourceTree from "../../components/Tree/ResourceTree";
import ClientProvider from "../../src/store/ClientProvider";
import store from "../../src/store/store";
import { setProject } from "../../src/store/projectsSlice";
import { createProject, createResource } from "../../lib/placeholders";

const project = createProject("Storybook Project");
// create a folder and nested resources for the story
const folder = createResource("Characters", "folder", project.id);
const char1 = createResource("Protagonist", "note", project.id, folder.id);
const char2 = createResource("Antagonist", "note", project.id, folder.id);
// merge resources into an array including folder and top-level items
const resources = [folder, ...project.resources, char1, char2];

const meta: Meta<typeof ResourceTree> = {
    title: "Tree/ResourceTree",
    component: ResourceTree,
};

export default meta;

type Story = StoryObj<typeof ResourceTree>;

export const Default: Story = {
    render: (args) => {
        store.dispatch(
            setProject({ id: project.id, name: project.name, resources }),
        );
        return (
            <ClientProvider>
                <ResourceTree projectId={project.id} onSelect={args.onSelect} />
            </ClientProvider>
        );
    },
    args: {
        onSelect: (id: string) => console.log("selected", id),
    },
};

export const Reorderable: Story = {
    render: (args) => {
        store.dispatch(
            setProject({ id: project.id, name: project.name, resources }),
        );
        return (
            <ClientProvider>
                <ResourceTree
                    projectId={project.id}
                    reorderable
                    onReorder={args.onReorder}
                />
            </ClientProvider>
        );
    },
    args: {
        onReorder: (ids: string[]) => console.log("reordered", ids),
    },
};
