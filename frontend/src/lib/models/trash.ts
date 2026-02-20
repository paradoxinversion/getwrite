import fs from "node:fs/promises";
import path from "node:path";
import { sidecarPathForProject, sidecarFilename } from "./sidecar";
import type { UUID } from "./types";

async function ensureDir(dir: string): Promise<void> {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        throw err;
    }
}

/**
 * Move resource files and sidecar to the project's `.trash/` area.
 * Preserves identities and returns the trash path root used for the resource.
 */
export async function softDeleteResource(
    projectRoot: string,
    resourceId: UUID,
): Promise<string> {
    const trashRoot = path.join(projectRoot, ".trash");
    const trashResourcesDir = path.join(trashRoot, "resources");
    const trashMetaDir = path.join(trashRoot, "meta");

    await ensureDir(trashResourcesDir);
    await ensureDir(trashMetaDir);

    // Move sidecar if present
    const sidecarSrc = sidecarPathForProject(projectRoot, resourceId);
    const sidecarName = sidecarFilename(resourceId);
    const sidecarDest = path.join(trashMetaDir, sidecarName);
    try {
        await fs.rename(sidecarSrc, sidecarDest);
    } catch (err: unknown) {
        // If file does not exist, ignore; otherwise rethrow
        if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as any).code === "ENOENT"
        ) {
            // no-op
        } else {
            throw err;
        }
    }

    // Move any resource files matching the resourceId under `resources/`.
    const resourcesDir = path.join(projectRoot, "resources");
    try {
        const entries = await fs.readdir(resourcesDir);
        for (const e of entries) {
            if (e.includes(resourceId)) {
                const src = path.join(resourcesDir, e);
                const dest = path.join(trashResourcesDir, `${resourceId}-${e}`);
                await fs.rename(src, dest);
            }
        }
    } catch (err: unknown) {
        if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as any).code === "ENOENT"
        ) {
            // resources directory missing: ignore
        } else {
            throw err;
        }
    }

    return trashRoot;
}

/**
 * Restore resource and sidecar from `.trash/` back to their original locations.
 * If multiple resource filenames exist in the trash, restores the first match.
 */
export async function restoreResource(
    projectRoot: string,
    resourceId: UUID,
): Promise<void> {
    const trashRoot = path.join(projectRoot, ".trash");
    const trashResourcesDir = path.join(trashRoot, "resources");
    const trashMetaDir = path.join(trashRoot, "meta");

    // Restore sidecar
    const sidecarName = sidecarFilename(resourceId);
    const sidecarSrc = path.join(trashMetaDir, sidecarName);
    const sidecarDest = sidecarPathForProject(projectRoot, resourceId);
    try {
        await ensureDir(path.dirname(sidecarDest));
        await fs.rename(sidecarSrc, sidecarDest);
    } catch (err: unknown) {
        if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as any).code === "ENOENT"
        ) {
            // sidecar not present in trash
        } else {
            throw err;
        }
    }

    // Restore resource files
    const resourcesDir = path.join(projectRoot, "resources");
    try {
        const entries = await fs.readdir(trashResourcesDir);
        for (const e of entries) {
            if (e.startsWith(resourceId + "-")) {
                const src = path.join(trashResourcesDir, e);
                const originalName = e.replace(`${resourceId}-`, "");
                await ensureDir(resourcesDir);
                const dest = path.join(resourcesDir, originalName);
                await fs.rename(src, dest);
                // restore only one file per matching entry
            }
        }
    } catch (err: unknown) {
        if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as any).code === "ENOENT"
        ) {
            // nothing to restore
        } else {
            throw err;
        }
    }
}

/**
 * Permanently remove resource and sidecar from the trash area.
 */
export async function purgeResource(
    projectRoot: string,
    resourceId: UUID,
): Promise<void> {
    const trashRoot = path.join(projectRoot, ".trash");
    const trashResourcesDir = path.join(trashRoot, "resources");
    const trashMetaDir = path.join(trashRoot, "meta");

    // Delete sidecar from trash
    const sidecarName = sidecarFilename(resourceId);
    const sidecarPath = path.join(trashMetaDir, sidecarName);
    try {
        await fs.rm(sidecarPath, { force: true });
    } catch (err) {
        // ignore
    }

    // Delete resource files from trash
    try {
        const entries = await fs.readdir(trashResourcesDir);
        for (const e of entries) {
            if (e.startsWith(resourceId + "-")) {
                const p = path.join(trashResourcesDir, e);
                await fs.rm(p, { force: true });
            }
        }
    } catch (err) {
        // ignore
    }
}

export default { softDeleteResource, restoreResource, purgeResource };
