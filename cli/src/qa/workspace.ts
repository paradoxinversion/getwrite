// Last Updated: 2026-08-17

/**
 * @module workspace
 *
 * Disposable filesystem workspace creation for the agentic QA harness
 * (FR-1, FR-2).
 *
 * `createQaWorkspace` creates a fresh, empty directory under the OS temp
 * directory (via the standard `fs.mkdtemp` pattern) for use as
 * `GETWRITE_PROJECTS_DIR` when pointing a disposable dev server at a
 * throwaway `projects/`-shaped tree. It never touches the repository's real
 * `projects/` directory: the created path is verified — not merely assumed —
 * to fall outside the repo root by resolving both paths and asserting
 * non-containment. This is what makes FR-2 ("MUST NOT read from or write to
 * the real `projects/` directory") a build-time guarantee rather than a
 * convention.
 */
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Prefix applied to every QA workspace directory name. */
const WORKSPACE_PREFIX = "getwrite-qa-";

/**
 * The repository root, resolved relative to this module's location
 * (`cli/src/qa/workspace.ts` -> repo root is three levels up).
 *
 * Callers that already know the repo root (e.g. because they resolved it
 * from a CLI flag or `process.cwd()`) should pass it explicitly to
 * {@link createQaWorkspace} instead of relying on this default.
 */
export function defaultRepoRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..", "..");
}

/**
 * Raised when a created workspace directory resolves to be inside the repo
 * root — i.e. the containment guarantee that makes FR-2 true by construction
 * would otherwise be violated.
 */
export class WorkspaceContainmentError extends Error {
  constructor(workspacePath: string, repoRoot: string) {
    super(
      `Refusing to use QA workspace "${workspacePath}": it resolves inside ` +
        `the repository root "${repoRoot}". The agentic QA harness must ` +
        `never read from or write to the real projects/ directory.`,
    );
    this.name = "WorkspaceContainmentError";
  }
}

/**
 * Returns `true` when `candidate` is `ancestor` itself or a path nested
 * under it, comparing fully-resolved absolute paths.
 */
function isPathContainedBy(candidate: string, ancestor: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedAncestor = path.resolve(ancestor);
  const relative = path.relative(resolvedAncestor, resolvedCandidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * Creates a fresh, empty disposable workspace directory under the OS temp
 * directory, guaranteed (checked, not assumed) to fall outside the
 * repository tree.
 *
 * @param repoRoot - The repository root to verify non-containment against.
 *   Defaults to {@link defaultRepoRoot}, resolved relative to this module's
 *   location.
 * @returns The absolute path to the newly created, empty directory, safe for
 *   use as `GETWRITE_PROJECTS_DIR`.
 * @throws {WorkspaceContainmentError} if the created directory resolves to
 *   be inside `repoRoot`.
 *
 * @example
 * ```ts
 * const projectsDir = await createQaWorkspace();
 * // spawn the dev server with GETWRITE_PROJECTS_DIR=projectsDir
 * ```
 */
export async function createQaWorkspace(
  repoRoot: string = defaultRepoRoot(),
): Promise<string> {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const workspacePath = await mkdtemp(path.join(tmpdir(), WORKSPACE_PREFIX));
  const resolvedWorkspacePath = path.resolve(workspacePath);

  if (isPathContainedBy(resolvedWorkspacePath, resolvedRepoRoot)) {
    throw new WorkspaceContainmentError(
      resolvedWorkspacePath,
      resolvedRepoRoot,
    );
  }

  return resolvedWorkspacePath;
}
