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

function renderCoverageBoundary(total: number): string {
  return [
    `This run exercised ${total} inventory item${total === 1 ? "" : "s"}, ` +
      `covering the following in-scope feature area${
        IN_SCOPE_FEATURE_AREAS.length === 1 ? "" : "s"
      }: ${IN_SCOPE_FEATURE_AREAS.join(", ")} (per FR-12's MVP inventory scope).`,
    "",
    "All other product areas are unchecked by this run. A pass here confirms " +
      "only that the exercised items behaved correctly on disk — it says " +
      "nothing about any feature area not listed above.",
  ].join("\n");
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
export function renderRunReport(outcomes: RunItemOutcome[]): string {
  const counts = countByStatus(outcomes);
  const total = outcomes.length;

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
    renderCoverageBoundary(total),
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
): Promise<void> {
  const markdown = renderRunReport(outcomes);
  await writeFile(reportPath, markdown, "utf8");
}
