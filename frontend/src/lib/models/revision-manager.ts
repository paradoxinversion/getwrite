import fs from "node:fs/promises";
import path from "node:path";
import type { UUID, Revision } from "./types";
import {
    listRevisions,
    writeRevision,
    pruneRevisions,
    revisionsBaseDir,
    setCanonicalRevision,
    getCanonicalRevision,
} from "./revision";
import { acquireLock } from "./locks";

/** Determine the next version number for a resource (1-based, sequential). */
export async function nextVersionNumber(
    projectRoot: string,
    resourceId: UUID,
): Promise<number> {
    const revs = await listRevisions(projectRoot, resourceId);
    if (revs.length === 0) return 1;
    return revs[revs.length - 1].versionNumber + 1;
}

type CreateOptions = {
    author?: string;
    isCanonical?: boolean;
    versionNumber?: number;
    maxRevisions?: number;
};

/**
 * Create a new revision for `resourceId`. Ensures pruning is applied after
 * creation according to `maxRevisions` (defaults to 50 if unset).
 */
export async function createRevision(
    projectRoot: string,
    resourceId: UUID,
    content: string | Buffer,
    options: CreateOptions = {},
): Promise<Revision> {
    // Acquire a per-resource lock to prevent concurrent create/prune races.
    const release = await acquireLock(resourceId);
    try {
        const versionNumber =
            options.versionNumber ??
            (await nextVersionNumber(projectRoot, resourceId));

        const rev = await writeRevision(
            projectRoot,
            resourceId,
            versionNumber,
            content,
            { author: options.author, isCanonical: !!options.isCanonical },
        );

        if (options.isCanonical) {
            await setCanonicalRevision(projectRoot, resourceId, versionNumber);
        }

        const maxRevisions = options.maxRevisions ?? 50;
        await pruneRevisions(projectRoot, resourceId, maxRevisions);

        return rev;
    } finally {
        release();
    }
}

/** Mark the specified revision as canonical and unset others. */

export default {
    nextVersionNumber,
    createRevision,
    // canonical functions live in storage (`revision.ts`); manager delegates when needed
};
