import React from "react";
import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
    parameters: {
        actions: { argTypesRegex: "^on[A-Z].*" },
        controls: { expanded: true },
    },
    decorators: [
        (Story) => (
            <div style={{ padding: 16 }}>
                <Story />
            </div>
        ),
    ],
};

export default preview;
