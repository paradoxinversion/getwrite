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
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync, statSync, type Stats } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Prefix applied to every QA workspace directory name. */
const WORKSPACE_PREFIX = "getwrite-qa-";

/**
 * Environment variable overriding where the QA session record is stored.
 * Takes an absolute path to the session *file* (not its directory).
 */
export const QA_SESSION_PATH_ENV = "GETWRITE_QA_SESSION_PATH";

/**
 * Absolute path to the directory holding the harness's cross-invocation
 * state (the session record and the dev-server log).
 *
 * Honors {@link QA_SESSION_PATH_ENV} when set, so callers that need the state
 * somewhere else (tests, or a checkout without a `.git/` directory) get a
 * single override that every sub-command resolves through.
 */
export function qaStateDir(repoRoot: string = defaultRepoRoot()): string {
  const override = process.env[QA_SESSION_PATH_ENV];
  if (override !== undefined && override.length > 0) {
    return path.dirname(path.resolve(override));
  }
  const resolvedRoot = path.resolve(repoRoot);
  const gitDir = resolveGitDir(resolvedRoot);
  // No usable git directory (a source export, say) — keep the state in an
  // untracked dot-directory at the root rather than failing outright.
  return gitDir === null
    ? path.join(resolvedRoot, ".getwrite-qa")
    : path.join(gitDir, "getwrite-qa");
}

/**
 * Resolves the real git directory for a checkout.
 *
 * `.git` is only a directory in an ordinary clone. In a linked worktree or a
 * submodule it is a *file* containing `gitdir: <path>`, and treating it as a
 * directory makes `mkdir(<root>/.git/getwrite-qa)` fail with `ENOTDIR` — which
 * would leave the harness unusable in exactly the worktrees this repo creates
 * for background agents.
 *
 * Returns `null` when there is no usable git directory, leaving the caller to
 * pick a fallback.
 */
function resolveGitDir(resolvedRepoRoot: string): string | null {
  const dotGit = path.join(resolvedRepoRoot, ".git");
  let stats: Stats;
  try {
    stats = statSync(dotGit);
  } catch {
    return null;
  }

  if (stats.isDirectory()) return dotGit;

  // A worktree/submodule pointer file: `gitdir: /abs/or/relative/path`.
  try {
    const pointer = readFileSync(dotGit, "utf8");
    const match = /^gitdir:\s*(.+)$/m.exec(pointer);
    if (match?.[1] !== undefined) {
      const target = match[1].trim();
      return path.isAbsolute(target)
        ? target
        : path.resolve(resolvedRepoRoot, target);
    }
  } catch {
    // Unreadable pointer — fall through.
  }

  return null;
}

/**
 * Absolute path to the QA session record, shared by `qa start`, `qa verify`,
 * `qa record`, `qa report`, and `qa finish`.
 */
export function qaSessionFilePath(
  repoRoot: string = defaultRepoRoot(),
): string {
  const override = process.env[QA_SESSION_PATH_ENV];
  if (override !== undefined && override.length > 0) {
    return path.resolve(override);
  }
  return path.join(qaStateDir(repoRoot), "session.json");
}

/**
 * Absolute path the spawned dev server's stdout/stderr is written to.
 *
 * Deliberately *not* inside the run's `GETWRITE_PROJECTS_DIR`: the app scans
 * that directory for projects, and a log file sitting in it is a foreign
 * entry in a tree that should contain nothing but projects. Keeping it beside
 * the session record also means it survives `qa finish`'s workspace deletion,
 * so a failing run's evidence is still readable afterwards.
 */
export function qaServerLogPath(repoRoot: string = defaultRepoRoot()): string {
  return path.join(qaStateDir(repoRoot), "qa-server.log");
}

/**
 * Absolute path to the run-scoped Next.js `distDir` for `runId`.
 *
 * Every QA run gets its own build directory so it can neither be poisoned by
 * a stale/corrupt shared `frontend/.next` nor poison that cache for ordinary
 * development or the harness's own test suite. It lives under `frontend/`
 * (rather than in the run's workspace) because Next resolves `distDir`
 * relative to the project directory; `frontend/.next-qa/` is gitignored, so a
 * run still leaves `git status` clean.
 */
export function qaDistDir(runId: string, repoRoot: string): string {
  return path.join(path.resolve(repoRoot), "frontend", ".next-qa", runId);
}

/**
 * Path to the tracked TypeScript config that starting `next dev` rewrites.
 *
 * Next verifies this file on start and writes back a reformatted copy with
 * the run's `distDir` type paths appended, leaving a QA run's checkout dirty.
 * Redirecting Next at an untracked config via `typescript.tsconfigPath` was
 * tried and rejected: with a non-default tsconfig path this Next version
 * stops discovering the App Router routes entirely (every request 404s, with
 * a plain copy of the real config as much as with one that `extends` it). So
 * the harness lets the rewrite happen and restores the file afterwards — see
 * `qa start`/`qa finish`, which snapshot and restore it around the run.
 */
export function qaTrackedTsconfigPath(repoRoot: string): string {
  return path.join(path.resolve(repoRoot), "frontend", "tsconfig.json");
}

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
    // `mkdtemp` both names and creates the directory, so it already exists by
    // the time containment can be checked. Throwing without removing it leaks
    // a `getwrite-qa-*` directory into the OS temp dir on every rejected
    // call — including from this module's own test suite, which is where the
    // observed accumulation came from.
    await rm(resolvedWorkspacePath, { recursive: true, force: true }).catch(
      () => {
        // Best effort: the containment violation is the error worth raising.
      },
    );
    throw new WorkspaceContainmentError(
      resolvedWorkspacePath,
      resolvedRepoRoot,
    );
  }

  return resolvedWorkspacePath;
}
