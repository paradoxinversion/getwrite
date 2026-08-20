// Last Updated: 2026-08-17

/**
 * @module qa/server
 *
 * Spawns and tears down the real Next.js dev server (`frontend` workspace)
 * as a disposable child process for the Agentic QA harness.
 *
 * `GETWRITE_PROJECTS_DIR` is read once by
 * `frontend/src/lib/models/projects-dir.ts` at server start and cannot be
 * changed on an already-running process, so this module sets it in the
 * child's environment *before* spawning — never afterward via IPC or a
 * config file.
 *
 * The dev server also can't be assumed to have port 3000 free (another dev
 * server, another QA run, etc. may already hold it), so this module probes
 * for a free port itself: bind a throwaway listener to port 0, let the OS
 * assign a port, read it back, close the listener, then pass that port to
 * the real child via the `PORT` env var (which `next dev` honors).
 *
 * This module has no dependency on `cli/src/qa/workspace.ts` (owned by a
 * different task) — callers pass the workspace directory in directly.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

/**
 * Name of the dev-server log file.
 *
 * The server's stdio goes to a file rather than a pipe. A pipe would be a
 * correctness bug here, not just a style choice: `qa start` exits once the
 * server is ready, leaving the detached child's pipes with no reader.
 * `unref()` detaches a stream from the event loop but never drains it, so
 * the ~64KB pipe buffer fills with Turbopack's compile output and the
 * server blocks on its next write — permanently, after having served one
 * request. Writing to a file removes the reader entirely.
 *
 * The file no longer lives inside the run's `GETWRITE_PROJECTS_DIR`: that
 * directory is scanned by the app for projects, and a log sitting in it is a
 * foreign entry in a tree that should hold nothing else. Callers pass an
 * explicit `logPath` (see `workspace.ts`'s `qaServerLogPath`), which keeps
 * the log readable after `qa finish` deletes a passing run's workspace.
 */
export const QA_SERVER_LOG_FILENAME = "qa-server.log";

/** Options controlling how the QA dev server is spawned and awaited. */
export interface StartQaServerOptions {
  /**
   * Absolute path to the disposable workspace directory the spawned server
   * should read/write projects under. Set as `GETWRITE_PROJECTS_DIR` in the
   * child's environment before the process starts.
   */
  workspaceDir: string;
  /**
   * Repo root to spawn `pnpm` from. Defaults to the repo root resolved
   * relative to this module's own location (three directories up from
   * `cli/src/qa/` or the equivalent bundled `cli/dist/bin/` location).
   */
  repoRoot?: string;
  /**
   * Port to bind the dev server to. When omitted, a free port is discovered
   * automatically (see module doc). Passing an explicit port skips discovery
   * — mainly useful for tests that want a deterministic value.
   */
  port?: number;
  /**
   * How long to wait for the server to start *serving compiled routes*
   * before giving up, in milliseconds. Defaults to 4 minutes.
   *
   * The previous 60s budget was sized for "the socket answers". Two changes
   * made that far too tight: readiness now means an actual 200 from the app
   * (not any response), and each run builds into its own fresh `distDir`, so
   * every run pays a cold Turbopack compile rather than reusing a warm shared
   * cache. Both are deliberate — but they move real compile time inside this
   * budget, and a timeout here fails the whole run.
   */
  readyTimeoutMs?: number;
  /**
   * How long to wait between polling the server for readiness, in
   * milliseconds. Defaults to 500ms.
   */
  pollIntervalMs?: number;
  /**
   * Absolute path to the Next.js build directory (`distDir`) this run should
   * use. Passed to the child as `GETWRITE_QA_DIST_DIR`, which
   * `frontend/next.config.mjs` reads. Omit only in tests that do not care
   * about cache isolation — a real run must always pass a run-scoped path so
   * it neither reads nor writes the shared `frontend/.next`.
   */
  distDir?: string;
  /**
   * Absolute path the child's stdout/stderr is appended to. Defaults to
   * {@link QA_SERVER_LOG_FILENAME} inside `workspaceDir` for backwards
   * compatibility; real runs pass a path outside the scanned workspace.
   */
  logPath?: string;
  /**
   * Paths probed for readiness, relative to the server's base URL. Every one
   * must answer `200` with a body that is not Next's not-found page before
   * the server is considered ready. Defaults to
   * {@link DEFAULT_READY_PROBE_PATHS}.
   */
  readyProbePaths?: readonly string[];
}

/** A running QA dev server, with its resolved port/URL and a stop handle. */
export interface QaServerHandle {
  /** The underlying child process running `next dev`. */
  readonly child: ChildProcess;
  /** The port the server is listening on. */
  readonly port: number;
  /** The base URL the server is reachable at (`http://127.0.0.1:<port>`). */
  readonly url: string;
  /**
   * Terminates the child process and resolves only once it has actually
   * exited. Sends `SIGTERM` first, escalating to `SIGKILL` if the process
   * has not exited within `killTimeoutMs`.
   */
  stop(killTimeoutMs?: number): Promise<void>;
}

const DEFAULT_READY_TIMEOUT_MS = 240_000;
/**
 * Per-request ceiling for one readiness probe. Bounded well below the overall
 * readiness budget so a single unanswered socket costs one poll interval
 * rather than the whole run.
 */
const PROBE_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_KILL_TIMEOUT_MS = 10_000;

/**
 * Resolves the repo root relative to this module's own location. Works both
 * when run directly from TypeScript source (`cli/src/qa/server.ts`, three
 * directories below the repo root) and from the esbuild bundle
 * (`cli/dist/bin/getwrite-cli.cjs`, also three directories below the repo
 * root), since both paths are the same depth.
 */
function defaultRepoRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

/**
 * Binds a throwaway TCP listener to port 0, lets the OS assign a free port,
 * reads it back, and releases the listener — the standard Node pattern for
 * free-port discovery. Returns the discovered port.
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("Could not determine a free port"));
        return;
      }
      const { port } = address;
      probe.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(port);
      });
    });
  });
}

/**
 * Routes probed before a run is allowed to proceed.
 *
 * `/` proves the app shell compiles and renders; `/api/projects` proves the
 * route handlers — the surface every `qa verify` check ultimately depends on
 * — compile and serve too. Both are hit on the very first navigation an
 * agent makes, so warming them here moves the compile cost into `qa start`
 * rather than into the agent's first (and easily misread) interaction.
 */
export const DEFAULT_READY_PROBE_PATHS: readonly string[] = [
  "/",
  "/api/projects",
];

/**
 * Substrings that mark Next's dev-mode not-found response. A 200-with-404-page
 * is possible in App Router (`notFound()` renders the not-found boundary with
 * a 404 status, but an uncompiled route can serve the same shell), so status
 * alone is not sufficient evidence the app is serving real routes.
 */
const NOT_FOUND_BODY_MARKERS = [
  "This page could not be found",
  "__next_error__",
];

/** One probe attempt's outcome, carrying why it failed for the timeout error. */
interface ProbeOutcome {
  ready: boolean;
  detail: string;
}

/**
 * Issues a single GET and decides whether it proves the app is *serving*, not
 * merely *listening*.
 *
 * The previous implementation accepted any status below 500, which meant a
 * dev server that had bound its port but not yet compiled a single route
 * reported ready — and the agent's first navigation landed on a 404 that
 * looked like a product defect. Requiring a 200 whose body carries no
 * not-found marker makes "ready" mean what the harness needs it to mean.
 */
function probeOnce(
  url: string,
  timeoutMs = PROBE_REQUEST_TIMEOUT_MS,
): Promise<ProbeOutcome> {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (res) => {
      const status = res.statusCode ?? 0;
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        // Only the head of the response is needed to spot a not-found page;
        // capping it keeps a large HTML shell out of memory.
        if (body.length < 8192) body += chunk;
      });
      res.on("end", () => {
        if (status !== 200) {
          resolve({ ready: false, detail: `${url} responded ${status}` });
          return;
        }
        const marker = NOT_FOUND_BODY_MARKERS.find((m) => body.includes(m));
        if (marker !== undefined) {
          resolve({
            ready: false,
            detail: `${url} responded 200 but served Next's not-found page`,
          });
          return;
        }
        resolve({ ready: true, detail: `${url} responded 200` });
      });
    });
    // A dev server mid-compile can accept a connection and then hold it open
    // without ever answering. Without this the whole readiness loop parks on
    // that one socket and sails past its own deadline, reporting nothing.
    request.on("timeout", () => {
      request.destroy();
      resolve({
        ready: false,
        detail: `${url} accepted the connection but did not respond within ${timeoutMs}ms`,
      });
    });
    request.on("error", (err) => {
      resolve({
        ready: false,
        detail: `${url} did not respond: ${err.message}`,
      });
    });
  });
}

/**
 * Polls every path in `probePaths` until all of them report app-serving
 * responses (see {@link probeOnce}), or rejects once `timeoutMs` has elapsed —
 * naming the probe that was still failing, so a timeout says which route
 * never came up rather than only that something didn't.
 */
export async function waitForServerReady(
  baseUrl: string,
  timeoutMs: number,
  pollIntervalMs: number,
  probePaths: readonly string[] = DEFAULT_READY_PROBE_PATHS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastDetail = "no probe attempted yet";

  for (;;) {
    let allReady = true;
    for (const probePath of probePaths) {
      const outcome = await probeOnce(`${baseUrl}${probePath}`);
      if (!outcome.ready) {
        allReady = false;
        lastDetail = outcome.detail;
        break;
      }
    }
    if (allReady) return;

    if (Date.now() >= deadline) {
      throw new Error(
        `QA dev server did not become ready within ${timeoutMs}ms (${baseUrl}) — ${lastDetail}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Raised when the run's `distDir` holds a dev-server lock belonging to a
 * process that is still alive. Failing loudly beats either hanging on Next's
 * own retry-then-exit path or clobbering a live server's state.
 */
export class DevServerLockHeldError extends Error {
  constructor(lockPath: string, pid: number) {
    super(
      `A live Next dev server (pid ${pid}) already holds the lock at ` +
        `"${lockPath}". Stop it (kill ${pid}) before starting a QA run.`,
    );
    this.name = "DevServerLockHeldError";
  }
}

/** `true` when `pid` names a process this host currently knows about. */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH is the only confirmation the process is gone. EPERM means it
    // exists but belongs to another user — treating that as dead and deleting
    // the lock would be exactly the "silently overwrite a live server" case
    // this guard exists to prevent.
    return (err as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/**
 * Clears a stale `<distDir>/dev/lock` left behind by a dev server that died
 * without releasing it.
 *
 * Next records `{"pid":…,"port":…}` in that file and refuses to start a second
 * dev server for the same directory while it exists, so a killed server (or a
 * `qa finish` that could not confirm a stop) makes every subsequent `qa start`
 * fail until the file is deleted by hand. A lock naming a dead PID is removed;
 * one naming a live PID raises {@link DevServerLockHeldError}.
 *
 * @throws {DevServerLockHeldError} when the recorded PID is still alive.
 */
export function clearStaleDevLock(distDir: string): void {
  const lockPath = path.join(distDir, "dev", "lock");
  let raw: string;
  try {
    raw = fs.readFileSync(lockPath, "utf8");
  } catch {
    return; // No lock file — nothing to clear.
  }

  let pid: unknown;
  try {
    pid = (JSON.parse(raw) as { pid?: unknown }).pid;
  } catch {
    pid = undefined; // Unparseable lock: no owner to attribute it to.
  }

  if (typeof pid === "number" && Number.isInteger(pid) && isPidAlive(pid)) {
    throw new DevServerLockHeldError(lockPath, pid);
  }

  // Either the lock names a dead PID or it carries no usable owner at all;
  // in both cases no running server depends on it.
  fs.rmSync(lockPath, { force: true });
}

/**
 * Waits for a child process to exit, resolving once it has exited.
 * Resolves immediately if the process has already exited by the time this
 * is called.
 */
function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
  });
}

/**
 * Signals an entire process group rather than just the direct child. The
 * child is spawned with `detached: true`, making its pid the process group
 * id too; signaling `-pid` reaches pnpm and every descendant it forked
 * (`next dev`, Turbopack workers, etc.) instead of leaving them orphaned.
 * Falls back to signaling the child directly if the group signal fails
 * (e.g. the process already exited, or the platform doesn't support
 * negative-pid signaling).
 */
function killProcessGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid;
  if (pid === undefined) {
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process is already gone — nothing left to signal.
    }
  }
}

/**
 * Reports whether the process group led by `pid` still has any member.
 *
 * `process.kill(-pid, 0)` sends no signal; it only asks. ESRCH is the one
 * answer that confirms the group is empty — anything else (notably EPERM) is
 * ambiguous, and an ambiguous answer must not be read as "gone", or a live
 * group gets reported as reaped.
 */
function isProcessGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/**
 * Waits for every process in the child's group to disappear, escalating to
 * `SIGKILL` if they do not go quietly.
 *
 * Resolves once the group is confirmed empty, or once `timeoutMs` has elapsed
 * with the group's state still ambiguous — this is best-effort teardown, not a
 * guarantee, and it must never hang a caller that is only trying to clean up.
 */
async function reapProcessGroup(
  child: ChildProcess,
  timeoutMs: number,
): Promise<void> {
  const pid = child.pid;
  if (pid === undefined) return;

  const graceDeadline = Date.now() + timeoutMs;
  while (Date.now() < graceDeadline) {
    if (!isProcessGroupAlive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  killProcessGroup(child, "SIGKILL");

  const killDeadline = Date.now() + timeoutMs;
  while (Date.now() < killDeadline) {
    if (!isProcessGroupAlive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Spawns the frontend's Next.js dev server (`pnpm --filter getwrite-frontend
 * dev`) pointed at a disposable QA workspace, with `GETWRITE_PROJECTS_DIR`
 * set before the process starts and a free port discovered up front rather
 * than assuming 3000 is available.
 *
 * Resolves once the server responds to an HTTP request, or rejects if it
 * fails to become ready within `readyTimeoutMs`.
 */
export async function startQaServer(
  options: StartQaServerOptions,
): Promise<QaServerHandle> {
  const {
    workspaceDir,
    repoRoot = defaultRepoRoot(),
    readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    distDir,
    logPath = path.join(workspaceDir, QA_SERVER_LOG_FILENAME),
    readyProbePaths = DEFAULT_READY_PROBE_PATHS,
  } = options;

  // A run-scoped distDir gets its own lock file, which can go stale the same
  // way the shared one does (a killed server never releases it). Checking
  // before spawn turns "hangs until the readiness timeout" into an immediate,
  // explanatory failure.
  if (distDir !== undefined) {
    clearStaleDevLock(distDir);
  }

  const port = options.port ?? (await findFreePort());

  // The URL handed to the QA agent must use `localhost`, not `127.0.0.1`.
  // Next 16's dev server treats a bare IP as a foreign origin unless it is
  // listed in `allowedDevOrigins`, and silently refuses the HMR socket and
  // client chunks for it. The page still server-renders and returns 200, so
  // it looks healthy — but React never hydrates and every control is inert.
  //
  // That failure mode is particularly dangerous for this harness: an agent
  // driving the app would find every button present, click it, observe
  // nothing happen, and conclude the *product* is broken. The server is
  // still bound to 127.0.0.1 below, so this stays loopback-only.
  const url = `http://localhost:${port}`;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Must be set before the child starts: projects-dir.ts reads this once
    // at server start and never again.
    GETWRITE_PROJECTS_DIR: workspaceDir,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    // Read by `frontend/next.config.mjs`. `next dev` has no `--dist-dir`
    // flag, so a run-scoped build directory can only be passed through the
    // config, which means through the environment.
    ...(distDir === undefined ? {} : { GETWRITE_QA_DIST_DIR: distDir }),
    // A QA run is account-free by definition: it drives a disposable
    // filesystem workspace, not a tenant. Inheriting a developer's hosted-auth
    // env would activate `isHostedAuthActive()` in the child, and the `(app)`
    // layout would then redirect the unauthenticated readiness probe — a 307
    // the probe never accepts, burning the full readiness budget before
    // failing. Cleared explicitly rather than left to chance.
    DATABASE_URL: undefined,
    BETTER_AUTH_SECRET: undefined,
  };

  // `detached: true` makes this child the leader of a new process group
  // (POSIX). That matters for `stop()`: `next dev` (via pnpm/Turbopack) forks
  // its own descendant processes, and a plain SIGTERM to just this child's
  // pid would leave those descendants running as orphans. Signaling the
  // negative pid targets the whole group instead. Avoiding `shell: true`
  // also means `child.pid` is pnpm's own pid rather than an intermediate
  // shell's, so it actually belongs to the group we create.
  // stdout/stderr go to a file, never a pipe. `qa start` exits as soon as the
  // server is ready, so a piped child would be left writing into a buffer
  // nobody reads; once it fills, the server blocks mid-compile and every
  // subsequent request hangs. A file descriptor has no such backpressure.
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logFd = fs.openSync(logPath, "a");

  let child: ChildProcess;
  try {
    child = spawn("pnpm", ["--filter", "getwrite-frontend", "dev"], {
      cwd: repoRoot,
      env,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
  } finally {
    // The child holds its own duplicate of the descriptor once spawned, so
    // this process closes its copy rather than leaking it for the lifetime
    // of the command.
    fs.closeSync(logFd);
  }

  const earlyExit = new Promise<never>((_, reject) => {
    child.once("exit", (code, signal) => {
      reject(
        new Error(
          `QA dev server exited before becoming ready (code=${String(
            code,
          )}, signal=${String(signal)})`,
        ),
      );
    });
    child.once("error", (err) => {
      reject(new Error(`QA dev server failed to spawn: ${err.message}`));
    });
  });

  async function stop(
    killTimeoutMs: number = DEFAULT_KILL_TIMEOUT_MS,
  ): Promise<void> {
    const alreadyExited = child.exitCode !== null || child.signalCode !== null;

    if (!alreadyExited) {
      const exited = waitForExit(child);
      killProcessGroup(child, "SIGTERM");

      const timedOut = await Promise.race([
        exited.then(() => false),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(true), killTimeoutMs),
        ),
      ]);

      if (timedOut) {
        killProcessGroup(child, "SIGKILL");
        await exited;
      }
    }

    // The direct child exiting is NOT the end of it. `child` is pnpm, which
    // exits promptly on SIGTERM, while the `next dev` / next-server /
    // Turbopack-worker processes it forked into this group can outlive it —
    // observed as a dozen next-server processes still running long after
    // their tests had "cleanly stopped". Returning here without reaping the
    // group is what orphaned them.
    //
    // The early-return-when-already-exited path had the same hole, and worse:
    // it skipped teardown entirely.
    await reapProcessGroup(child, killTimeoutMs);
  }

  try {
    await Promise.race([
      waitForServerReady(url, readyTimeoutMs, pollIntervalMs, readyProbePaths),
      earlyExit,
    ]);
  } catch (err) {
    // This function spawned the child, so it owns it until it hands back a
    // handle — and on this path it never does. Leaving it running orphans a
    // detached process-group leader that no caller has a PID for: `qa start`
    // writes its session record only on success, so nothing can ever stop it
    // afterwards. Observed in practice, as a dev server surviving a readiness
    // timeout and having to be killed by hand.
    await stop().catch(() => {
      // The readiness failure is the error worth surfacing, not a secondary
      // failure to clean up after it.
    });
    throw err;
  }

  return { child, port, url, stop };
}
