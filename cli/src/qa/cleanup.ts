// Last Updated: 2026-08-17

/**
 * @module qa/cleanup
 *
 * Retain-on-failure-or-unverified cleanup policy for the agentic QA harness
 * (FR-14).
 *
 * After a run, the harness must decide whether to delete the disposable
 * workspace it created (`./workspace.ts`'s `createQaWorkspace`) or keep it
 * around for a human to inspect. Per FR-14, the workspace is deleted only
 * when every exercised item passed; it is retained — never deleted — when
 * any item failed or was recorded unverified. `"unreachable"` (the fourth
 * {@link RunItemStatus} value) is treated the same as `"fail"`/`"unverified"`
 * here: it is emphatically not a `"pass"`, so any outcome that isn't a pass
 * triggers retention.
 *
 * If a still-running {@link QaServerHandle} is passed in, it is stopped
 * before the workspace directory is deleted, so deletion never races an open
 * file handle held by the dev server process.
 */
import { rm } from "node:fs/promises";
import type { QaServerHandle } from "./server.js";
import type { RunItemStatus } from "./report.js";

/**
 * The narrowest shape `applyCleanupPolicy` needs from a run's outcomes: just
 * enough to decide pass-vs-not. Callers may pass full `RunItemOutcome[]`
 * values from `./report.ts` directly, since that type is a superset of this
 * one — decoupling this module from the rest of `RunItemOutcome`'s report-
 * rendering fields (description, uiOutcome, etc.) that cleanup has no use
 * for.
 */
export interface CleanupOutcome {
  /** The item's overall outcome for this run. */
  status: RunItemStatus;
}

/** Result of applying the cleanup policy to a run's outcomes. */
export type CleanupResult =
  | {
      /** The workspace directory was deleted. */
      action: "deleted";
      /** The workspace path that was deleted. */
      workspacePath: string;
      /** Human-readable summary of what happened. */
      message: string;
    }
  | {
      /** The workspace directory was retained for inspection. */
      action: "retained";
      /** The workspace path that was retained, for the caller to surface. */
      workspacePath: string;
      /** Human-readable summary pointing at the retained workspace's path. */
      message: string;
    };

/**
 * Returns `true` only when at least one item was exercised AND every one of
 * them passed.
 *
 * The empty case is deliberately NOT treated as all-passed. Reading FR-14's
 * "delete only when every exercised item passed" as vacuously true for an
 * empty set makes a run that verified nothing indistinguishable from a run
 * that verified everything: the harness deletes the workspace and reports
 * "every exercised item passed" having checked nothing at all. That is the
 * precise failure mode this feature exists to catch (see FR-16, which
 * requires a report to state its own coverage boundary rather than let a
 * clean result imply broad health), so the harness must not commit it
 * itself. A run with no outcomes retains its workspace.
 */
function allPassed(outcomes: CleanupOutcome[]): boolean {
  if (outcomes.length === 0) {
    return false;
  }
  return outcomes.every((outcome) => outcome.status === "pass");
}

/**
 * Applies the FR-14 retain-on-failure-or-unverified cleanup policy to a run's
 * outcomes: deletes the disposable workspace only when every exercised item
 * passed, otherwise retains it and reports its path.
 *
 * Stops `serverHandle` (if given and still running) before deleting the
 * workspace, so deletion never races an open file handle held by the dev
 * server process. `serverHandle` is optional — a caller (e.g. `qa finish`)
 * may have already stopped the server itself before calling into cleanup.
 *
 * @param outcomes - Per-item outcomes for this run (or any subset shape
 *   carrying just `status`, per {@link CleanupOutcome}).
 * @param workspacePath - Absolute path to the disposable workspace directory
 *   created by `./workspace.ts`'s `createQaWorkspace`.
 * @param serverHandle - The running QA dev server, if any, to stop before
 *   deleting the workspace.
 * @returns Whether the workspace was deleted or retained, and a
 *   human-readable message. When retained, `workspacePath` is the path the
 *   caller should surface to a human for inspection.
 */
export async function applyCleanupPolicy(
  outcomes: CleanupOutcome[],
  workspacePath: string,
  serverHandle?: QaServerHandle,
): Promise<CleanupResult> {
  if (!allPassed(outcomes)) {
    if (serverHandle !== undefined) {
      await serverHandle.stop();
    }
    const reason =
      outcomes.length === 0
        ? "no inventory item was exercised at all, so this run verified " +
          "nothing and must not be reported as clean"
        : "at least one exercised item did not pass (fail, unverified, or " +
          "unreachable)";

    return {
      action: "retained",
      workspacePath,
      message:
        `Retaining QA workspace at "${workspacePath}" — ${reason}. ` +
        "Inspect the on-disk state there before deleting it manually.",
    };
  }

  if (serverHandle !== undefined) {
    await serverHandle.stop();
  }
  await rm(workspacePath, { recursive: true, force: true });

  return {
    action: "deleted",
    workspacePath,
    message: `Deleted QA workspace at "${workspacePath}" — every exercised item passed.`,
  };
}
