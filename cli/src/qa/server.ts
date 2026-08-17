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
import http from "node:http";
import net from "node:net";
import path from "node:path";

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
   * How long to wait for the server to start responding before giving up,
   * in milliseconds. Defaults to 60s: a cold Next.js dev server compile can
   * legitimately take the better part of a minute, especially the first
   * request after a fresh `.next` cache.
   */
  readyTimeoutMs?: number;
  /**
   * How long to wait between polling the server for readiness, in
   * milliseconds. Defaults to 500ms.
   */
  pollIntervalMs?: number;
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

const DEFAULT_READY_TIMEOUT_MS = 60_000;
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
 * Polls `url` until it responds with a status code below 500 (the same
 * "server is up, even if the page itself 404s" threshold used by the
 * Electron shell's dev-server bootstrap), or rejects once `timeoutMs` has
 * elapsed.
 */
function waitForServerReady(
  url: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const attempt = (): void => {
      const request = http.get(url, (res) => {
        res.resume(); // drain so the socket can close
        if (res.statusCode !== undefined && res.statusCode < 500) {
          resolve();
        } else {
          scheduleRetry();
        }
      });
      request.on("error", scheduleRetry);
    };

    const scheduleRetry = (): void => {
      if (Date.now() > deadline) {
        reject(
          new Error(
            `QA dev server did not become ready within ${timeoutMs}ms (${url})`,
          ),
        );
        return;
      }
      setTimeout(attempt, pollIntervalMs);
    };

    attempt();
  });
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
  } = options;

  const port = options.port ?? (await findFreePort());
  const url = `http://127.0.0.1:${port}`;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Must be set before the child starts: projects-dir.ts reads this once
    // at server start and never again.
    GETWRITE_PROJECTS_DIR: workspaceDir,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
  };

  // `detached: true` makes this child the leader of a new process group
  // (POSIX). That matters for `stop()`: `next dev` (via pnpm/Turbopack) forks
  // its own descendant processes, and a plain SIGTERM to just this child's
  // pid would leave those descendants running as orphans. Signaling the
  // negative pid targets the whole group instead. Avoiding `shell: true`
  // also means `child.pid` is pnpm's own pid rather than an intermediate
  // shell's, so it actually belongs to the group we create.
  const child = spawn("pnpm", ["--filter", "getwrite-frontend", "dev"], {
    cwd: repoRoot,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

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

  await Promise.race([
    waitForServerReady(url, readyTimeoutMs, pollIntervalMs),
    earlyExit,
  ]);

  async function stop(
    killTimeoutMs: number = DEFAULT_KILL_TIMEOUT_MS,
  ): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

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

  return { child, port, url, stop };
}
