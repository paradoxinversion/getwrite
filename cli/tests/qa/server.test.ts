import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import type { Stats } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {
  clearStaleDevLock,
  DevServerLockHeldError,
  findFreePort,
  startQaServer,
  waitForServerReady,
} from "../../src/qa/server";
import { qaDistDir } from "../../src/qa/workspace";

// A cold Next.js dev server compile can legitimately take the better part of
// a minute (per server.ts's own default readyTimeoutMs). On top of that, this
// suite runs alongside the rest of the CLI package's test files, which by
// default execute in parallel worker processes — the resulting spike in
// concurrently open file descriptors/watches can make Turbopack's own file
// watcher throw `EMFILE` and restart the dev server mid-run, so a single
// attempt budget needs real headroom, and `retry` gives a second attempt at
// a time when sibling test files (which each take only seconds) have likely
// already finished and released their file descriptors. The budget also has
// to exceed `server.ts`'s own readiness timeout, which grew when readiness
// started meaning "serving compiled routes" against a fresh per-run distDir.
const REAL_SERVER_TIMEOUT_MS = 300_000;
const REAL_SERVER_RETRY = 2;

const createdDirs: string[] = [];
const createdFiles: string[] = [];

/**
 * Set by the real-server test to undo Next's start-time rewrite of the tracked
 * `frontend/tsconfig.json`. Held at module scope so `afterEach` can also run it
 * if the test body throws before reaching its own `finally`.
 */
let restoreTsconfig: (() => Promise<void>) | undefined;

/**
 * Removes a directory, retrying briefly.
 *
 * A dev server's process group can still be flushing writes into its build
 * directory for a moment after its exit is confirmed, so a single `rm` races
 * it: the removal fails (or the process recreates part of the tree straight
 * after), and swallowing that error silently leaves a full Next build behind
 * on every run. Retrying is what makes the cleanup actually stick.
 */
async function rmWithRetry(target: string, attempts = 5): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await fs.rm(target, { recursive: true, force: true }).catch(() => {});
    try {
      await fs.access(target);
    } catch {
      return; // Gone.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

afterEach(async () => {
  await restoreTsconfig?.().catch(() => {});
  restoreTsconfig = undefined;
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      await rmWithRetry(dir);
    }
  }
  while (createdFiles.length > 0) {
    const file = createdFiles.pop();
    if (file) {
      await fs.rm(file, { force: true }).catch(() => {});
    }
  }
});

/** `fs.stat` that reports "absent" as `null` rather than throwing. */
async function statOrNull(target: string): Promise<Stats | null> {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

/**
 * Starts a throwaway HTTP server whose responses are decided per-request by
 * `handler`, so a readiness probe can be driven through a 404 window and out
 * the other side without spawning a real Next dev server.
 */
async function startStubServer(
  handler: (req: http.IncomingMessage) => { status: number; body: string },
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const { status, body } = handler(req);
    res.writeHead(status, { "content-type": "text/html" });
    res.end(body);
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("stub server did not report a port");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function mkWorkspace(): Promise<string> {
  const tmp = await fs.mkdtemp(
    path.join(os.tmpdir(), "getwrite-cli-qa-server-"),
  );
  createdDirs.push(tmp);
  return tmp;
}

function fetchOnce(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

/**
 * Fetches a URL and parses it as JSON, retrying on failure. Next.js dev
 * serves an interim HTML "compiling…" response on the very first hit to a
 * route that hasn't been compiled yet, even once `waitForServerReady`'s
 * (unrelated) readiness probe against `/` has already succeeded — so the
 * first `/api/projects` request can transiently return HTML instead of JSON.
 * See the module-level comment on `REAL_SERVER_TIMEOUT_MS` for why this
 * needs real headroom in this package's test environment.
 */
async function fetchJson(
  url: string,
  attempts = 45,
  delayMs = 1000,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const body = await fetchOnce(url);
      return JSON.parse(body) as unknown;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

describe("findFreePort", () => {
  it("returns a valid ephemeral port number on each call", async () => {
    const first = await findFreePort();
    const second = await findFreePort();

    for (const port of [first, second]) {
      expect(Number.isInteger(port)).toBe(true);
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
    }
  });
});

describe("startQaServer", () => {
  // This suite intentionally spawns only ONE real `next dev` child process
  // across the whole file (see the module-level comment for why a single
  // attempt already needs real headroom). An earlier version of this file
  // had two separate tests, each spawning its own real dev server in
  // sequence within the same process. In this repo's CI/sandboxed test
  // environment that pairing was observed to be unreliable: the second
  // spawn against the same `frontend/` cwd could come up readable on `/`
  // (satisfying `waitForServerReady`'s probe) while `/api/projects`
  // deterministically kept serving an interim/error HTML page for the
  // entire retry budget — a directory-scoped dev-server artifact (cache/
  // lock state under `frontend/.next`) that a second same-directory spawn
  // in quick succession isn't guaranteed to be independent of, even after
  // the first spawn's `.stop()` has confirmed the child process itself
  // fully exited. Rather than paper over that with a settle delay or a
  // wider retry budget (which doesn't address the interaction and still
  // burns wall-clock in CI), this test proves everything the two originals
  // did with a single spawn: reusing that one server to also cover the
  // GETWRITE_PROJECTS_DIR + /api/projects + clean-stop assertions, so no
  // second real server ever needs to boot. Port-3000-occupied handling is
  // proven directly against port selection (see below); free-port discovery
  // itself is separately covered by the `findFreePort` suite above.
  it(
    "when port 3000 is occupied it starts on a different port, sets GETWRITE_PROJECTS_DIR before start, serves valid JSON, and stops cleanly with no orphaned process",
    { timeout: REAL_SERVER_TIMEOUT_MS, retry: REAL_SERVER_RETRY },
    async () => {
      const workspaceDir = await mkWorkspace();

      // Occupy port 3000 with a throwaway listener before starting the QA
      // server, so a naive "just bind 3000" implementation would fail (or
      // this assertion would catch it binding the occupied port anyway).
      const occupied = net.createServer();
      await new Promise<void>((resolve, reject) => {
        occupied.once("error", reject);
        occupied.listen(3000, "127.0.0.1", () => resolve());
      });

      // A run-scoped distDir is what keeps this spawn from reading or
      // writing the checkout's shared `frontend/.next` (H1). Recording that
      // directory's state before the spawn is what lets the assertion below
      // prove it, rather than assume it.
      const repoRoot = path.resolve(__dirname, "..", "..", "..");
      const sharedNextDir = path.join(repoRoot, "frontend", ".next");
      const sharedNextBefore = await statOrNull(sharedNextDir);

      // Starting `next dev` makes Next rewrite the tracked tsconfig (see
      // `qa finish`, which restores it around a real run). This test spawns a
      // dev server outside that lifecycle, so it has to put the file back
      // itself — otherwise `pnpm test` leaves the checkout dirty.
      const trackedTsconfig = path.join(repoRoot, "frontend", "tsconfig.json");
      const tsconfigBefore = await fs
        .readFile(trackedTsconfig, "utf8")
        .catch(() => undefined);
      restoreTsconfig = async (): Promise<void> => {
        if (tsconfigBefore === undefined) return;
        const now = await fs
          .readFile(trackedTsconfig, "utf8")
          .catch(() => undefined);
        if (now !== tsconfigBefore) {
          await fs.writeFile(trackedTsconfig, tsconfigBefore, "utf8");
        }
      };
      const runDistDir = qaDistDir(path.basename(workspaceDir), repoRoot);
      createdDirs.push(runDistDir);
      const logPath = path.join(
        workspaceDir,
        "..",
        `${path.basename(workspaceDir)}.log`,
      );
      createdFiles.push(logPath);

      let handle: Awaited<ReturnType<typeof startQaServer>> | undefined;
      let stopped = false;
      let occupiedClosed = false;
      try {
        handle = await startQaServer({
          workspaceDir,
          distDir: runDistDir,
          logPath,
        });

        // Port selection: a naive "just bind 3000" implementation would
        // either fail to start at all (occupied above) or bind the
        // occupied port and collide — neither of which this handle
        // exhibits.
        expect(handle.port).not.toBe(3000);
        expect(handle.child.exitCode).toBeNull();

        // The throwaway listener has served its purpose once the QA server
        // is confirmed up on a different port; release it before exercising
        // the rest of the server so it isn't held for the whole test.
        await new Promise<void>((resolve) => occupied.close(() => resolve()));
        occupiedClosed = true;

        // The dev server's /api/projects route resolves projects through
        // resolveProjectsDir(), which honors GETWRITE_PROJECTS_DIR at start.
        // A successful, non-erroring response confirms the child process is
        // reading and writing against our disposable workspace rather than
        // the repo's real projects/ directory.
        const projects = await fetchJson(`${handle.url}/api/projects`);
        expect(Array.isArray(projects)).toBe(true);

        // H6: the log must not land inside the run's GETWRITE_PROJECTS_DIR,
        // which the app scans for projects.
        expect(await fs.readdir(workspaceDir)).not.toContain("qa-server.log");

        await handle.stop();
        stopped = true;

        expect(
          handle.child.exitCode !== null || handle.child.signalCode !== null,
        ).toBe(true);

        // H1: the run built into its own distDir...
        const runDistStat = await statOrNull(runDistDir);
        expect(runDistStat).not.toBeNull();

        // ...and left the shared `frontend/.next` exactly as it found it —
        // still absent if it was absent, otherwise unmodified.
        const sharedNextAfter = await statOrNull(sharedNextDir);
        if (sharedNextBefore === null) {
          expect(sharedNextAfter).toBeNull();
        } else {
          expect(sharedNextAfter?.mtimeMs).toBe(sharedNextBefore.mtimeMs);
        }
      } finally {
        if (!stopped) {
          await handle?.stop().catch(() => {});
        }
        if (!occupiedClosed) {
          occupied.close();
        }
        await restoreTsconfig?.().catch(() => {});
        restoreTsconfig = undefined;
      }
    },
  );
});

describe("readiness probe", () => {
  it("does not report ready while the app serves 404s, and does once it serves 200s", async () => {
    // H4: the old probe returned as soon as any HTTP response arrived, so the
    // agent could navigate before routes had compiled and land on a 404 that
    // reads as a product defect. Readiness has to mean "serving the app".
    let requestsSeen = 0;
    let serving = false;
    const stub = await startStubServer(() => {
      requestsSeen += 1;
      return serving
        ? { status: 200, body: "<html>app</html>" }
        : { status: 404, body: "<html>This page could not be found</html>" };
    });

    try {
      // While the stub is still 404ing, the probe must never report ready —
      // it is not satisfied by a mere response, only by an app-serving one.
      await expect(waitForServerReady(stub.url, 60, 5, ["/"])).rejects.toThrow(
        /did not become ready/,
      );
      expect(requestsSeen).toBeGreaterThan(0);

      // Once 200s begin, the same probe resolves.
      serving = true;
      await expect(
        waitForServerReady(stub.url, 5_000, 5, ["/"]),
      ).resolves.toBeUndefined();
    } finally {
      await stub.close();
    }
  });

  it("requires every probed path to serve the app, not just the first", async () => {
    // The agent's first interaction hits both the app shell and an API
    // route; a probe that only checked `/` would still hand back a server
    // whose route handlers had not compiled.
    const stub = await startStubServer((req) =>
      req.url === "/api/projects"
        ? { status: 404, body: "<html>This page could not be found</html>" }
        : { status: 200, body: "<html>app</html>" },
    );

    try {
      await expect(
        waitForServerReady(stub.url, 30, 5, ["/", "/api/projects"]),
      ).rejects.toThrow(/api\/projects/);
    } finally {
      await stub.close();
    }
  });

  it("treats a 200 that carries Next's not-found page as not ready", async () => {
    let requestsSeen = 0;
    const stub = await startStubServer(() => {
      requestsSeen += 1;
      return { status: 200, body: "<html>This page could not be found</html>" };
    });

    try {
      await expect(waitForServerReady(stub.url, 30, 5, ["/"])).rejects.toThrow(
        /not-found page/,
      );
      expect(requestsSeen).toBeGreaterThan(0);
    } finally {
      await stub.close();
    }
  });
});

describe("clearStaleDevLock", () => {
  async function writeLock(distDir: string, pid: number): Promise<string> {
    const lockPath = path.join(distDir, "dev", "lock");
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid, port: 3000, appUrl: "http://localhost:3000" }),
      "utf8",
    );
    return lockPath;
  }

  /**
   * A PID that is confidently not in use: spawn nothing, just pick one far
   * above the current process and confirm it is unknown to the OS.
   */
  function deadPid(): number {
    for (
      let candidate = process.pid + 1;
      candidate < 4_000_000;
      candidate += 7
    ) {
      try {
        process.kill(candidate, 0);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ESRCH") return candidate;
      }
    }
    throw new Error("could not find an unused pid");
  }

  it("deletes a lock naming a dead PID so the next run can start", async () => {
    const distDir = await mkWorkspace();
    const lockPath = await writeLock(distDir, deadPid());

    clearStaleDevLock(distDir);

    await expect(fs.access(lockPath)).rejects.toThrow();
  });

  it("fails fast with an explanatory error when the lock names a live PID", async () => {
    const distDir = await mkWorkspace();
    await writeLock(distDir, process.pid);

    // Failing loudly beats hanging until the readiness timeout, and beats
    // deleting the lock out from under a server that is genuinely running.
    expect(() => clearStaleDevLock(distDir)).toThrow(DevServerLockHeldError);
    expect(() => clearStaleDevLock(distDir)).toThrow(String(process.pid));
  });

  it("is a no-op when no lock file exists", async () => {
    const distDir = await mkWorkspace();
    expect(() => clearStaleDevLock(distDir)).not.toThrow();
  });

  it("removes an unparseable lock rather than leaving it to block every run", async () => {
    const distDir = await mkWorkspace();
    const lockPath = path.join(distDir, "dev", "lock");
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(lockPath, "not json", "utf8");

    clearStaleDevLock(distDir);

    await expect(fs.access(lockPath)).rejects.toThrow();
  });
});
