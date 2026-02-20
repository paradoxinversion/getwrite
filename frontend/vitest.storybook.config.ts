import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname =
    typeof __dirname !== "undefined"
        ? __dirname
        : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            // same alias as vitest config to resolve `@/...` imports in generated files
            "@": path.resolve(dirname, "@"),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        // only run story files with the Storybook Vitest plugin
        include: ["stories/**/*.stories.@(tsx|mdx)"],
        // explicitly exclude the e2e folder and Playwright artifacts
        exclude: ["**/e2e/**", "playwright-report/**"],
        projects: [
            {
                extends: true,
                plugins: [
                    storybookTest({
                        configDir: path.join(dirname, ".storybook"),
                    }),
                ],
                test: {
                    name: "storybook",
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright({}),
                        instances: [{ browser: "chromium" }],
                    },
                    setupFiles: [".storybook/vitest.setup.ts"],
                },
            },
        ],
    },
});
