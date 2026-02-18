import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import NotesInput from "../../../components/Sidebar/controls/NotesInput";
import StatusSelector from "../../../components/Sidebar/controls/StatusSelector";
import MultiSelectList from "../../../components/Sidebar/controls/MultiSelectList";
import POVAutocomplete from "../../../components/Sidebar/controls/POVAutocomplete";

const meta: Meta = {
    title: "Sidebar/Controls",
};

export default meta;

export const Default: StoryObj = {
    render: () => (
        <div className="p-4 w-96 bg-white">
            <NotesInput />
            <div className="mt-4">
                <StatusSelector />
            </div>
            <div className="mt-4">
                <MultiSelectList
                    label="Characters"
                    items={["Alice", "Bob", "Eve"]}
                />
            </div>
            <div className="mt-4">
                <POVAutocomplete options={["Alice", "Bob"]} />
            </div>
        </div>
    ),
};
