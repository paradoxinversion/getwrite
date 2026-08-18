import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { applyCleanupPolicy, type CleanupOutcome } from "../../src/qa/cleanup";
import type { QaServerHandle } from "../../src/qa/server";

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
    path.join(os.tmpdir(), "getwrite-cli-qa-cleanup-"),
  );
  createdDirs.push(tmp);
  return tmp;
}

function fakeServerHandle(): QaServerHandle & {
  stop: ReturnType<typeof vi.fn>;
} {
  const stop = vi.fn().mockResolvedValue(undefined);
  return {
    child: {} as ChildProcess,
    port: 12345,
    url: "http://127.0.0.1:12345",
    stop,
  };
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

describe("applyCleanupPolicy", () => {
  it("deletes the workspace directory when every outcome passed", async () => {
    const workspacePath = await mkWorkspace();
    const outcomes: CleanupOutcome[] = [{ status: "pass" }, { status: "pass" }];

    const result = await applyCleanupPolicy(outcomes, workspacePath);

    expect(result.action).toBe("deleted");
    expect(result.workspacePath).toBe(workspacePath);
    expect(await pathExists(workspacePath)).toBe(false);
  });

  it.each([
    { status: "fail" as const },
    { status: "unverified" as const },
    { status: "unreachable" as const },
  ])(
    "retains the workspace directory when an outcome is $status",
    async ({ status }) => {
      const workspacePath = await mkWorkspace();
      const outcomes: CleanupOutcome[] = [{ status: "pass" }, { status }];

      const result = await applyCleanupPolicy(outcomes, workspacePath);

      expect(result.action).toBe("retained");
      expect(result.workspacePath).toBe(workspacePath);
      expect(await pathExists(workspacePath)).toBe(true);
    },
  );

  it("stops the server handle before deleting the workspace on an all-pass run", async () => {
    const workspacePath = await mkWorkspace();
    const handle = fakeServerHandle();
    const outcomes: CleanupOutcome[] = [{ status: "pass" }];

    const result = await applyCleanupPolicy(outcomes, workspacePath, handle);

    expect(handle.stop).toHaveBeenCalledTimes(1);
    expect(result.action).toBe("deleted");
    expect(await pathExists(workspacePath)).toBe(false);
  });

  it("stops the server handle before retaining the workspace on a failed run", async () => {
    const workspacePath = await mkWorkspace();
    const handle = fakeServerHandle();
    const outcomes: CleanupOutcome[] = [{ status: "fail" }];

    const result = await applyCleanupPolicy(outcomes, workspacePath, handle);

    expect(handle.stop).toHaveBeenCalledTimes(1);
    expect(result.action).toBe("retained");
    expect(await pathExists(workspacePath)).toBe(true);
  });

  it("retains the workspace when no item was exercised at all", async () => {
    // A run that verified nothing must not be treated as a clean run. Reading
    // FR-14's "delete only when every exercised item passed" as vacuously
    // true for an empty set would make a harness that checked nothing report
    // the same result as one that checked everything and passed.
    const workspacePath = await mkWorkspace();

    const result = await applyCleanupPolicy([], workspacePath);

    expect(result.action).toBe("retained");
    expect(result.message).toMatch(/verified\s+nothing/);
    expect(await pathExists(workspacePath)).toBe(true);
  });
});
