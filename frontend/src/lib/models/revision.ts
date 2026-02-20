import path from "node:path";
import { generateUUID } from "./uuid";
import type { UUID, Revision } from "./types";
import { mkdir, writeFile, readFile, readdir, stat, rm, rename } from "./io";

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
    const finalDir = revisionDir(projectRoot, resourceId, versionNumber);
    const base = revisionsBaseDir(projectRoot, resourceId);

    // Ensure final dir does not already exist to avoid clobbering.
    try {
        const st = await stat(finalDir).catch(() => null);
        if (st)
            throw new Error(`revision directory already exists: ${finalDir}`);
    } catch (err) {
        throw err;
    }

    // Create a temp directory next to the revisions base and write files there,
    // then atomically rename the temp dir to the final v-<version> directory.
    const tmpDir = path.join(base, `.tmp-${generateUUID()}`);
    try {
        await mkdir(tmpDir, { recursive: true });

        const filename = "content.bin";
        const finalFilePath = path.join(finalDir, filename);
        const tmpFilePath = path.join(tmpDir, filename);
        await writeFile(tmpFilePath, content);

        const now = new Date().toISOString();
        const rev: Revision = {
            id: generateUUID(),
            resourceId,
            versionNumber,
            createdAt: now,
            savedAt: now,
            author: options?.author,
            filePath: finalFilePath,
            isCanonical: !!options?.isCanonical,
        };

        const metaPath = path.join(tmpDir, "metadata.json");
        await writeFile(metaPath, JSON.stringify(rev, null, 2), "utf8");

        // Atomic move into place. If finalDir exists, this will throw.
        await rename(tmpDir, finalDir);

        return rev;
    } catch (err) {
        // Best-effort cleanup of tmpDir on error.
        try {
            await rm(tmpDir, { recursive: true, force: true });
        } catch (_) {
            // ignore cleanup errors
        }
        throw err;
    }
}

/** List all revisions for a resource by reading revisions/<resourceId>/v-<version>/metadata.json. */
export async function listRevisions(
    projectRoot: string,
    resourceId: UUID,
): Promise<Revision[]> {
    const base = revisionsBaseDir(projectRoot, resourceId);
    try {
        const entries = await readdir(base, { withFileTypes: true });
        const revDirs = entries
            .filter((e) => e.isDirectory() && e.name.startsWith("v-"))
            .map((d) => d.name);
        const results: Revision[] = [];
        for (const d of revDirs) {
            const metaPath = path.join(base, d, "metadata.json");
            try {
                const raw = await readFile(metaPath, "utf8");
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
        await rm(dir, { recursive: true, force: true });
        deleted.push(c);
    }
    return deleted;
}

/** Mark the specified revision as canonical and unset others. */
export async function setCanonicalRevision(
    projectRoot: string,
    resourceId: UUID,
    versionNumber: number,
): Promise<Revision | null> {
    const revs = await listRevisions(projectRoot, resourceId);
    const target = revs.find((r) => r.versionNumber === versionNumber);
    if (!target) return null;

    const base = revisionsBaseDir(projectRoot, resourceId);

    // Update every metadata.json to reflect canonical flag (set true for target, false otherwise)
    for (const r of revs) {
        const dir = path.join(base, `v-${r.versionNumber}`);
        const metaPath = path.join(dir, "metadata.json");
        const updated: Revision = {
            ...r,
            isCanonical: r.versionNumber === versionNumber,
            savedAt: new Date().toISOString(),
        };
        await writeFile(metaPath, JSON.stringify(updated, null, 2), "utf8");
    }

    return { ...target, isCanonical: true };
}

/** Return the current canonical revision if present. */
export async function getCanonicalRevision(
    projectRoot: string,
    resourceId: UUID,
): Promise<Revision | null> {
    const revs = await listRevisions(projectRoot, resourceId);
    return revs.find((r) => r.isCanonical) ?? null;
}

export default {
    selectPruneCandidates,
    revisionsBaseDir,
    revisionDir,
    writeRevision,
    listRevisions,
    pruneRevisions,
    setCanonicalRevision,
    getCanonicalRevision,
};
