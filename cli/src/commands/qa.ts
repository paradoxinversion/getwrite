// Last Updated: 2026-08-17

/**
 * @module qa
 *
 * Registers the `qa` sub-command group on the Commander program.
 *
 * `qa` is a developer-facing harness that lets an agent (e.g. a Claude Code
 * session driving Playwright MCP tools against the real GetWrite web app)
 * spin up a disposable dev-server workspace, independently verify
 * UI-reported success against the filesystem, write a run report, and tear
 * everything down again. Each sub-command is invoked as its own separate
 * process, so state that needs to survive between them — the workspace path,
 * the running server's port/pid, and the accumulated verification outcomes —
 * is persisted to a session record on disk rather than kept in memory.
 *
 * ### Session record
 *
 * `qa start` writes the session record to `<repo>/.git/getwrite-qa/session.json`
 * (overridable with `GETWRITE_QA_SESSION_PATH`), a JSON file shaped like
 * {@link QaSessionRecord}. The path is deliberately derived from the repo
 * rather than `os.tmpdir()`: `TMPDIR` varies between invocations, and a
 * session record the later sub-commands cannot find defeats the one thing
 * the record exists for. `qa verify` reads it, appends one more
 * outcome, and writes it back (read-modify-write — there is no cross-process
 * locking here, matching the harness's single-agent, one-run-at-a-time usage
 * model). `qa report` reads it to render the report. `qa finish` reads it,
 * stops the server, applies the FR-14 cleanup policy, and deletes the file.
 *
 * ### Sub-commands
 *
 * | Command | Description |
 * |---------|-------------|
 * | `qa start` | Create a disposable workspace, start a dev server against it, and persist a session record |
 * | `qa verify <kind> [args...]` | Verify on-disk state for one inventory item and record the outcome |
 * | `qa report` | Write a run report from the session's accumulated outcomes |
 * | `qa finish` | Stop the server, apply the cleanup policy, and remove the session record |
 *
 * ### Examples
 * ```sh
 * getwrite-cli qa start
 * getwrite-cli qa verify project-manifest <projectId>
 * getwrite-cli qa verify resource-content <projectId> <resourceId> --expected-text "hello"
 * getwrite-cli qa report
 * getwrite-cli qa finish
 * ```
 */
import { Command } from "commander";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createQaWorkspace,
  qaDistDir,
  qaServerLogPath,
  qaSessionFilePath,
  qaStateDir,
  qaTrackedTsconfigPath,
} from "../qa/workspace";
import { startQaServer } from "../qa/server";
import {
  verifyProjectManifest,
  verifyResourceContent,
  verifyResourceSidecar,
  verifyRevision,
  type VerifyResult,
} from "../qa/verify";
import {
  writeRunReport,
  defaultReportPath,
  parseInventoryItemIds,
  reconcileWithInventory,
  type RunItemOutcome,
} from "../qa/report";
import { applyCleanupPolicy } from "../qa/cleanup";

/**
 * Cross-process session state persisted between separate `qa` sub-command
 * invocations. Written by `qa start`, read/updated by `qa verify`, read by
 * `qa report`, and read + deleted by `qa finish`.
 */
export interface QaSessionRecord {
  /** Absolute path to the disposable workspace created by `qa start`. */
  workspacePath: string;
  /** Base URL the QA dev server is reachable at. */
  serverUrl: string;
  /** Port the QA dev server is listening on. */
  serverPort: number;
  /** PID of the spawned QA dev server child process (process-group leader). */
  serverPid: number;
  /**
   * Run-scoped Next.js build directory this run's dev server used. Recorded
   * so `qa finish` can delete it: build output is disposable, and unlike the
   * workspace it is never evidence worth retaining after a failure.
   */
  distDir?: string;
  /** Where the run's dev-server log was written (FR-10 evidence). */
  serverLogPath?: string;
  /**
   * Byte-for-byte contents of `frontend/tsconfig.json` as it stood before the
   * run started, so `qa finish` can undo Next's rewrite of it. Snapshotting
   * the pre-run state (rather than restoring from git) preserves any
   * uncommitted edits the developer already had.
   */
  tsconfigSnapshot?: string;
  /** Per-item outcomes accumulated across `qa verify` invocations so far. */
  outcomes: RunItemOutcome[];
}

/**
 * Repo root, resolved relative to this module's own location via
 * `__dirname` (three levels up, matching `server.ts`'s `defaultRepoRoot`
 * convention — `cli/src/commands/`, `cli/dist/bin/`, and `cli/src/qa/` are
 * all the same depth below the repo root).
 *
 * `workspace.ts`'s and `report.ts`'s own `defaultRepoRoot()` helpers resolve
 * via `import.meta.url` instead, which esbuild's CJS bundle output
 * (`dist/bin/getwrite-cli.cjs`, per `cli/package.json`'s `build` script)
 * leaves empty — `fileURLToPath("")` then throws. Both functions accept an
 * explicit `repoRoot` override for exactly this reason, so this module
 * computes and passes one rather than relying on their defaults.
 */
function repoRootFromThisModule(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

/**
 * Directory the session record lives under. Resolved through `workspace.ts`
 * so every sub-command — each its own process — agrees on the location
 * regardless of the `TMPDIR` it happens to inherit.
 */
function sessionDir(): string {
  return qaStateDir(repoRootFromThisModule());
}

/** Absolute path to the session record file. */
function sessionFilePath(): string {
  return qaSessionFilePath(repoRootFromThisModule());
}

/** `true` when `err` is a Node `ENOENT` (file/dir does not exist) error. */
function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/**
 * Reads the current session record. Throws a descriptive error (rather than
 * a raw `ENOENT`) when no session exists, since that almost always means the
 * caller forgot to run `qa start` first, or ran it in a different process
 * environment.
 */
async function readSession(): Promise<QaSessionRecord> {
  let raw: string;
  try {
    raw = await readFile(sessionFilePath(), "utf8");
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new Error(
        `No active QA session found at "${sessionFilePath()}". Run "qa start" first.`,
      );
    }
    throw err;
  }
  return JSON.parse(raw) as QaSessionRecord;
}

/** Writes the session record, creating its parent directory if needed. */
async function writeSession(record: QaSessionRecord): Promise<void> {
  await mkdir(sessionDir(), { recursive: true });
  await writeFile(sessionFilePath(), JSON.stringify(record, null, 2), "utf8");
}

/** Removes the session record file, if present. Never throws on "missing". */
async function removeSession(): Promise<void> {
  await rm(sessionFilePath(), { force: true });
}

/**
 * Reads the declared inventory item ids from
 * `specs/features/agentic-qa/inventory.md`, or `undefined` when the file is
 * absent or declares none.
 *
 * Returning `undefined` rather than throwing is deliberate: a missing
 * inventory should degrade the report to "no reconciliation possible", not
 * prevent a run from producing a report at all.
 */
async function readInventoryItemIds(
  repoRoot: string,
): Promise<string[] | undefined> {
  const inventoryPath = path.join(
    repoRoot,
    "specs",
    "features",
    "agentic-qa",
    "inventory.md",
  );
  try {
    const markdown = await readFile(inventoryPath, "utf8");
    const ids = parseInventoryItemIds(markdown);
    return ids.length > 0 ? ids : undefined;
  } catch (err) {
    if (isNotFoundError(err)) return undefined;
    throw err;
  }
}

/**
 * Unrefs a child process's piped stdio stream so it doesn't keep this
 * process's event loop alive. `child.stdout`/`child.stderr` are typed as
 * `Readable` (stdio's static type can't know it was configured as a pipe),
 * but at runtime a piped stream is a `net.Socket`, which does expose
 * `.unref()` — this checks for it rather than casting blindly.
 */
function unrefStream(stream: NodeJS.ReadableStream | null | undefined): void {
  if (
    stream !== null &&
    stream !== undefined &&
    "unref" in stream &&
    typeof (stream as { unref?: unknown }).unref === "function"
  ) {
    (stream as { unref: () => void }).unref();
  }
}

// ---------------------------------------------------------------------------
// `qa verify` dispatch
// ---------------------------------------------------------------------------

/** CLI options accepted by `qa verify`, all optional. */
interface VerifyCliOptions {
  expected?: string;
  expectedText?: string;
  minCount?: string;
  itemId?: string;
  description?: string;
  uiOutcome?: string;
}

/** CLI options accepted by `qa record`. */
interface RecordCliOptions {
  itemId: string;
  description?: string;
  uiOutcome?: string;
  reason?: string;
}

/**
 * Statuses `qa record` may set. `pass` is deliberately absent: a pass must be
 * earned by a filesystem check via `qa verify`, never asserted by hand.
 */
const RECORDABLE_STATUSES = ["unreachable", "unverified", "fail"] as const;
type RecordableStatus = (typeof RECORDABLE_STATUSES)[number];

function isRecordableStatus(value: string): value is RecordableStatus {
  return (RECORDABLE_STATUSES as readonly string[]).includes(value);
}

const VERIFY_KINDS = [
  "project-manifest",
  "resource-content",
  "resource-sidecar",
  "revision",
] as const;
type VerifyKind = (typeof VERIFY_KINDS)[number];

function isVerifyKind(value: string): value is VerifyKind {
  return (VERIFY_KINDS as readonly string[]).includes(value);
}

/** Parses a `--expected` JSON option into an object, or `undefined`. */
function parseExpected(
  json: string | undefined,
): Record<string, unknown> | undefined {
  if (json === undefined) return undefined;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`--expected must be valid JSON: ${(err as Error).message}`);
  }
}

/** Asserts a required positional arg was supplied, narrowing its type. */
function requireArg(
  value: string | undefined,
  name: string,
  kind: string,
): asserts value is string {
  if (value === undefined || value.length === 0) {
    throw new Error(`"qa verify ${kind}" requires <${name}>`);
  }
}

/** Dispatches to the matching `./verify.ts` function for `kind`. */
async function runVerify(
  workspaceRoot: string,
  kind: string,
  args: string[],
  options: VerifyCliOptions,
): Promise<VerifyResult> {
  if (!isVerifyKind(kind)) {
    throw new Error(
      `Unknown verify kind "${kind}". Expected one of: ${VERIFY_KINDS.join(", ")}.`,
    );
  }

  switch (kind) {
    case "project-manifest": {
      const [projectId] = args;
      requireArg(projectId, "projectId", kind);
      return verifyProjectManifest(
        workspaceRoot,
        projectId,
        parseExpected(options.expected),
      );
    }
    case "resource-content": {
      const [projectId, resourceId] = args;
      requireArg(projectId, "projectId", kind);
      requireArg(resourceId, "resourceId", kind);
      return verifyResourceContent(
        workspaceRoot,
        projectId,
        resourceId,
        options.expectedText,
      );
    }
    case "resource-sidecar": {
      const [projectId, resourceId] = args;
      requireArg(projectId, "projectId", kind);
      requireArg(resourceId, "resourceId", kind);
      return verifyResourceSidecar(
        workspaceRoot,
        projectId,
        resourceId,
        parseExpected(options.expected),
      );
    }
    case "revision": {
      const [projectId, resourceId] = args;
      requireArg(projectId, "projectId", kind);
      requireArg(resourceId, "resourceId", kind);
      const minCount =
        options.minCount !== undefined ? Number(options.minCount) : undefined;
      return verifyRevision(workspaceRoot, projectId, resourceId, minCount);
    }
  }
}

/** A reasonable default report description when `--description` is omitted. */
function defaultDescription(kind: string, args: string[]): string {
  const [projectId, resourceId] = args;
  switch (kind) {
    case "project-manifest":
      return `Verify project manifest for project ${projectId ?? "(unknown)"}`;
    case "resource-content":
      return `Verify resource content for resource ${resourceId ?? "(unknown)"} in project ${
        projectId ?? "(unknown)"
      }`;
    case "resource-sidecar":
      return `Verify resource sidecar for resource ${resourceId ?? "(unknown)"} in project ${
        projectId ?? "(unknown)"
      }`;
    case "revision":
      return `Verify revision(s) for resource ${resourceId ?? "(unknown)"} in project ${
        projectId ?? "(unknown)"
      }`;
    default:
      return `Verify ${kind}`;
  }
}

// ---------------------------------------------------------------------------
// `qa finish` — server stop by PID
//
// This is a separate process from `qa start`: there is no in-memory
// `QaServerHandle` to call `.stop()` on, only the PID recorded in the
// session file. `process.kill(pid, 0)` is the standard "is this process
// alive" probe, but it throws two very different errors that must NOT be
// conflated:
//   - ESRCH: no such process — it's genuinely gone. Nothing to do.
//   - EPERM (or anything else): the process may well still be alive; the
//     caller just can't tell via this probe. Treating this the same as
//     ESRCH would silently skip ever attempting the kill.
// So the kill attempt is never gated behind a probe result that could be
// EPERM — it's attempted unconditionally unless the probe already confirmed
// ESRCH. Real exit is then confirmed by polling the same probe, escalating
// to SIGKILL on timeout, and finally surfaced honestly if it can still not
// be confirmed.
// ---------------------------------------------------------------------------

/** Outcome of probing whether a PID is alive, distinguishing ESRCH from EPERM. */
type ProcessProbe = "alive" | "gone" | "unknown";

/**
 * Probes whether `pid` is alive via `process.kill(pid, 0)` (sends no signal).
 * Returns `"gone"` only on a confirmed `ESRCH`. Any other error (most
 * notably `EPERM`, meaning the process exists but this process lacks
 * permission to signal it) returns `"unknown"` rather than `"gone"` — the
 * process must not be assumed dead just because the probe was ambiguous.
 */
function probeProcess(pid: number): ProcessProbe {
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return "gone";
    return "unknown";
  }
}

/**
 * Sends `signal` to the process group led by `pid` first (matching
 * `server.ts`'s `killProcessGroup` semantics for a detached child spawned
 * with `detached: true`), falling back to signaling `pid` directly if that
 * throws. Never throws itself — a failed signal attempt is discovered by the
 * exit-polling that follows, not by this function's return value.
 */
function sendSignal(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Both the process-group and direct signal attempts failed. This is
      // not proof the process is dead (could be EPERM) — the polling loop
      // below is what actually decides that.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls `probeProcess(pid)` until it reports `"gone"` or `timeoutMs` elapses. */
async function pollForExit(
  pid: number,
  timeoutMs: number,
  pollIntervalMs = 200,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (probeProcess(pid) === "gone") return true;
    if (Date.now() >= deadline) return false;
    await sleep(pollIntervalMs);
  }
}

const DEFAULT_KILL_TIMEOUT_MS = 10_000;

/**
 * Stops the QA dev server process (and its process group) by PID, confirming
 * real exit rather than trusting a signal call not throwing as proof.
 *
 * Sends `SIGTERM`, polls for exit, escalates to `SIGKILL` on timeout, and
 * polls again. Returns `confirmed: false` — never throws — if the process
 * still cannot be confirmed dead afterward (e.g. every signal attempt hits
 * `EPERM` and the process never reports `ESRCH`), so the caller can surface
 * an honest warning instead of a false success.
 */
export async function stopServerByPid(
  pid: number,
  killTimeoutMs: number = DEFAULT_KILL_TIMEOUT_MS,
): Promise<{ confirmed: boolean }> {
  if (probeProcess(pid) === "gone") {
    return { confirmed: true };
  }

  sendSignal(pid, "SIGTERM");
  if (await pollForExit(pid, killTimeoutMs)) {
    return { confirmed: true };
  }

  sendSignal(pid, "SIGKILL");
  const confirmed = await pollForExit(pid, killTimeoutMs);
  return { confirmed };
}

/**
 * Reads the tracked tsconfig so `qa finish` can put it back exactly as it was.
 *
 * Starting `next dev` makes Next verify and rewrite `frontend/tsconfig.json`
 * — reformatting its arrays and appending the run's `distDir` type globs — so
 * a QA run left the checkout dirty with changes nobody asked for. Pointing
 * Next at an untracked config instead (`typescript.tsconfigPath`) was tried
 * and does not work: with a non-default tsconfig path this Next version stops
 * discovering App Router routes and serves 404 for everything. Snapshot and
 * restore is what remains, and it is enough — the rewrite is transient state
 * that only needs to not survive the run.
 *
 * Returns `undefined` if the file cannot be read, which simply means there is
 * nothing to restore.
 */
export async function snapshotTrackedTsconfig(
  tsconfigPath: string,
): Promise<string | undefined> {
  try {
    return await readFile(tsconfigPath, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Restores the tracked tsconfig from a `qa start` snapshot, if Next changed
 * it. Returns `true` when a restore actually happened, so the caller can say
 * so rather than claim it unconditionally.
 */
export async function restoreTrackedTsconfig(
  tsconfigPath: string,
  snapshot: string | undefined,
): Promise<boolean> {
  if (snapshot === undefined) return false;
  const current = await snapshotTrackedTsconfig(tsconfigPath);
  if (current === snapshot) return false;
  await writeFile(tsconfigPath, snapshot, "utf8");
  return true;
}

/**
 * What `qa start` has already changed on disk by the time it can fail, and
 * therefore has to undo itself.
 *
 * A failure before the session record is written leaves nothing for
 * `qa finish` to act on — it reports "No active QA session found" — so without
 * this the run's build directory and Next's rewrite of the tracked tsconfig
 * persist with no recovery path. That is the exact outcome the tsconfig
 * snapshot exists to prevent, so it has to cover the failure path too.
 */
interface FailedStartArtifacts {
  distDir?: string;
  tsconfigPath?: string;
  tsconfigSnapshot?: string;
}

/** Best-effort rollback of {@link FailedStartArtifacts}. Never throws. */
export async function cleanUpFailedStart(
  artifacts: FailedStartArtifacts,
): Promise<void> {
  if (artifacts.distDir !== undefined) {
    await rm(artifacts.distDir, { recursive: true, force: true }).catch(
      () => {},
    );
  }
  if (artifacts.tsconfigPath !== undefined) {
    const restored = await restoreTrackedTsconfig(
      artifacts.tsconfigPath,
      artifacts.tsconfigSnapshot,
    ).catch(() => false);
    if (restored) {
      console.log(
        "[qa start] Restored frontend/tsconfig.json to its pre-run state.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Registers the `qa` sub-command group on the provided Commander `program`.
 *
 * @param program - The root Commander `Command` instance to attach the
 *   sub-command group to.
 *
 * @example
 * ```ts
 * import { Command } from "commander";
 * import registerQa from "./commands/qa";
 *
 * const program = new Command();
 * registerQa(program);
 * program.parse(process.argv);
 * ```
 */
export function registerQa(program: Command) {
  const qa = program
    .command("qa")
    .description("Agentic QA harness for driving disposable QA workspaces");

  /**
   * `qa start`
   *
   * Creates a fresh disposable workspace (`createQaWorkspace`), starts the
   * frontend dev server against it on a free port (`startQaServer`), and
   * persists a session record so later `qa verify`/`qa report`/`qa finish`
   * invocations — each a separate process — can find it. The server child
   * is spawned detached; this command unrefs it (and its piped stdio) so
   * `qa start`'s own process can exit while the server keeps running.
   */
  qa.command("start")
    .description("Start a disposable QA workspace and dev server")
    .action(async (): Promise<void> => {
      const startArtifacts: FailedStartArtifacts = {};
      try {
        const repoRoot = repoRootFromThisModule();
        const workspacePath = await createQaWorkspace(repoRoot);

        // One build directory per run, so this server can neither be poisoned
        // by a stale shared `frontend/.next` nor poison it for ordinary
        // development. `path.basename` of the workspace is already unique
        // (mkdtemp), which makes it a ready-made run id.
        const runId = path.basename(workspacePath);
        const distDir = qaDistDir(runId, repoRoot);
        const serverLogPath = qaServerLogPath(repoRoot, runId);
        // Captured before the server starts, because starting it is what
        // rewrites the file.
        const tsconfigSnapshot = await snapshotTrackedTsconfig(
          qaTrackedTsconfigPath(repoRoot),
        );
        startArtifacts.distDir = distDir;
        startArtifacts.tsconfigPath = qaTrackedTsconfigPath(repoRoot);
        startArtifacts.tsconfigSnapshot = tsconfigSnapshot;

        const handle = await startQaServer({
          workspaceDir: workspacePath,
          repoRoot,
          distDir,
          logPath: serverLogPath,
        });

        if (handle.child.pid === undefined) {
          throw new Error("QA dev server started but reported no PID");
        }

        // Let this process exit without waiting on (or killing) the server:
        // the child is a process-group leader (detached: true) and must
        // keep running after `qa start` returns.
        handle.child.unref();
        unrefStream(handle.child.stdout);
        unrefStream(handle.child.stderr);

        const record: QaSessionRecord = {
          workspacePath,
          serverUrl: handle.url,
          serverPort: handle.port,
          serverPid: handle.child.pid,
          distDir,
          serverLogPath,
          tsconfigSnapshot,
          outcomes: [],
        };
        await writeSession(record);

        console.log(`[qa start] Workspace: ${workspacePath}`);
        console.log(`[qa start] Server URL: ${handle.url}`);
        console.log(`[qa start] Server log: ${serverLogPath}`);
      } catch (err) {
        console.error(
          "[qa start] Failed to start QA session:",
          (err as Error).message,
        );

        // No session record exists on this path, so `qa finish` has nothing to
        // clean up from — this is the only chance to undo what starting the
        // run already changed. `startQaServer` stops the child it spawned, so
        // what is left here is the build directory and the tsconfig rewrite.
        await cleanUpFailedStart(startArtifacts);

        if (!process.env.GETWRITE_CLI_TESTING) process.exit(2);
      }
    });

  /**
   * `qa verify <kind> [args...]`
   *
   * Reads the session record, runs the matching `./verify.ts` check against
   * the run's workspace, prints the pass/fail result, and appends the
   * outcome to the session's accumulated outcomes (read-modify-write, since
   * each `qa verify` invocation is a separate process).
   */
  qa.command("verify <kind> [args...]")
    .description(
      "Verify on-disk state for a QA run item (kind: " +
        VERIFY_KINDS.join(", ") +
        ")",
    )
    .option(
      "--expected <json>",
      "Expected fields as JSON (project-manifest, resource-sidecar)",
    )
    .option(
      "--expected-text <text>",
      "Expected exact plain-text content (resource-content)",
    )
    .option(
      "--min-count <n>",
      "Expected minimum well-formed revision count (revision)",
    )
    .option(
      "--item-id <id>",
      "Stable inventory item id to record this outcome under",
    )
    .option(
      "--description <text>",
      "Human-readable description to record for this item",
    )
    .option(
      "--ui-outcome <text>",
      "What the UI reported for this item, if observed",
    )
    .action(
      async (
        kind: string,
        args: string[],
        options: VerifyCliOptions,
      ): Promise<void> => {
        try {
          const session = await readSession();
          const result = await runVerify(
            session.workspacePath,
            kind,
            args,
            options,
          );

          console.log(
            `[qa verify] ${result.status.toUpperCase()} — ${result.message}`,
          );
          for (const checkedPath of result.checkedPaths) {
            console.log(`  checked: ${checkedPath}`);
          }
          if (result.expected !== undefined) {
            console.log(`  expected: ${JSON.stringify(result.expected)}`);
          }
          if (result.actual !== undefined) {
            console.log(`  actual:   ${JSON.stringify(result.actual)}`);
          }

          // An inventory item can need more than one filesystem check to be
          // judged (the save roundtrip needs both content and sidecar, and
          // per the procedure passes only if both pass). When the caller
          // names the item with `--item-id`, fold this check into that item
          // rather than filing it as a separate one — otherwise the report
          // counts checks as items and overstates how much of the inventory
          // a run actually covered.
          const existing =
            options.itemId === undefined
              ? undefined
              : session.outcomes.find((o) => o.itemId === options.itemId);

          if (existing !== undefined) {
            existing.filesystemChecks = [
              ...(existing.filesystemChecks ?? []),
              result,
            ];
            // The item is only as good as its weakest check.
            if (result.status !== "pass") {
              existing.status = result.status;
            }
            if (options.description !== undefined) {
              existing.description = options.description;
            }
            if (options.uiOutcome !== undefined) {
              existing.uiOutcome = options.uiOutcome;
            }
          } else {
            const outcome: RunItemOutcome = {
              itemId:
                options.itemId ?? `${kind}-${session.outcomes.length + 1}`,
              description:
                options.description ?? defaultDescription(kind, args),
              status: result.status,
              uiOutcome: options.uiOutcome,
              filesystemChecks: [result],
            };
            session.outcomes.push(outcome);
          }
          await writeSession(session);
        } catch (err) {
          console.error("[qa verify] Failed:", (err as Error).message);
          if (!process.env.GETWRITE_CLI_TESTING) process.exit(2);
        }
      },
    );

  /**
   * `qa record <status>`
   *
   * Records an outcome that has no filesystem check behind it.
   *
   * FR-11 requires a control the agent could not reach to be recorded as a
   * distinct, explicitly-labelled outcome rather than silently omitted — but
   * `qa verify` can only produce `pass`/`fail`, because it derives its status
   * from reading an artifact. With no other route, an unreachable control had
   * to be left unrecorded, which is precisely the silent omission FR-11
   * forbids: the report then reads as a clean run, and `qa finish` deletes the
   * workspace as "every exercised item passed".
   *
   * `--reason` is mandatory for `unreachable`: "the agent could not interact
   * with this control" is only actionable if it says which control and why
   * (FR-10).
   */
  qa.command("record <status>")
    .description(
      "Record an outcome with no filesystem check (status: unreachable, unverified, fail)",
    )
    .requiredOption(
      "--item-id <id>",
      "Stable inventory item id this outcome belongs to",
    )
    .option("--description <text>", "Human-readable description of the item")
    .option("--ui-outcome <text>", "What the UI reported, if observed")
    .option(
      "--reason <text>",
      "Why the control was unreachable (required for unreachable)",
    )
    .action(
      async (status: string, options: RecordCliOptions): Promise<void> => {
        try {
          if (!isRecordableStatus(status)) {
            throw new Error(
              `Unknown status "${status}". Expected one of: ${RECORDABLE_STATUSES.join(", ")}.`,
            );
          }
          if (status === "unreachable" && options.reason === undefined) {
            throw new Error(
              "--reason is required for unreachable: name the control and why it could not be used.",
            );
          }

          const session = await readSession();
          const existing = session.outcomes.find(
            (o) => o.itemId === options.itemId,
          );

          if (existing !== undefined) {
            // A non-pass recorded outcome overrides an earlier pass for the
            // same item: an item is only as good as its weakest result.
            existing.status = status;
            if (options.reason !== undefined) {
              existing.unreachableReason = options.reason;
            }
            if (options.description !== undefined) {
              existing.description = options.description;
            }
            if (options.uiOutcome !== undefined) {
              existing.uiOutcome = options.uiOutcome;
            }
          } else {
            session.outcomes.push({
              itemId: options.itemId,
              description:
                options.description ??
                `Outcome recorded without a filesystem check for ${options.itemId}`,
              status,
              uiOutcome: options.uiOutcome,
              unreachableReason: options.reason,
            });
          }

          await writeSession(session);
          console.log(
            `[qa record] ${status.toUpperCase()} recorded for ${options.itemId}` +
              (options.reason === undefined ? "" : ` — ${options.reason}`),
          );
        } catch (err) {
          console.error("[qa record] Failed:", (err as Error).message);
          if (!process.env.GETWRITE_CLI_TESTING) process.exit(2);
        }
      },
    );

  /**
   * `qa report`
   *
   * Reads the session record's accumulated outcomes and writes the run
   * report to `specs/features/agentic-qa/run-report.md` via
   * `writeRunReport`.
   */
  qa.command("report")
    .description(
      "Write a QA run report from the session's accumulated outcomes",
    )
    .action(async (): Promise<void> => {
      try {
        const session = await readSession();
        const repoRoot = repoRootFromThisModule();
        const reportPath = defaultReportPath(repoRoot);

        // Reconcile against the inventory so an item the run never recorded
        // an outcome for is named in the report as a gap rather than being
        // absent from it (FR-11). A missing or unreadable inventory must not
        // block the report — it just means no reconciliation is possible, and
        // the report says so by omitting the "N of M" phrasing.
        const inventoryItemIds = await readInventoryItemIds(repoRoot);

        await writeRunReport(session.outcomes, reportPath, inventoryItemIds);

        const declared = inventoryItemIds?.length;
        const recorded = session.outcomes.length;
        const missing =
          declared === undefined ? 0 : Math.max(0, declared - recorded);
        console.log(
          `[qa report] Wrote report with ${recorded} recorded item(s)` +
            (declared === undefined ? "" : ` of ${declared} declared`) +
            ` to ${reportPath}`,
        );
        if (missing > 0) {
          console.log(
            `[qa report] ${missing} inventory item(s) had no recorded outcome ` +
              "and are listed as unverified — this run is not clean.",
          );
        }
      } catch (err) {
        console.error("[qa report] Failed:", (err as Error).message);
        if (!process.env.GETWRITE_CLI_TESTING) process.exit(2);
      }
    });

  /**
   * `qa finish`
   *
   * Reads the session record, stops the QA dev server by its recorded PID
   * (see {@link stopServerByPid} — real exit is confirmed, not assumed),
   * applies the FR-14 cleanup policy to the run's final outcome set, and
   * removes the session record. If the server's stop cannot be confirmed,
   * this prints an explicit warning rather than a false-success message —
   * cleanup and session removal still proceed regardless, since both are
   * independent of whether the kill succeeded.
   */
  qa.command("finish")
    .description(
      "Stop the QA dev server, apply the cleanup policy, and remove the session record",
    )
    .action(async (): Promise<void> => {
      try {
        const session = await readSession();

        const { confirmed } = await stopServerByPid(session.serverPid);
        if (confirmed) {
          console.log(
            `[qa finish] Confirmed QA dev server (pid ${session.serverPid}) stopped.`,
          );
        } else {
          console.warn(
            `[qa finish] WARNING: could not confirm the QA dev server (pid ${session.serverPid}) was stopped — you may need to stop it manually.`,
          );
        }

        // Reconcile against the inventory before deciding: an item the run
        // never recorded an outcome for must count against a clean result,
        // or a run that skipped an item deletes the very workspace someone
        // would need to work out why it was skipped.
        const inventoryItemIds = await readInventoryItemIds(
          repoRootFromThisModule(),
        );
        const reconciled = reconcileWithInventory(
          session.outcomes,
          inventoryItemIds,
        );

        const cleanupResult = await applyCleanupPolicy(
          reconciled,
          session.workspacePath,
        );
        console.log(`[qa finish] ${cleanupResult.message}`);

        // The log follows the workspace's fate: it is the same run's evidence,
        // so retaining one while discarding the other would leave a failing
        // run half-documented, and keeping both on a clean run would grow a
        // log per run forever.
        if (session.serverLogPath !== undefined) {
          if (cleanupResult.action === "retained") {
            console.log(
              `[qa finish] Retained server log at "${session.serverLogPath}".`,
            );
          } else {
            await rm(session.serverLogPath, { force: true });
          }
        }

        // Both of the steps below assume the dev server is gone. Neither is
        // safe against one that might still be running: deleting its build
        // directory pulls the ground out from under a live process, and it
        // would re-append its `distDir` type globs to the tsconfig after the
        // restore — leaving the tree dirty anyway, but silently. When the stop
        // could not be confirmed, say what was skipped instead of doing damage.
        if (!confirmed) {
          console.warn(
            "[qa finish] Skipped removing the run's build directory and " +
              "restoring frontend/tsconfig.json, because the server's stop " +
              "could not be confirmed. Stop it, then re-run `qa finish` or " +
              "undo both by hand:",
          );
          if (session.distDir !== undefined) {
            console.warn(`[qa finish]   build dir: ${session.distDir}`);
          }
          console.warn(
            `[qa finish]   tsconfig:  ${qaTrackedTsconfigPath(repoRootFromThisModule())}`,
          );
        } else {
          // Build output is disposable: unlike the workspace it carries no
          // evidence about what the run observed, and leaving it behind would
          // accumulate a full Next build per run under `frontend/.next-qa/`.
          if (session.distDir !== undefined) {
            await rm(session.distDir, { recursive: true, force: true });
          }

          // Undo Next's start-time rewrite of the tracked tsconfig so a QA run
          // leaves no working-tree changes behind.
          const restored = await restoreTrackedTsconfig(
            qaTrackedTsconfigPath(repoRootFromThisModule()),
            session.tsconfigSnapshot,
          );
          if (restored) {
            console.log(
              "[qa finish] Restored frontend/tsconfig.json to its pre-run state.",
            );
          }
        }

        await removeSession();
        console.log("[qa finish] Session record removed.");
      } catch (err) {
        console.error("[qa finish] Failed:", (err as Error).message);
        if (!process.env.GETWRITE_CLI_TESTING) process.exit(2);
      }
    });
}

export default registerQa;
