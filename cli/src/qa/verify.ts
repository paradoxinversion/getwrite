/**
 * @module qa/verify
 *
 * Filesystem "ground truth" verification for the agentic QA harness.
 *
 * GetWrite is local-first and file-backed (see CLAUDE.md's "Data Layer (No
 * Database)" section): every user-facing action — create project, create
 * resource, save content, create a revision — leaves an observable trace
 * under `<workspaceRoot>/<projectId>/...`. This module is the shared
 * vocabulary an agent driving the real app (via Playwright MCP, elsewhere)
 * uses to independently confirm a UI-reported success actually happened on
 * disk, rather than trusting the UI.
 *
 * One function per artifact kind:
 * - {@link verifyProjectManifest} — `<projectId>/project.json`
 * - {@link verifyResourceContent} — `<projectId>/resources/<resourceId>/content.txt`
 *   (+ `content.tiptap.json`)
 * - {@link verifyResourceSidecar} — `<projectId>/meta/resource-<resourceId>.meta.json`
 * - {@link verifyRevision} — `<projectId>/revisions/<resourceId>/v-<N>/`
 *
 * Every function is pure with respect to the outside world in the sense that
 * matters here: it only *reads* the filesystem, never writes, and it never
 * throws on the expected "not found" / "malformed" cases — those resolve to
 * a `fail` {@link VerifyResult} so a UI-reported success with no matching
 * artifact always resolves to a fail, never a silent pass. Unexpected I/O
 * errors (permission denied, etc.) are also captured as `fail` results
 * rather than propagated, since a report writer (Task 6) needs a result
 * object for every call, not a thrown exception to catch.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Pass/fail outcome of a single verification check. */
export type VerifyStatus = "pass" | "fail";

/** Which on-disk artifact kind a {@link VerifyResult} describes. */
export type VerifyArtifactKind =
  | "project-manifest"
  | "resource-content"
  | "resource-sidecar"
  | "revision";

/**
 * Structured outcome of a single verification check, shaped for a future
 * report writer (Task 6, FR-10) to render a useful failure message without
 * re-running anything: it always carries the concrete path checked, plus
 * what was expected vs. what was actually found.
 */
export interface VerifyResult {
  /** `"pass"` when the artifact was present and matched expectations. */
  status: VerifyStatus;
  /** Which artifact kind this result describes. */
  artifact: VerifyArtifactKind;
  /** Human-readable summary, suitable for a one-line report entry. */
  message: string;
  /** Absolute path(s) on disk that were checked. */
  checkedPaths: string[];
  /**
   * What was expected. `undefined` when the caller supplied no expectation
   * (in which case "artifact present and well-formed" is itself the bar).
   */
  expected?: unknown;
  /** What was actually found on disk. `undefined` when nothing was found. */
  actual?: unknown;
}

/** Minimal expected-field shape for {@link verifyProjectManifest}. */
export interface ExpectedProjectManifest {
  id?: string;
  name?: string;
  projectType?: string;
}

/** Minimal expected-field shape for {@link verifyResourceSidecar}. */
export interface ExpectedResourceSidecar {
  id?: string;
  name?: string;
  type?: string;
  folderId?: string | null;
}

function buildResult(
  artifact: VerifyArtifactKind,
  status: VerifyStatus,
  message: string,
  checkedPaths: string[],
  expected?: unknown,
  actual?: unknown,
): VerifyResult {
  return { status, artifact, message, checkedPaths, expected, actual };
}

/** Distinguishes "file does not exist" from other read/parse errors. */
function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/**
 * Read and JSON-parse a file, distinguishing "missing" from "unreadable /
 * malformed" so callers can produce an accurate fail message. Never throws:
 * the discriminated return communicates every outcome.
 */
async function readJsonFile(
  filePath: string,
): Promise<
  | { outcome: "missing" }
  | { outcome: "error"; error: string }
  | { outcome: "ok"; data: unknown }
> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err: unknown) {
    if (isNotFoundError(err)) return { outcome: "missing" };
    return { outcome: "error", error: (err as Error).message };
  }
  try {
    return { outcome: "ok", data: JSON.parse(raw) as unknown };
  } catch (err: unknown) {
    return { outcome: "error", error: (err as Error).message };
  }
}

/** Path to a project's manifest file. */
function projectManifestPath(workspaceRoot: string, projectId: string): string {
  return path.join(workspaceRoot, projectId, "project.json");
}

/**
 * Verify a project's `project.json` manifest is present and, if `expected`
 * fields are supplied, that they match what's on disk.
 */
export async function verifyProjectManifest(
  workspaceRoot: string,
  projectId: string,
  expected?: ExpectedProjectManifest,
): Promise<VerifyResult> {
  const manifestPath = projectManifestPath(workspaceRoot, projectId);
  const read = await readJsonFile(manifestPath);

  if (read.outcome === "missing") {
    return buildResult(
      "project-manifest",
      "fail",
      `project.json not found for project ${projectId}`,
      [manifestPath],
      expected,
      undefined,
    );
  }
  if (read.outcome === "error") {
    return buildResult(
      "project-manifest",
      "fail",
      `project.json could not be read/parsed: ${read.error}`,
      [manifestPath],
      expected,
      undefined,
    );
  }

  const manifest = read.data as Record<string, unknown>;
  const mismatches = diffExpected(
    manifest,
    expected as Record<string, unknown> | undefined,
  );

  if (mismatches.length > 0) {
    return buildResult(
      "project-manifest",
      "fail",
      `project.json exists but does not match expectations: ${mismatches.join(", ")}`,
      [manifestPath],
      expected,
      manifest,
    );
  }

  return buildResult(
    "project-manifest",
    "pass",
    `project.json found and matches expectations for project ${projectId}`,
    [manifestPath],
    expected,
    manifest,
  );
}

/** Path to a resource's plain-text and TipTap content files. */
function resourceContentPaths(
  workspaceRoot: string,
  projectId: string,
  resourceId: string,
): { plainTextPath: string; tiptapPath: string } {
  const base = path.join(workspaceRoot, projectId, "resources", resourceId);
  return {
    plainTextPath: path.join(base, "content.txt"),
    tiptapPath: path.join(base, "content.tiptap.json"),
  };
}

/**
 * Verify a resource's on-disk content (`content.txt`, and presence of
 * `content.tiptap.json`) exists and, if `expectedText` is supplied, that the
 * plain-text content matches exactly.
 */
export async function verifyResourceContent(
  workspaceRoot: string,
  projectId: string,
  resourceId: string,
  expectedText?: string,
): Promise<VerifyResult> {
  const { plainTextPath, tiptapPath } = resourceContentPaths(
    workspaceRoot,
    projectId,
    resourceId,
  );
  const checkedPaths = [plainTextPath, tiptapPath];

  let actualText: string;
  try {
    actualText = await readFile(plainTextPath, "utf8");
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return buildResult(
        "resource-content",
        "fail",
        `content.txt not found for resource ${resourceId}`,
        checkedPaths,
        expectedText,
        undefined,
      );
    }
    return buildResult(
      "resource-content",
      "fail",
      `content.txt could not be read: ${(err as Error).message}`,
      checkedPaths,
      expectedText,
      undefined,
    );
  }

  let tiptapPresent = true;
  try {
    await readFile(tiptapPath, "utf8");
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      tiptapPresent = false;
    } else {
      return buildResult(
        "resource-content",
        "fail",
        `content.tiptap.json could not be read: ${(err as Error).message}`,
        checkedPaths,
        expectedText,
        actualText,
      );
    }
  }

  if (!tiptapPresent) {
    return buildResult(
      "resource-content",
      "fail",
      `content.tiptap.json not found for resource ${resourceId}`,
      checkedPaths,
      expectedText,
      actualText,
    );
  }

  if (expectedText !== undefined && actualText !== expectedText) {
    return buildResult(
      "resource-content",
      "fail",
      `content.txt does not match expected text for resource ${resourceId}`,
      checkedPaths,
      expectedText,
      actualText,
    );
  }

  return buildResult(
    "resource-content",
    "pass",
    `content.txt (and content.tiptap.json) found for resource ${resourceId}${
      expectedText !== undefined ? " and matches expected text" : ""
    }`,
    checkedPaths,
    expectedText,
    actualText,
  );
}

/** Path to a resource's sidecar metadata file. */
function resourceSidecarPath(
  workspaceRoot: string,
  projectId: string,
  resourceId: string,
): string {
  return path.join(
    workspaceRoot,
    projectId,
    "meta",
    `resource-${resourceId}.meta.json`,
  );
}

/**
 * Verify a resource's sidecar (`meta/resource-<id>.meta.json`) is present
 * and, if `expected` fields are supplied, that they match what's on disk.
 */
export async function verifyResourceSidecar(
  workspaceRoot: string,
  projectId: string,
  resourceId: string,
  expected?: ExpectedResourceSidecar,
): Promise<VerifyResult> {
  const sidecarPath = resourceSidecarPath(workspaceRoot, projectId, resourceId);
  const read = await readJsonFile(sidecarPath);

  if (read.outcome === "missing") {
    return buildResult(
      "resource-sidecar",
      "fail",
      `sidecar not found for resource ${resourceId}`,
      [sidecarPath],
      expected,
      undefined,
    );
  }
  if (read.outcome === "error") {
    return buildResult(
      "resource-sidecar",
      "fail",
      `sidecar could not be read/parsed: ${read.error}`,
      [sidecarPath],
      expected,
      undefined,
    );
  }

  const sidecar = read.data as Record<string, unknown>;
  const mismatches = diffExpected(
    sidecar,
    expected as Record<string, unknown> | undefined,
  );

  if (mismatches.length > 0) {
    return buildResult(
      "resource-sidecar",
      "fail",
      `sidecar exists but does not match expectations: ${mismatches.join(", ")}`,
      [sidecarPath],
      expected,
      sidecar,
    );
  }

  return buildResult(
    "resource-sidecar",
    "pass",
    `sidecar found and matches expectations for resource ${resourceId}`,
    [sidecarPath],
    expected,
    sidecar,
  );
}

/** Path to the directory holding all revisions for a resource. */
function revisionsBaseDir(
  workspaceRoot: string,
  projectId: string,
  resourceId: string,
): string {
  return path.join(workspaceRoot, projectId, "revisions", resourceId);
}

/**
 * Verify a resource has at least one revision on disk under
 * `revisions/<resourceId>/v-<N>/`, each with a `metadata.json` and
 * `content.bin`. If `expectedMinCount` is supplied, also fail when fewer
 * than that many well-formed revision folders are found.
 */
export async function verifyRevision(
  workspaceRoot: string,
  projectId: string,
  resourceId: string,
  expectedMinCount?: number,
): Promise<VerifyResult> {
  const baseDir = revisionsBaseDir(workspaceRoot, projectId, resourceId);

  let entries: string[];
  try {
    entries = (await readdir(baseDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && e.name.startsWith("v-"))
      .map((e) => e.name);
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return buildResult(
        "revision",
        "fail",
        `no revisions directory found for resource ${resourceId}`,
        [baseDir],
        expectedMinCount,
        0,
      );
    }
    return buildResult(
      "revision",
      "fail",
      `revisions directory could not be read: ${(err as Error).message}`,
      [baseDir],
      expectedMinCount,
      undefined,
    );
  }

  const wellFormed: string[] = [];
  const checkedPaths = [baseDir];
  for (const name of entries) {
    const dir = path.join(baseDir, name);
    checkedPaths.push(dir);
    const metadataRead = await readJsonFile(path.join(dir, "metadata.json"));
    if (metadataRead.outcome !== "ok") continue;
    try {
      await readFile(path.join(dir, "content.bin"));
    } catch {
      continue;
    }
    wellFormed.push(name);
  }

  const actualCount = wellFormed.length;
  const minCount = expectedMinCount ?? 1;

  if (actualCount < minCount) {
    return buildResult(
      "revision",
      "fail",
      `found ${actualCount} well-formed revision(s) for resource ${resourceId}, expected at least ${minCount}`,
      checkedPaths,
      expectedMinCount,
      actualCount,
    );
  }

  return buildResult(
    "revision",
    "pass",
    `found ${actualCount} well-formed revision(s) for resource ${resourceId} (expected at least ${minCount})`,
    checkedPaths,
    expectedMinCount,
    actualCount,
  );
}

/**
 * Compare `expected`'s own-enumerable fields against `actual`, returning a
 * list of human-readable mismatch descriptions (empty when everything
 * matches or `expected` is `undefined`).
 */
function diffExpected(
  actual: Record<string, unknown>,
  expected: Record<string, unknown> | undefined,
): string[] {
  if (!expected) return [];
  const mismatches: string[] = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue === undefined) continue;
    const actualValue = actual[key];
    if (!deepEqual(actualValue, expectedValue)) {
      mismatches.push(
        `${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(
          actualValue,
        )}`,
      );
    }
  }
  return mismatches;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}
