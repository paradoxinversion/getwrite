import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";

export function registerScreenshots(program: Command) {
    const cmd = program
        .command("screenshots")
        .description("Screenshot related commands");

    cmd.command("capture")
        .description("Capture Storybook screenshots")
        .option(
            "-b, --storybook <url>",
            "Storybook base URL",
            "http://localhost:6006",
        )
        .option("-o, --out <dir>", "output directory", "./screenshots")
        .option("-l, --limit <n>", "maximum number of stories to capture", "6")
        .action(
            async (options: {
                storybook: string;
                out: string;
                limit: string;
            }) => {
                const base = options.storybook;
                const outDir = path.resolve(process.cwd(), options.out);
                if (!fs.existsSync(outDir))
                    fs.mkdirSync(outDir, { recursive: true });

                console.log("Fetching index.json from", base);
                try {
                    const res = await fetch(`${base}/index.json`);
                    if (!res.ok)
                        throw new Error(
                            `Failed to fetch index.json: ${res.status}`,
                        );
                    const json = await res.json();
                    const storiesObj = json.stories || json.entries || json;
                    const storyIds = Object.keys(storiesObj || {}).slice(
                        0,
                        Number(options.limit ?? 6),
                    );
                    if (storyIds.length === 0) {
                        console.error("No stories found in index.json");
                        process.exit(1);
                    }

                    const browser = await chromium.launch();
                    const page = await browser.newPage({
                        viewport: { width: 1200, height: 900 },
                    });

                    for (const id of storyIds) {
                        const url = `${base}/iframe.html?id=${id}`;
                        console.log("Capturing", id, url);
                        await page.goto(url, { waitUntil: "networkidle" });
                        await page.waitForTimeout(600);
                        const safe = id.replace(/[:\/]/g, "_");
                        const out = path.join(outDir, `${safe}.png`);
                        await page.screenshot({ path: out, fullPage: true });
                        console.log("Saved", out);
                    }

                    await browser.close();
                    console.log("Done capturing screenshots.");
                    return 0;
                } catch (err) {
                    console.error("Screenshot capture failed:", err);
                    return 2;
                }
            },
        );
}

export default registerScreenshots;
