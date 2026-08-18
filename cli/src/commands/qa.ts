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
 * `qa start` writes `<os.tmpdir()>/getwrite-qa/session.json`, a JSON file
 * shaped like {@link QaSessionRecord}. `qa verify` reads it, appends one more
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
import os from "node:os";
import path from "node:path";
import { createQaWorkspace } from "../qa/workspace";
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

/** Directory the session record lives under, inside the OS temp directory. */
function sessionDir(): string {
  return path.join(os.tmpdir(), "getwrite-qa");
}

/** Absolute path to the session record file. */
function sessionFilePath(): string {
  return path.join(sessionDir(), "session.json");
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
      try {
        const workspacePath = await createQaWorkspace(repoRootFromThisModule());
        const handle = await startQaServer({ workspaceDir: workspacePath });

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
          outcomes: [],
        };
        await writeSession(record);

        console.log(`[qa start] Workspace: ${workspacePath}`);
        console.log(`[qa start] Server URL: ${handle.url}`);
      } catch (err) {
        console.error(
          "[qa start] Failed to start QA session:",
          (err as Error).message,
        );
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
        const reportPath = defaultReportPath(repoRootFromThisModule());
        await writeRunReport(session.outcomes, reportPath);
        console.log(
          `[qa report] Wrote report with ${session.outcomes.length} item(s) to ${reportPath}`,
        );
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

        const cleanupResult = await applyCleanupPolicy(
          session.outcomes,
          session.workspacePath,
        );
        console.log(`[qa finish] ${cleanupResult.message}`);

        await removeSession();
        console.log("[qa finish] Session record removed.");
      } catch (err) {
        console.error("[qa finish] Failed:", (err as Error).message);
        if (!process.env.GETWRITE_CLI_TESTING) process.exit(2);
      }
    });
}

export default registerQa;
