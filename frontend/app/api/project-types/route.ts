import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { validateProjectType } from "../../../src/lib/models/schemas";

// frontend dev server's cwd is the `frontend` folder; templates live at repo root
const TEMPLATES_DIR = path.join(
    process.cwd(),
    "..",
    "getwrite-config",
    "templates",
    "project-types",
);

export async function GET() {
    try {
        const entries = await fs.readdir(TEMPLATES_DIR, {
            withFileTypes: true,
        });
        const results: { id: string; name: string; description?: string }[] =
            [];
        for (const e of entries) {
            if (!e.isFile() || !e.name.endsWith(".json")) continue;
            const fp = path.join(TEMPLATES_DIR, e.name);
            try {
                const raw = await fs.readFile(fp, "utf8");
                const parsed = JSON.parse(raw);
                const res = validateProjectType(parsed);
                if (res.success) {
                    results.push({
                        id: res.value.id,
                        name: res.value.name,
                        description: res.value.description,
                    });
                }
            } catch (err) {
                // skip invalid files
                continue;
            }
        }
        return NextResponse.json(results);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { error: "Cannot read project types", details: msg },
            { status: 500 },
        );
    }
}
