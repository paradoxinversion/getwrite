#!/usr/bin/env node
const path = require("path");
// Attempt to load playwright from the frontend workspace node_modules when this
// script is executed via `pnpm --dir frontend exec node ...` and the script
// file lives outside the frontend folder.
let chromium;
try {
    const pwPath = path.join(process.cwd(), "node_modules", "playwright");
    const pw = require(pwPath);
    chromium = pw.chromium;
} catch (err) {
    // fallback to normal resolution
    ({ chromium } = require("playwright"));
}
const fs = require("fs");
// (path already required above)

(async () => {
    const base = "http://localhost:6006";
    const outDir = path.resolve(__dirname, "..", "screenshots");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    console.log("Fetching index.json from", base);
    const res = await fetch(`${base}/index.json`);
    if (!res.ok) throw new Error(`Failed to fetch index.json: ${res.status}`);
    const json = await res.json();

    const storiesObj = json.stories || json.entries || json;
    const storyIds = Object.keys(storiesObj || {}).slice(0, 6);
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
        await page.waitForTimeout(600); // let play() handlers run
        const safe = id.replace(/[:\/]/g, "_");
        const out = path.join(outDir, `${safe}.png`);
        await page.screenshot({ path: out, fullPage: true });
        console.log("Saved", out);
    }

    await browser.close();
    console.log("Done capturing screenshots.");
})();
