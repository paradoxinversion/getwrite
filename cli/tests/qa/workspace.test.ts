import { describe, it, expect, afterEach, beforeEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createQaWorkspace,
  defaultRepoRoot,
  QA_SESSION_PATH_ENV,
  qaDistDir,
  qaServerLogPath,
  qaSessionFilePath,
  qaStateDir,
  WorkspaceContainmentError,
} from "../../src/qa/workspace";
import {
  cleanUpFailedStart,
  restoreTrackedTsconfig,
  snapshotTrackedTsconfig,
} from "../../src/commands/qa";

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

describe("QA session record location", () => {
  const originalOverride = process.env[QA_SESSION_PATH_ENV];

  beforeEach(() => {
    delete process.env[QA_SESSION_PATH_ENV];
  });

  afterEach(() => {
    if (originalOverride === undefined) {
      delete process.env[QA_SESSION_PATH_ENV];
    } else {
      process.env[QA_SESSION_PATH_ENV] = originalOverride;
    }
  });

  it("resolves to the same path across invocations with different TMPDIR values", () => {
    // H3: the record used to live under os.tmpdir(), so a `qa verify` that
    // inherited a different TMPDIR than `qa start` reported "No active QA
    // session found." The record is the harness's recovery mechanism — it
    // cannot depend on an environment variable that varies per invocation.
    const repoRoot = defaultRepoRoot();
    const originalTmpdir = process.env.TMPDIR;
    try {
      process.env.TMPDIR = "/var/folders/aaa/T/";
      const fromStart = qaSessionFilePath(repoRoot);
      process.env.TMPDIR = "/var/folders/zzz/T/";
      const fromVerify = qaSessionFilePath(repoRoot);

      expect(fromVerify).toBe(fromStart);
    } finally {
      if (originalTmpdir === undefined) {
        delete process.env.TMPDIR;
      } else {
        process.env.TMPDIR = originalTmpdir;
      }
    }
  });

  it("places the record inside the repo, outside the projects tree", () => {
    const repoRoot = defaultRepoRoot();
    const sessionPath = qaSessionFilePath(repoRoot);

    expect(sessionPath.startsWith(path.resolve(repoRoot))).toBe(true);
    expect(sessionPath).toContain(path.join(".git", "getwrite-qa"));
  });

  it("honors an explicit override so every sub-command resolves the same file", () => {
    const override = path.join(os.tmpdir(), "explicit-qa", "session.json");
    process.env[QA_SESSION_PATH_ENV] = override;

    expect(qaSessionFilePath(defaultRepoRoot())).toBe(path.resolve(override));
    expect(qaStateDir(defaultRepoRoot())).toBe(
      path.dirname(path.resolve(override)),
    );
    // The server log follows the record, so an overridden session keeps its
    // evidence beside it rather than back in the default location.
    expect(qaServerLogPath(defaultRepoRoot())).toBe(
      path.join(path.dirname(path.resolve(override)), "qa-server.log"),
    );
  });

  it("keeps the dev-server log out of the run's scanned projects directory", async () => {
    // H6: the log used to be written inside GETWRITE_PROJECTS_DIR, a foreign
    // file in a tree the app scans for projects.
    const repoRoot = defaultRepoRoot();
    const workspace = await createQaWorkspace(repoRoot);
    createdDirs.push(workspace);

    const logPath = qaServerLogPath(repoRoot);
    const relative = path.relative(path.resolve(workspace), logPath);

    expect(relative.startsWith("..")).toBe(true);
  });

  it("scopes each run's Next build directory away from the shared frontend/.next", () => {
    const repoRoot = defaultRepoRoot();
    const first = qaDistDir("run-one", repoRoot);
    const second = qaDistDir("run-two", repoRoot);

    expect(first).not.toBe(second);
    for (const dir of [first, second]) {
      expect(
        dir.startsWith(path.join(path.resolve(repoRoot), "frontend")),
      ).toBe(true);
      expect(path.resolve(dir)).not.toBe(
        path.join(path.resolve(repoRoot), "frontend", ".next"),
      );
      expect(
        path
          .relative(
            path.join(path.resolve(repoRoot), "frontend", ".next"),
            path.resolve(dir),
          )
          .startsWith(".."),
      ).toBe(true);
    }
  });
});

describe("temp-directory hygiene", () => {
  it("leaves no workspace behind when the containment guard rejects the path", async () => {
    // H5: mkdtemp creates the directory before containment can be checked, so
    // a guard that threw without cleaning up leaked a getwrite-qa-* directory
    // on every rejected call — which is where the observed accumulation in
    // the OS temp dir came from.
    const before = (await fs.readdir(os.tmpdir())).filter((e) =>
      e.startsWith("getwrite-qa-"),
    );

    await expect(createQaWorkspace(os.tmpdir())).rejects.toBeInstanceOf(
      WorkspaceContainmentError,
    );

    const after = (await fs.readdir(os.tmpdir())).filter((e) =>
      e.startsWith("getwrite-qa-"),
    );
    expect(after).toEqual(before);
  });
});

describe("tracked tsconfig restoration", () => {
  it("puts frontend/tsconfig.json back exactly as it was before the run", async () => {
    // H6: starting `next dev` makes Next verify and rewrite the tsconfig it is
    // pointed at — reformatting its arrays and appending the run's distDir
    // type globs — so a QA run left the checkout dirty. (Pointing Next at an
    // untracked config instead was tried and breaks route discovery entirely,
    // so restoring afterwards is the workable fix.)
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-qa-ts-"));
    createdDirs.push(dir);
    const tsconfigPath = path.join(dir, "tsconfig.json");
    const original =
      '{\n  "compilerOptions": { "lib": ["DOM", "ES2022"] }\n}\n';
    await fs.writeFile(tsconfigPath, original, "utf8");

    const snapshot = await snapshotTrackedTsconfig(tsconfigPath);
    expect(snapshot).toBe(original);

    // Stand in for Next's rewrite.
    await fs.writeFile(
      tsconfigPath,
      '{\n  "compilerOptions": {\n    "lib": [\n      "DOM",\n      "ES2022"\n    ]\n  },\n  "include": [".next-qa/run/types/**/*.ts"]\n}\n',
      "utf8",
    );

    expect(await restoreTrackedTsconfig(tsconfigPath, snapshot)).toBe(true);
    expect(await fs.readFile(tsconfigPath, "utf8")).toBe(original);
  });

  it("reports no restore when the file is untouched", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-qa-ts-"));
    createdDirs.push(dir);
    const tsconfigPath = path.join(dir, "tsconfig.json");
    await fs.writeFile(tsconfigPath, "{}\n", "utf8");

    const snapshot = await snapshotTrackedTsconfig(tsconfigPath);

    expect(await restoreTrackedTsconfig(tsconfigPath, snapshot)).toBe(false);
  });

  it("preserves uncommitted edits rather than restoring from git", async () => {
    // The snapshot is taken at `qa start`, so a developer's own in-progress
    // tsconfig changes survive the run instead of being reverted.
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-qa-ts-"));
    createdDirs.push(dir);
    const tsconfigPath = path.join(dir, "tsconfig.json");
    const withLocalEdit = '{ "compilerOptions": { "strict": false } }\n';
    await fs.writeFile(tsconfigPath, withLocalEdit, "utf8");

    const snapshot = await snapshotTrackedTsconfig(tsconfigPath);
    await fs.writeFile(tsconfigPath, "{ /* next rewrote this */ }\n", "utf8");
    await restoreTrackedTsconfig(tsconfigPath, snapshot);

    expect(await fs.readFile(tsconfigPath, "utf8")).toBe(withLocalEdit);
  });

  it("does nothing when there was no readable file to snapshot", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-qa-ts-"));
    createdDirs.push(dir);
    const missing = path.join(dir, "tsconfig.json");

    expect(await snapshotTrackedTsconfig(missing)).toBeUndefined();
    expect(await restoreTrackedTsconfig(missing, undefined)).toBe(false);
  });
});

describe("state directory resolution across checkout shapes", () => {
  const originalOverride = process.env[QA_SESSION_PATH_ENV];

  beforeEach(() => {
    delete process.env[QA_SESSION_PATH_ENV];
  });

  afterEach(() => {
    if (originalOverride === undefined) {
      delete process.env[QA_SESSION_PATH_ENV];
    } else {
      process.env[QA_SESSION_PATH_ENV] = originalOverride;
    }
  });

  async function fakeCheckout(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-qa-co-"));
    createdDirs.push(dir);
    return dir;
  }

  it("uses .git/ directly in an ordinary clone", async () => {
    const root = await fakeCheckout();
    await fs.mkdir(path.join(root, ".git"), { recursive: true });

    expect(qaStateDir(root)).toBe(path.join(root, ".git", "getwrite-qa"));
  });

  it("follows the gitdir pointer when .git is a file (linked worktree)", async () => {
    // In a worktree `.git` is a FILE, so treating it as a directory makes the
    // session record's mkdir fail with ENOTDIR — which would leave the harness
    // unusable in exactly the worktrees this repo creates for background
    // agents.
    const root = await fakeCheckout();
    const realGitDir = path.join(root, "main-repo", ".git", "worktrees", "wt1");
    await fs.mkdir(realGitDir, { recursive: true });
    await fs.writeFile(
      path.join(root, ".git"),
      `gitdir: ${realGitDir}\n`,
      "utf8",
    );

    expect(qaStateDir(root)).toBe(path.join(realGitDir, "getwrite-qa"));
  });

  it("resolves a relative gitdir pointer against the checkout root", async () => {
    const root = await fakeCheckout();
    await fs.mkdir(path.join(root, "nested", "gitdir"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".git"),
      "gitdir: ./nested/gitdir\n",
      "utf8",
    );

    expect(qaStateDir(root)).toBe(
      path.join(root, "nested", "gitdir", "getwrite-qa"),
    );
  });

  it("falls back to an untracked directory when there is no git dir at all", async () => {
    // A source export has no `.git` — the harness should still have somewhere
    // stable to keep its state rather than failing outright.
    const root = await fakeCheckout();

    expect(qaStateDir(root)).toBe(path.join(root, ".getwrite-qa"));
  });

  it("creates the resolved state directory successfully in a worktree layout", async () => {
    // The regression this guards is an ENOTDIR at mkdir time, so actually
    // create it rather than only asserting the computed path.
    const root = await fakeCheckout();
    const realGitDir = path.join(root, "wt-gitdir");
    await fs.mkdir(realGitDir, { recursive: true });
    await fs.writeFile(
      path.join(root, ".git"),
      `gitdir: ${realGitDir}`,
      "utf8",
    );

    const stateDir = qaStateDir(root);
    await fs.mkdir(stateDir, { recursive: true });

    expect((await fs.stat(stateDir)).isDirectory()).toBe(true);
  });
});

describe("failed `qa start` rollback", () => {
  async function scratch(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-cli-qa-fs-"));
    createdDirs.push(dir);
    return dir;
  }

  it("removes the run's build directory and restores the tsconfig", async () => {
    // A failure before the session record is written leaves `qa finish` with
    // nothing to act on ("No active QA session found"), so this is the only
    // chance to undo what starting the run already changed. Observed for real:
    // a readiness timeout left both the build dir and Next's tsconfig rewrite
    // behind permanently.
    const root = await scratch();
    const distDir = path.join(root, ".next-qa", "run-1");
    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(path.join(distDir, "build.json"), "{}", "utf8");

    const tsconfigPath = path.join(root, "tsconfig.json");
    const original = '{ "compilerOptions": {} }\n';
    await fs.writeFile(tsconfigPath, original, "utf8");
    const snapshot = await snapshotTrackedTsconfig(tsconfigPath);
    await fs.writeFile(
      tsconfigPath,
      '{ "include": [".next-qa/run-1/types/**/*.ts"] }\n',
      "utf8",
    );

    await cleanUpFailedStart({
      distDir,
      tsconfigPath,
      tsconfigSnapshot: snapshot,
    });

    await expect(fs.access(distDir)).rejects.toThrow();
    expect(await fs.readFile(tsconfigPath, "utf8")).toBe(original);
  });

  it("is a no-op when nothing was recorded yet", async () => {
    // Failing before the snapshot is taken must not throw out of the catch
    // block and mask the original error.
    await expect(cleanUpFailedStart({})).resolves.toBeUndefined();
  });

  it("does not throw when the recorded paths are already gone", async () => {
    const root = await scratch();

    await expect(
      cleanUpFailedStart({
        distDir: path.join(root, "missing-dist"),
        tsconfigPath: path.join(root, "missing-tsconfig.json"),
        tsconfigSnapshot: "{}\n",
      }),
    ).resolves.toBeUndefined();
  });
});
