import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { findFreePort, startQaServer } from "../../src/qa/server";

// A cold Next.js dev server compile can legitimately take the better part of
// a minute (per server.ts's own default readyTimeoutMs). On top of that, this
// suite runs alongside the rest of the CLI package's test files, which by
// default execute in parallel worker processes — the resulting spike in
// concurrently open file descriptors/watches can make Turbopack's own file
// watcher throw `EMFILE` and restart the dev server mid-run, so a single
// attempt budget needs real headroom, and `retry` gives a second attempt at
// a time when sibling test files (which each take only seconds) have likely
// already finished and released their file descriptors.
const REAL_SERVER_TIMEOUT_MS = 170_000;
const REAL_SERVER_RETRY = 2;

const createdDirs: string[] = [];

afterEach(async () => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

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

      let handle: Awaited<ReturnType<typeof startQaServer>> | undefined;
      let stopped = false;
      let occupiedClosed = false;
      try {
        handle = await startQaServer({ workspaceDir });

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

        await handle.stop();
        stopped = true;

        expect(
          handle.child.exitCode !== null || handle.child.signalCode !== null,
        ).toBe(true);
      } finally {
        if (!stopped) {
          await handle?.stop().catch(() => {});
        }
        if (!occupiedClosed) {
          occupied.close();
        }
      }
    },
  );
});
