import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname =
    typeof __dirname !== "undefined"
        ? __dirname
        : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
    resolve: {
        alias: {
            // map `@` imports to the frontend `@` folder used by generated files
            "@": path.resolve(dirname, "@"),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./tests/setup.ts"],
        // match conventional test file patterns and avoid including e2e specs
        include: ["**/*.{test,spec}.{ts,tsx}"],
        exclude: ["**/e2e/**", "playwright-report/**"],
    },
});
