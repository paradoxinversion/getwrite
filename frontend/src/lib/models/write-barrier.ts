// Last Updated: 2026-08-03

/**
 * @module write-barrier
 *
 * An exclusive, project-scoped write barrier: while one is held, every write to
 * that project is refused except those made by the holder itself.
 *
 * It exists for exactly one hazard, found by the conversion spike
 * (`docs/features/feature-specifications/end-to-end-encryption/conversion-spike.md`,
 * Hazard 1). A conversion sweep converts a file; an editor autosave then
 * rewrites that same file as plaintext; the sweep has moved on and never
 * revisits it. The project ends up marked encrypted with a plaintext file in it,
 * which surfaces to the writer as corruption.
 *
 * **Why not `meta-locks.ts`.** That serialises *metadata-affecting* operations,
 * and seven modules use it — but `resource-persistence.ts`, the content save
 * path, does not. The writes most likely to race a conversion are precisely the
 * ones it does not cover.
 *
 * **Why the check lives in `io.ts` rather than in an adapter wrapper.** It has to
 * happen at write time, not at adapter-resolution time: a barrier acquired after
 * a request resolved its adapter would otherwise miss that request's writes.
 * Checking in the `io.ts` wrappers also catches *every* write path by
 * construction, rather than by enumerating call sites and hoping none was
 * missed. And it leaves the adapter chain untouched, so FR12's guarantee — that
 * an unencrypted project's chain contains no crypto — still holds by identity.
 *
 * Reads are never barred. A half-converted project must stay readable (FR22),
 * and blocking reads would freeze the UI for the duration of a conversion.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Raised when a write is attempted against a project that is mid-conversion.
 *
 * Deliberately a fast failure rather than a wait: a conversion can take seconds,
 * and an autosave that silently blocks for that long looks like a hang. The
 * caller should surface "this project is being converted" and let the user
 * retry.
 */
export class ProjectBusyError extends Error {
  constructor(projectRoot: string) {
    super(
      `Project "${projectRoot}" is being converted and cannot be written to right now.`,
    );
    this.name = "ProjectBusyError";
  }
}

/** Project roots with a barrier currently held. */
const held = new Set<string>();

/**
 * Marks the async scope belonging to a barrier holder.
 *
 * The holder's own writes must pass — the conversion sweep is, after all, the
 * one writer that has to get through — and async-scope identity is what
 * distinguishes them from everybody else's.
 */
const holderScope = new AsyncLocalStorage<string>();

/**
 * Reports whether a barrier is held for a project.
 *
 * @param projectRoot - The project directory.
 * @returns `true` while a conversion holds the barrier.
 */
export function isWriteBarrierHeld(projectRoot: string): boolean {
  return held.has(projectRoot);
}

/**
 * Throws when the current scope may not write to `projectRoot`.
 *
 * Called by every mutating wrapper in `io.ts`. Returns immediately when no
 * barrier is held anywhere, which is the overwhelmingly common case.
 *
 * @param projectRoot - The project the write targets; `undefined` for
 *   workspace-level artefacts, which are never barred.
 * @throws {ProjectBusyError} When another scope holds this project's barrier.
 */
export function assertWritable(projectRoot: string | undefined): void {
  if (held.size === 0 || !projectRoot) return;
  if (!held.has(projectRoot)) return;
  if (holderScope.getStore() === projectRoot) return;
  throw new ProjectBusyError(projectRoot);
}

/**
 * Runs `fn` holding an exclusive write barrier on a project.
 *
 * The barrier is released when `fn` settles, including on failure — a crashed
 * conversion must not leave a project permanently unwritable.
 *
 * @param projectRoot - The project to bar writes to.
 * @param fn - The work to run; its own writes are permitted.
 * @returns Whatever `fn` returns.
 * @throws {ProjectBusyError} When a barrier is already held for this project.
 */
export async function runWithWriteBarrier<T>(
  projectRoot: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  if (held.has(projectRoot)) throw new ProjectBusyError(projectRoot);

  held.add(projectRoot);
  try {
    return await holderScope.run(projectRoot, async () => fn());
  } finally {
    held.delete(projectRoot);
  }
}

/**
 * Test-only hook clearing every held barrier, so one test's failure cannot
 * leave a project unwritable for the rest of the run.
 */
export function __resetWriteBarriersForTests(): void {
  held.clear();
}
