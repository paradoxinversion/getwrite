import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import DiffView, { Revision } from "../../components/WorkArea/DiffView";

const meta: Meta<typeof DiffView> = {
    title: "WorkArea/DiffView",
    component: DiffView,
};

export default meta;

type Story = StoryObj<typeof DiffView>;

const sampleLeft = `
  <h1>Introduction</h1>
  <p>This is the original version of the content.</p>
  <ul>
    <li>Point A</li>
    <li>Point B</li>
  </ul>
`;

const sampleRight = `
  <h1>Introduction</h1>
  <p>This is the revised version of the content with small edits.</p>
  <ul>
    <li>Point A</li>
    <li>Point B (expanded)</li>
    <li>Point C</li>
  </ul>
`;

const revisions: Revision[] = [
    {
        id: "r1",
        label: "Draft 1",
        timestamp: "2026-02-01",
        summary: "Initial draft",
    },
    {
        id: "r2",
        label: "Draft 2",
        timestamp: "2026-02-03",
        summary: "Small edits",
    },
];

export const Default: Story = {
    args: {
        leftContent: sampleLeft,
        rightContent: sampleRight,
        revisions,
    },
};

export const Empty: Story = {
    args: {
        leftContent: "",
        rightContent: "",
        revisions: [],
    },
};
