import fs from "node:fs/promises";
import path from "node:path";
import type { UUID, MetadataValue } from "./types";
import { withMetaLock } from "./meta-locks";

/**
 * Compute the canonical sidecar filename for a resource id.
 * Example: resource-<uuid>.meta.json
 */
export function sidecarFilename(resourceId: UUID): string {
    return `resource-${resourceId}.meta.json`;
}

/**
 * Compute the sidecar file path inside a project folder.
 * The default location is `<projectRoot>/meta/<sidecarFilename>`.
 */
export function sidecarPathForProject(
    projectRoot: string,
    resourceId: UUID,
): string {
    return path.join(projectRoot, "meta", sidecarFilename(resourceId));
}

async function ensureDir(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        // Let caller see fs errors rather than swallowing them.
        throw err;
    }
}

/**
 * Read sidecar metadata for a resource from a project root. Returns `null`
 * if the file does not exist.
 *
 * Throws on filesystem or JSON parse errors so callers can handle them.
 */
export async function readSidecar(
    projectRoot: string,
    resourceId: UUID,
): Promise<Record<string, MetadataValue> | null> {
    const filePath = sidecarPathForProject(projectRoot, resourceId);
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as Record<string, MetadataValue>;
        return parsed;
    } catch (err: unknown) {
        // If the file doesn't exist, return null. Otherwise rethrow.
        // Check error code in a type-safe way.
        if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as any).code === "ENOENT"
        ) {
            return null;
        }
        throw err;
    }
}

/**
 * Write sidecar metadata for a resource into the project's `meta/` folder.
 * Creates directories as needed. Overwrites existing sidecars.
 */
export async function writeSidecar(
    projectRoot: string,
    resourceId: UUID,
    metadata: Record<string, MetadataValue>,
): Promise<void> {
    const dir = path.join(projectRoot, "meta");
    const filePath = sidecarPathForProject(projectRoot, resourceId);
    const json = JSON.stringify(metadata, null, 2);
    await withMetaLock(projectRoot, async () => {
        await ensureDir(dir);
        await fs.writeFile(filePath, json, "utf8");
    });
    // Enqueue background indexing after sidecar update. Use dynamic import
    // to avoid circular static imports between sidecar and the indexer queue.
    try {
        setImmediate(() => {
            import("./indexer-queue")
                .then((m) => m.enqueueIndex(projectRoot, resourceId))
                .catch(() => {
                    /* ignore enqueue errors */
                });
        });
    } catch (_) {
        // ignore
    }
}

export default {
    sidecarFilename,
    sidecarPathForProject,
    readSidecar,
    writeSidecar,
};
