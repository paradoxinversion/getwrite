/**
 * @module qa/report
 *
 * Report writer for the agentic QA harness (FR-9, FR-10, FR-11, FR-16).
 *
 * After a QA run — an agent driving the real GetWrite web app and
 * independently confirming each UI-reported success against the filesystem
 * via {@link "./verify"} — this module renders a single markdown report
 * summarizing the outcome of every inventory item exercised, and writes it
 * to `specs/features/agentic-qa/run-report.md`, overwriting whatever was
 * there before (FR-9: the report is a snapshot of the most recent run, not
 * a retained history — no timestamped report directories).
 *
 * Every {@link RunItemOutcome} carries enough detail to diagnose a failure
 * without re-running anything (FR-10): the UI-reported outcome, the
 * filesystem {@link VerifyResult}s produced by `./verify.ts` (which already
 * carry concrete on-disk `checkedPaths` plus expected/actual values), and —
 * for items the agent could not even reach a control for — a distinct
 * `"unreachable"` status with a required reason (FR-11), kept separate from
 * `"fail"` because "control not found" and "filesystem check failed" are
 * different failure modes worth telling apart at a glance.
 *
 * Every report also carries a coverage-boundary statement (FR-16): how many
 * items were exercised, which feature areas were in scope, and an explicit
 * "everything else is unchecked" line. This is present even when every item
 * passes, since an all-green report is exactly the situation where a reader
 * is most likely to (wrongly) assume broader coverage than the run actually
 * had.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VerifyResult } from "./verify.js";

/** Outcome of a single inventory item after a QA run. */
export type RunItemStatus = "pass" | "fail" | "unverified" | "unreachable";

/**
 * A single inventory item's outcome for a QA run report, combining what the
 * UI reported with what the filesystem actually shows (via `./verify.ts`).
 */
export interface RunItemOutcome {
  /** Stable id matching an item in `specs/features/agentic-qa/inventory.md`. */
  itemId: string;
  /** Human-readable description of the item, from the inventory. */
  description: string;
  /** The item's overall outcome for this run. */
  status: RunItemStatus;
  /** What the UI reported, if the agent got far enough to observe it. */
  uiOutcome?: string;
  /**
   * Filesystem ground-truth checks run against this item's on-disk
   * artifacts, if any. Each carries its own concrete `checkedPaths` plus
   * expected/actual values (see `./verify.ts`).
   */
  filesystemChecks?: VerifyResult[];
  /**
   * Required when `status === "unreachable"`: why the agent could not even
   * find or interact with the control this item needed (as distinct from a
   * filesystem check that ran and failed).
   */
  unreachableReason?: string;
}

/** In-scope feature areas for the MVP inventory (FR-12). */
const IN_SCOPE_FEATURE_AREAS = ["projects", "resources", "revisions"];

/**
 * The repository root, resolved relative to this module's location
 * (`cli/src/qa/report.ts` -> repo root is three levels up), matching the
 * convention used by `./workspace.ts`'s `defaultRepoRoot`.
 */
export function defaultRepoRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..", "..");
}

/** Default location the report is written to, resolved from the repo root. */
export function defaultReportPath(
  repoRoot: string = defaultRepoRoot(),
): string {
  return path.join(
    repoRoot,
    "specs",
    "features",
    "agentic-qa",
    "run-report.md",
  );
}

/**
 * Extracts the stable item ids declared in `inventory.md`.
 *
 * The report is reconciled against this list so an item the run never
 * recorded an outcome for cannot vanish from the report. Without it, an
 * inventory item the agent could not exercise is simply absent, and the
 * summary reads "all pass" — a clean-looking report for a run that skipped
 * something. FR-11 forbids exactly that silent omission.
 *
 * Parses the `- id: \`item-id\`` lines the inventory's documented shape
 * guarantees, rather than imposing a new format on a hand-authored file.
 */
export function parseInventoryItemIds(markdown: string): string[] {
  const ids: string[] = [];
  const pattern = /^-\s+id:\s*`([^`]+)`\s*$/gm;
  let match = pattern.exec(markdown);
  while (match !== null) {
    ids.push(match[1]);
    match = pattern.exec(markdown);
  }
  return ids;
}

/**
 * Synthesises an explicit `unverified` outcome for an inventory item the run
 * recorded nothing for, so it appears in the report as a named gap instead of
 * being silently missing.
 */
function notExercisedOutcome(itemId: string): RunItemOutcome {
  return {
    itemId,
    description:
      "Declared in inventory.md but no outcome was recorded for it in this run.",
    status: "unverified",
    uiOutcome: "(item was not exercised in this run)",
  };
}

/**
 * Merges recorded outcomes with the inventory, appending a `not exercised`
 * entry for every declared item the run never reported on. Returns the
 * recorded outcomes unchanged when no inventory is supplied.
 */
export function reconcileWithInventory(
  outcomes: RunItemOutcome[],
  inventoryItemIds: string[] | undefined,
): RunItemOutcome[] {
  if (inventoryItemIds === undefined || inventoryItemIds.length === 0) {
    return outcomes;
  }
  const recorded = new Set(outcomes.map((outcome) => outcome.itemId));
  const missing = inventoryItemIds.filter((id) => !recorded.has(id));
  return [...outcomes, ...missing.map(notExercisedOutcome)];
}

interface StatusCounts {
  pass: number;
  fail: number;
  unverified: number;
  unreachable: number;
}

function countByStatus(outcomes: RunItemOutcome[]): StatusCounts {
  const counts: StatusCounts = {
    pass: 0,
    fail: 0,
    unverified: 0,
    unreachable: 0,
  };
  for (const outcome of outcomes) {
    counts[outcome.status] += 1;
  }
  return counts;
}

/** A short, glanceable marker for a status, used in headings and tables. */
function statusLabel(status: RunItemStatus): string {
  switch (status) {
    case "pass":
      return "PASS";
    case "fail":
      return "FAIL";
    case "unverified":
      return "UNVERIFIED";
    case "unreachable":
      return "UNREACHABLE";
  }
}

function renderSummaryTable(counts: StatusCounts, total: number): string {
  const lines = [
    "| Status | Count |",
    "| --- | --- |",
    `| Pass | ${counts.pass} |`,
    `| Fail | ${counts.fail} |`,
    `| Unverified | ${counts.unverified} |`,
    `| Unreachable | ${counts.unreachable} |`,
    `| **Total** | **${total}** |`,
  ];
  return lines.join("\n");
}

function renderCoverageBoundary(
  counts: StatusCounts,
  recordedCount: number,
  inventoryTotal: number | undefined,
): string {
  const exercised = counts.pass + counts.fail;
  const lines: string[] = [];

  if (inventoryTotal !== undefined) {
    // FR-16 asks for the number of items that exist as well as the number
    // exercised. Reporting only the latter lets a run that touched 3 of 4
    // items read as complete. `recordedCount` is what the run actually
    // reported on — not the reconciled total, which includes the items this
    // report had to synthesise precisely because nothing recorded them.
    lines.push(
      `This run recorded an outcome for ${recordedCount} of ${inventoryTotal} ` +
        `declared inventory item${inventoryTotal === 1 ? "" : "s"}, of which ` +
        `${exercised} ${exercised === 1 ? "was" : "were"} actually exercised ` +
        `against the filesystem. Any declared item with no recorded outcome ` +
        `is listed below as unverified — it is not evidence of anything ` +
        `working.`,
    );
  } else {
    lines.push(
      `This run exercised ${recordedCount} inventory item${recordedCount === 1 ? "" : "s"}.`,
    );
  }

  lines.push(
    "",
    `In-scope feature area${
      IN_SCOPE_FEATURE_AREAS.length === 1 ? "" : "s"
    }: ${IN_SCOPE_FEATURE_AREAS.join(", ")} (per FR-12's MVP inventory scope).`,
    "",
    "All other product areas are unchecked by this run. A pass here confirms " +
      "only that the exercised items behaved correctly on disk — it says " +
      "nothing about any feature area not listed above.",
  );

  return lines.join("\n");
}

function renderVerifyResult(result: VerifyResult, index: number): string {
  const lines = [
    `**Check ${index + 1}: \`${result.artifact}\` — ${statusLabel(
      result.status === "pass" ? "pass" : "fail",
    )}**`,
    "",
    result.message,
    "",
    "Checked paths:",
    ...result.checkedPaths.map((p) => `- \`${p}\``),
  ];
  if (result.expected !== undefined) {
    lines.push("", `Expected: \`${JSON.stringify(result.expected)}\``);
  }
  if (result.actual !== undefined) {
    lines.push("", `Actual: \`${JSON.stringify(result.actual)}\``);
  }
  return lines.join("\n");
}

function renderItemSection(outcome: RunItemOutcome): string {
  const lines = [
    `## ${outcome.itemId} — ${statusLabel(outcome.status)}`,
    "",
    outcome.description,
    "",
  ];

  if (outcome.uiOutcome !== undefined) {
    lines.push(`UI-reported outcome: ${outcome.uiOutcome}`, "");
  } else {
    // Distinct from "the agent never got here", which would be an
    // `unreachable` status. The agent may well have performed the action and
    // seen the UI respond; it simply did not record what it saw. Saying it
    // never reached this point would misdescribe the run — the exact kind of
    // false statement this report exists to avoid making.
    lines.push("UI-reported outcome: (not recorded by the agent)", "");
  }

  if (outcome.status === "unreachable") {
    lines.push(
      "**Unreachable** — the agent could not find or interact with the " +
        "control this item needed.",
      "",
      `Reason: ${outcome.unreachableReason ?? "(no reason recorded)"}`,
      "",
    );
  }

  const checks = outcome.filesystemChecks ?? [];
  if (checks.length > 0) {
    lines.push("### Filesystem checks", "");
    checks.forEach((result, index) => {
      lines.push(renderVerifyResult(result, index), "");
    });
  } else if (outcome.status !== "unreachable") {
    lines.push("No filesystem checks were run for this item.", "");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Renders a QA run's per-item outcomes into a single markdown report.
 *
 * Pure with respect to the filesystem — it returns a string and performs no
 * I/O. {@link writeRunReport} is the thin I/O wrapper around this.
 */
export function renderRunReport(
  recordedOutcomes: RunItemOutcome[],
  inventoryItemIds?: string[],
): string {
  const outcomes = reconcileWithInventory(recordedOutcomes, inventoryItemIds);
  const counts = countByStatus(outcomes);
  const total = outcomes.length;
  const inventoryTotal =
    inventoryItemIds !== undefined && inventoryItemIds.length > 0
      ? inventoryItemIds.length
      : undefined;

  const sections = [
    "# Agentic QA Run Report",
    "",
    "Generated by `getwrite-cli qa report`. This file is overwritten on " +
      "every run (FR-9) — it reflects only the most recent run, not a " +
      "history of past runs.",
    "",
    "## Summary",
    "",
    renderSummaryTable(counts, total),
    "",
    "## Coverage boundary",
    "",
    renderCoverageBoundary(counts, recordedOutcomes.length, inventoryTotal),
    "",
    "## Items",
    "",
  ];

  if (outcomes.length === 0) {
    sections.push("_No inventory items were exercised in this run._", "");
  } else {
    for (const outcome of outcomes) {
      sections.push(renderItemSection(outcome), "");
    }
  }

  return sections.join("\n").trimEnd() + "\n";
}

/**
 * Renders a QA run's outcomes and writes the result to
 * `specs/features/agentic-qa/run-report.md` (or `reportPath`, if given),
 * overwriting any existing report there (FR-9).
 *
 * @param outcomes - Per-item outcomes for this run.
 * @param reportPath - Absolute path to write the report to. Defaults to
 *   {@link defaultReportPath}, resolved relative to this module's location.
 */
export async function writeRunReport(
  outcomes: RunItemOutcome[],
  reportPath: string = defaultReportPath(),
  inventoryItemIds?: string[],
): Promise<void> {
  const markdown = renderRunReport(outcomes, inventoryItemIds);
  await writeFile(reportPath, markdown, "utf8");
}
