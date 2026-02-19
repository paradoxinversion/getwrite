import React from "react";
import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
    parameters: {
        actions: { argTypesRegex: "^on[A-Z].*" },
        controls: { expanded: true },

        a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: "todo"
        }
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
