import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
    stories: ["../stories/**/*.stories.@(tsx|mdx)"],
    addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
    framework: {
        name: "@storybook/nextjs-vite",
        options: {},
    },
    docs: {},
};

export default config;
