import fs from "fs";
import path from "path";
import { pruneRevisions } from "./revision";

/**
 * List resource IDs that have a `revisions/` entry under a project root.
 * Expects directory layout: <projectRoot>/revisions/<resourceId>/v-<version>/
 */
export async function listResourceIds(projectRoot: string): Promise<string[]> {
    const revisionsRoot = path.join(projectRoot, "revisions");
    try {
        const children = await fs.promises.readdir(revisionsRoot, {
            withFileTypes: true,
        });
        return children.filter((d) => d.isDirectory()).map((d) => d.name);
    } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e && e.code === "ENOENT") return [];
        throw err;
    }
}

/**
 * Run pruning for all resources under `projectRoot`.
 * Calls `pruneRevisions` for each discovered resource with the provided `maxRevisions`.
 * Returns a map of resourceId -> number of deleted revisions.
 */
export async function pruneAllResources(
    projectRoot: string,
    maxRevisions: number,
): Promise<Record<string, number>> {
    const resourceIds = await listResourceIds(projectRoot);
    const results: Record<string, number> = {};
    for (const id of resourceIds) {
        const deleted = await pruneRevisions(projectRoot, id, maxRevisions);
        results[id] = deleted.length;
    }
    return results;
}

/**
 * Minimal CLI entry.
 * Usage: node prune-revisions.mjs <projectRoot> [maxRevisions]
 */
export async function runCli(argv: string[]): Promise<number> {
    const projectRoot = argv[2] ?? process.cwd();
    const maxRevisions = Number(argv[3] ?? 50);
    try {
        const res = await pruneAllResources(projectRoot, maxRevisions);
        console.log("Prune results:");
        for (const [k, v] of Object.entries(res))
            console.log(`${k}: pruned ${v}`);
        return 0;
    } catch (err) {
        console.error("Error running prune executor", err);
        return 2;
    }
}

export default pruneAllResources;
