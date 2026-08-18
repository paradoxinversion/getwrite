import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createQaWorkspace,
  defaultRepoRoot,
  WorkspaceContainmentError,
} from "../../src/qa/workspace";

const createdDirs: string[] = [];

afterEach(async () => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

describe("createQaWorkspace", () => {
  it("returns distinct paths on successive calls", async () => {
    const first = await createQaWorkspace();
    createdDirs.push(first);
    const second = await createQaWorkspace();
    createdDirs.push(second);

    expect(first).not.toBe(second);
  });

  it("creates the workspace under the OS temp directory", async () => {
    const workspace = await createQaWorkspace();
    createdDirs.push(workspace);

    const resolvedTmpdir = path.resolve(os.tmpdir());
    const resolvedWorkspace = path.resolve(workspace);
    const relative = path.relative(resolvedTmpdir, resolvedWorkspace);

    expect(relative.startsWith("..")).toBe(false);
    expect(path.isAbsolute(relative)).toBe(false);
  });

  it("creates an empty directory that actually exists on disk", async () => {
    const workspace = await createQaWorkspace();
    createdDirs.push(workspace);

    const stat = await fs.stat(workspace);
    expect(stat.isDirectory()).toBe(true);

    const entries = await fs.readdir(workspace);
    expect(entries).toEqual([]);
  });

  it("throws WorkspaceContainmentError when repoRoot is an ancestor of the created workspace", async () => {
    // Every workspace this module creates lives under os.tmpdir(), so passing
    // os.tmpdir() itself as the "repo root" to verify against guarantees the
    // containment guard trips.
    await expect(createQaWorkspace(os.tmpdir())).rejects.toBeInstanceOf(
      WorkspaceContainmentError,
    );
  });

  it("does not throw for a repoRoot that does not contain the OS temp directory", async () => {
    const workspace = await createQaWorkspace(defaultRepoRoot());
    createdDirs.push(workspace);

    expect(workspace).toBeTruthy();
  });
});
