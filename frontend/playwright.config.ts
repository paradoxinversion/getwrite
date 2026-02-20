import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "e2e",
    timeout: 30_000,
    expect: { timeout: 5000 },
    fullyParallel: false,
    reporter: [["list"], ["html", { open: "never" }]],
    // Store artifacts in a dedicated directory and enable capture of
    // screenshots, video and trace so CI can collect debugging data.
    outputDir: "playwright-report",
    use: {
        actionTimeout: 5000,
        // Capture artifacts for every test run (can be adjusted to
        // 'only-on-failure' / 'retain-on-failure' to reduce storage).
        screenshot: "on",
        video: "on",
        trace: "on",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "pnpm run storybook",
        port: 6006,
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
