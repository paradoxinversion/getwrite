import fs from "node:fs/promises";
import path from "node:path";
import { generateUUID } from "./uuid";
import type { UUID, Revision } from "./types";

/**
 * Determine which revisions should be pruned when enforcing a maximum retained
 * revisions count for a resource.
 */
export function selectPruneCandidates(
    revisions: Revision[],
    maxRevisions: number,
): Revision[] {
    if (maxRevisions < 0)
        throw new RangeError("maxRevisions must be non-negative");

    const total = revisions.length;
    if (total <= maxRevisions) return [];

    const nonCanonical = revisions.filter((r) => !r.isCanonical);
    if (nonCanonical.length === 0) return [];

    const sorted = [...nonCanonical].sort(
        (a, b) => a.versionNumber - b.versionNumber,
    );

    const toRemoveCount = Math.max(0, total - maxRevisions);
    return sorted.slice(0, toRemoveCount);
}

/** Get the base revisions directory for a resource. */
export function revisionsBaseDir(
    projectRoot: string,
    resourceId: UUID,
): string {
    return path.join(projectRoot, "revisions", resourceId);
}

/** Get the folder for a specific revision version. */
export function revisionDir(
    projectRoot: string,
    resourceId: UUID,
    versionNumber: number,
): string {
    return path.join(
        revisionsBaseDir(projectRoot, resourceId),
        `v-${versionNumber}`,
    );
}

/** Write revision content and metadata. Returns the created Revision metadata. */
export async function writeRevision(
    projectRoot: string,
    resourceId: UUID,
    versionNumber: number,
    content: string | Buffer,
    options?: { author?: string; isCanonical?: boolean },
): Promise<Revision> {
    const dir = revisionDir(projectRoot, resourceId, versionNumber);
    await fs.mkdir(dir, { recursive: true });

    const filename = "content.bin";
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, content);

    const now = new Date().toISOString();
    const rev: Revision = {
        id: generateUUID(),
        resourceId,
        versionNumber,
        createdAt: now,
        savedAt: now,
        author: options?.author,
        filePath,
        isCanonical: !!options?.isCanonical,
    };

    const metaPath = path.join(dir, "metadata.json");
    await fs.writeFile(metaPath, JSON.stringify(rev, null, 2), "utf8");

    return rev;
}

/** List all revisions for a resource by reading revisions/<resourceId>/v-<version>/metadata.json. */
export async function listRevisions(
    projectRoot: string,
    resourceId: UUID,
): Promise<Revision[]> {
    const base = revisionsBaseDir(projectRoot, resourceId);
    try {
        const entries = await fs.readdir(base, { withFileTypes: true });
        const revDirs = entries
            .filter((e) => e.isDirectory() && e.name.startsWith("v-"))
            .map((d) => d.name);
        const results: Revision[] = [];
        for (const d of revDirs) {
            const metaPath = path.join(base, d, "metadata.json");
            try {
                const raw = await fs.readFile(metaPath, "utf8");
                const parsed = JSON.parse(raw) as Revision;
                results.push(parsed);
            } catch (err: unknown) {
                continue;
            }
        }
        return results.sort((a, b) => a.versionNumber - b.versionNumber);
    } catch (err: unknown) {
        if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as unknown as { code?: string }).code === "ENOENT"
        )
            return [];
        throw err;
    }
}

/**
 * Prune revisions to enforce maxRevisions retained revisions. Deletes
 * filesystem directories for selected candidates and returns deleted metadata.
 */
export async function pruneRevisions(
    projectRoot: string,
    resourceId: UUID,
    maxRevisions: number,
): Promise<Revision[]> {
    const revisions = await listRevisions(projectRoot, resourceId);
    const candidates = selectPruneCandidates(revisions, maxRevisions);
    const deleted: Revision[] = [];
    for (const c of candidates) {
        const dir = revisionDir(projectRoot, resourceId, c.versionNumber);
        await fs.rm(dir, { recursive: true, force: true });
        deleted.push(c);
    }
    return deleted;
}

export default {
    selectPruneCandidates,
    revisionsBaseDir,
    revisionDir,
    writeRevision,
    listRevisions,
    pruneRevisions,
};
