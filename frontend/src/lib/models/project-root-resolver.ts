// Last Updated: 2026-07-25

/**
 * @module project-root-resolver
 *
 * **ADR-021 Phase 1 shared seam.** A plain, `Response`-free counterpart to
 * `project-path.ts`'s `resolveProjectPath` — same validate-then-join logic,
 * but returns `null` instead of a 400 `Response` on invalid/missing input,
 * so it can be used from non-HTTP callers (native transports).
 *
 * Extracted out of `revision-core.ts` (ADR-021 Phase 1, Task 2) so every
 * lifted transport-agnostic core (revision, query, …) shares one
 * implementation instead of each duplicating it.
 */
import path from "node:path";
import { resolveProjectsDir } from "./projects-dir";
import { InvalidProjectIdError, validateProjectId } from "./project-path";

/**
 * Validates `projectId` against the canonical UUID validator and, on
 * success, resolves it to its on-disk project directory under
 * {@link resolveProjectsDir}.
 *
 * @param projectId - The candidate project identifier to validate.
 * @returns The resolved on-disk project directory, or `null` when
 *   `projectId` is not a well-formed UUID.
 */
export function resolveProjectRoot(
  projectId: string | null | undefined,
): string | null {
  try {
    const validatedProjectId = validateProjectId(projectId ?? "");
    return path.join(resolveProjectsDir(), validatedProjectId);
  } catch (err) {
    if (err instanceof InvalidProjectIdError) return null;
    throw err;
  }
}
