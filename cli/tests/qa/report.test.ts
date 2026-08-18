import { describe, it, test, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  renderRunReport,
  writeRunReport,
  parseInventoryItemIds,
  reconcileWithInventory,
  type RunItemOutcome,
} from "../../src/qa/report";
import type { VerifyResult } from "../../src/qa/verify";

async function withTmp(fn: (dir: string) => Promise<void>): Promise<void> {
  const tmp = await fs.mkdtemp(
    path.join(os.tmpdir(), "getwrite-cli-qa-report-"),
  );
  try {
    await fn(tmp);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

function passResult(): VerifyResult {
  return {
    status: "pass",
    artifact: "project-manifest",
    message: "project.json found and matches expectations for project proj-1",
    checkedPaths: ["/tmp/workspace/proj-1/project.json"],
    expected: { name: "My Novel" },
    actual: { id: "proj-1", name: "My Novel" },
  };
}

function failResult(): VerifyResult {
  return {
    status: "fail",
    artifact: "resource-content",
    message: "content.txt does not match expected text for resource res-1",
    checkedPaths: [
      "/tmp/workspace/proj-1/resources/res-1/content.txt",
      "/tmp/workspace/proj-1/resources/res-1/content.tiptap.json",
    ],
    expected: "Chapter One begins here.",
    actual: "Chapter One begins.",
  };
}

function mixedOutcomes(): RunItemOutcome[] {
  return [
    {
      itemId: "ITEM-1",
      description: "Create a new project from the novel template",
      status: "pass",
      uiOutcome: "Project created and opened in the editor",
      filesystemChecks: [passResult()],
    },
    {
      itemId: "ITEM-2",
      description: "Edit resource content and confirm it autosaves",
      status: "fail",
      uiOutcome: "Editor showed the edited text",
      filesystemChecks: [failResult()],
    },
    {
      itemId: "ITEM-3",
      description: "Rename a resource via the context menu",
      status: "unverified",
      uiOutcome: "Rename appeared to succeed but no filesystem check ran",
    },
    {
      itemId: "ITEM-4",
      description: "Open the encryption settings panel",
      status: "unreachable",
      unreachableReason:
        "Could not find the 'Encryption' menu item in the settings sidebar",
    },
  ];
}

function allPassOutcomes(): RunItemOutcome[] {
  return [
    {
      itemId: "ITEM-1",
      description: "Create a new project from the novel template",
      status: "pass",
      uiOutcome: "Project created and opened in the editor",
      filesystemChecks: [passResult()],
    },
    {
      itemId: "ITEM-2",
      description: "Create a revision and confirm it lists in history",
      status: "pass",
      uiOutcome: "New revision appeared at the top of the history list",
      filesystemChecks: [passResult()],
    },
  ];
}

test("renderRunReport includes a per-item status line for every outcome", () => {
  const report = renderRunReport(mixedOutcomes());

  expect(report).toContain("ITEM-1");
  expect(report).toContain("PASS");
  expect(report).toContain("ITEM-2");
  expect(report).toContain("FAIL");
  expect(report).toContain("ITEM-3");
  expect(report).toContain("UNVERIFIED");
  expect(report).toContain("ITEM-4");
  expect(report).toContain("UNREACHABLE");
});

test("renderRunReport includes the fail item's concrete checked paths and expected/actual values", () => {
  const report = renderRunReport(mixedOutcomes());

  expect(report).toContain("/tmp/workspace/proj-1/resources/res-1/content.txt");
  expect(report).toContain(
    "/tmp/workspace/proj-1/resources/res-1/content.tiptap.json",
  );
  expect(report).toContain("Chapter One begins here.");
  expect(report).toContain("Chapter One begins.");
  expect(report).toContain(
    "content.txt does not match expected text for resource res-1",
  );
});

test("renderRunReport gives unreachable items a distinct rendering with a reason, separate from fail", () => {
  const report = renderRunReport(mixedOutcomes());

  expect(report.toLowerCase()).toContain("unreachable");
  expect(report).toContain(
    "Could not find the 'Encryption' menu item in the settings sidebar",
  );

  // The unreachable item's own section must not be labeled FAIL.
  const unreachableSectionStart = report.indexOf("## ITEM-4");
  const nextSectionStart = report.indexOf("## ", unreachableSectionStart + 1);
  const unreachableSection = report.slice(
    unreachableSectionStart,
    nextSectionStart === -1 ? undefined : nextSectionStart,
  );
  expect(unreachableSection).toContain("UNREACHABLE");
  expect(unreachableSection).not.toContain("FAIL");
});

test("renderRunReport states its coverage boundary on a mixed-outcome run", () => {
  const report = renderRunReport(mixedOutcomes());

  expect(report).toContain("4 inventory items");
  expect(report).toContain("projects");
  expect(report).toContain("resources");
  expect(report).toContain("revisions");
  expect(report.toLowerCase()).toMatch(/unchecked|not checked/);
});

test("renderRunReport states its coverage boundary even when every outcome is pass (FR-16)", () => {
  const report = renderRunReport(allPassOutcomes());

  // Every item passed — this must not read as an unqualified "it works" claim.
  expect(report).toContain("PASS");
  expect(report).not.toContain("FAIL");
  expect(report).not.toContain("UNREACHABLE");

  expect(report).toContain("2 inventory items");
  expect(report).toContain("projects");
  expect(report).toContain("resources");
  expect(report).toContain("revisions");
  expect(report.toLowerCase()).toMatch(/unchecked|not checked/);
  expect(report.toLowerCase()).toContain("other product areas");
});

test("renderRunReport states the coverage boundary even for an empty run", () => {
  const report = renderRunReport([]);

  expect(report).toContain("0 inventory items");
  expect(report.toLowerCase()).toMatch(/unchecked|not checked/);
});

test("writeRunReport writes the rendered markdown to the given path", async () => {
  await withTmp(async (dir) => {
    const reportPath = path.join(dir, "run-report.md");
    const outcomes = mixedOutcomes();

    await writeRunReport(outcomes, reportPath);

    const written = await fs.readFile(reportPath, "utf8");
    expect(written).toBe(renderRunReport(outcomes));
    expect(written).toContain("ITEM-2");
    expect(written).toContain("FAIL");
  });
});

test("writeRunReport overwrites an existing report rather than appending", async () => {
  await withTmp(async (dir) => {
    const reportPath = path.join(dir, "run-report.md");

    await writeRunReport(mixedOutcomes(), reportPath);
    await writeRunReport(allPassOutcomes(), reportPath);

    const written = await fs.readFile(reportPath, "utf8");
    expect(written).toBe(renderRunReport(allPassOutcomes()));
    expect(written).not.toContain("ITEM-4");
  });
});

describe("inventory reconciliation (FR-11)", () => {
  const INVENTORY = `
### proj-create-manifest

- id: \`proj-create-manifest\`
- status: pass

### rev-create-snapshot

- id: \`rev-create-snapshot\`
- status: unverified
`;

  it("extracts the declared item ids from inventory markdown", () => {
    expect(parseInventoryItemIds(INVENTORY)).toEqual([
      "proj-create-manifest",
      "rev-create-snapshot",
    ]);
  });

  it("names an inventory item the run never recorded, instead of omitting it", () => {
    // The defect this guards against: an item the agent could not exercise
    // simply vanished from the report, so a partial run rendered as clean.
    const recorded: RunItemOutcome[] = [
      {
        itemId: "proj-create-manifest",
        description: "project manifest",
        status: "pass",
      },
    ];

    const markdown = renderRunReport(
      recorded,
      parseInventoryItemIds(INVENTORY),
    );

    expect(markdown).toContain("rev-create-snapshot");
    expect(markdown).toMatch(/1 of 2 declared inventory items/);
    expect(markdown).toContain("| Unverified | 1 |");
  });

  it("does not report an all-pass summary when an item was never exercised", () => {
    const markdown = renderRunReport(
      [
        {
          itemId: "proj-create-manifest",
          description: "project manifest",
          status: "pass",
        },
      ],
      parseInventoryItemIds(INVENTORY),
    );

    // Total must count the declared item too, so the summary can never read
    // as "everything passed" while an item is missing.
    expect(markdown).toContain("| **Total** | **2** |");
  });

  it("leaves outcomes untouched when no inventory is available", () => {
    const recorded: RunItemOutcome[] = [
      { itemId: "only-item", description: "d", status: "pass" },
    ];
    expect(reconcileWithInventory(recorded, undefined)).toEqual(recorded);
    expect(reconcileWithInventory(recorded, [])).toEqual(recorded);
  });
});
