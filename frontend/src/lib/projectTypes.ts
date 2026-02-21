import path from "node:path";
import { readdir, readFile } from "./models/io";
import {
    validateProjectType,
    validateProjectTypeFile,
    ProjectTypeSpec,
} from "./models/schemas";

export type ProjectTypeEntry = {
    spec: ProjectTypeSpec;
    filePath: string;
    fileName: string;
};

const TEMPLATES_DIR = path.join(
    "getwrite-config",
    "templates",
    "project-types",
);

let _cache: ProjectTypeEntry[] | null = null;

export async function listProjectTypes(
    forceRefresh = false,
): Promise<ProjectTypeEntry[]> {
    if (_cache && !forceRefresh) return _cache;

    try {
        const entries = (await readdir(TEMPLATES_DIR, {
            withFileTypes: true,
        })) as string[] | import("node:fs").Dirent[];
        const filenames = (entries as any[]).map((e) =>
            typeof e === "string" ? e : (e as import("node:fs").Dirent).name,
        );
        const results: ProjectTypeEntry[] = [];
        for (const e of filenames) {
            if (!e.endsWith(".json")) continue;
            const fp = path.join(TEMPLATES_DIR, e);
            try {
                const raw = await readFile(fp, "utf8");
                const parsed = JSON.parse(raw);
                const res = validateProjectType(parsed);
                if (res.success) {
                    results.push({
                        spec: res.value,
                        filePath: fp,
                        fileName: e,
                    });
                }
            } catch (err) {
                // skip invalid JSON/files
                continue;
            }
        }
        // cache
        _cache = results;
        return results;
    } catch (err) {
        // Directory missing or unreadable — return empty list
        _cache = [];
        return [];
    }
}

export async function getProjectType(
    id: string,
    forceRefresh = false,
): Promise<ProjectTypeEntry | undefined> {
    const list = await listProjectTypes(forceRefresh);
    return list.find((l) => l.spec.id === id);
}

export function clearProjectTypeCache() {
    _cache = null;
}

export default { listProjectTypes, getProjectType, clearProjectTypeCache };
