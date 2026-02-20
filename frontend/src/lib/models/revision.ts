import type { Revision } from "./types";

/**
 * Determine which revisions should be pruned when enforcing a maximum retained
 * revisions count for a resource.
 *
 * Behavior:
 * - Preserves any revision with `isCanonical === true`.
 * - Prefers removing the oldest non-canonical revisions first (by
 *   `versionNumber`, ascending). Caller may then delete the returned revisions.
 * - Returns an array of revisions that are safe candidates for pruning. If the
 *   number of non-canonical revisions is insufficient to reach `maxRevisions`,
 *   this function will return all available non-canonical revisions (caller
 *   decides further action).
 *
 * Pure function: does not mutate input.
 */
export function selectPruneCandidates(
    revisions: Revision[],
    maxRevisions: number,
): Revision[] {
    if (maxRevisions < 0)
        throw new RangeError("maxRevisions must be non-negative");

    const total = revisions.length;
    if (total <= maxRevisions) return [];

    // Filter out canonical revisions - they must be preserved.
    const nonCanonical = revisions.filter((r) => !r.isCanonical);

    // If there are no safe candidates, return empty and let caller decide.
    if (nonCanonical.length === 0) return [];

    // Sort non-canonical by versionNumber ascending (oldest first). Use stable
    // sorting semantics: create a shallow copy first to avoid mutating input.
    const sorted = [...nonCanonical].sort(
        (a, b) => a.versionNumber - b.versionNumber,
    );

    const toRemoveCount = Math.max(0, total - maxRevisions);

    // Return up to `toRemoveCount` oldest non-canonical revisions.
    return sorted.slice(0, toRemoveCount);
}

export default { selectPruneCandidates };
