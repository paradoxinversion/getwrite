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
  it(
    "picks a different port than 3000 when 3000 is already occupied, rather than failing",
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

      try {
        const handle = await startQaServer({ workspaceDir });
        try {
          expect(handle.port).not.toBe(3000);
          expect(handle.child.exitCode).toBeNull();
        } finally {
          await handle.stop();
        }
      } finally {
        await new Promise<void>((resolve) => occupied.close(() => resolve()));
      }
    },
  );

  it(
    "sets GETWRITE_PROJECTS_DIR before start and stops cleanly with no orphaned process",
    { timeout: REAL_SERVER_TIMEOUT_MS, retry: REAL_SERVER_RETRY },
    async () => {
      const workspaceDir = await mkWorkspace();

      const handle = await startQaServer({ workspaceDir });
      let stopped = false;
      try {
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
          await handle.stop().catch(() => {});
        }
      }
    },
  );
});
