// Last Updated: 2026-08-06

/**
 * The desktop build's projects directory, and the rescue of projects an earlier
 * build put inside the app bundle.
 *
 * This is data-loss-adjacent code — the bug it fixes destroyed every project a
 * user had, silently, on a routine drag-to-Applications update — so the
 * migration is exercised against a real filesystem rather than a mock.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  clearConfiguredProjectsDir,
  defaultProjectsDir,
  ensureProjectsDir,
  legacyProjectsDirs,
  migrateLegacyProjectsDir,
  readConfiguredProjectsDir,
  resolveProjectsDir,
  validateWorkspaceDir,
  writeConfiguredProjectsDir,
  type ProjectsDirEnvironment,
} from "../src/projects-dir";

let root: string;
let legacy: string;
let destination: string;

/**
 * Writes a file, creating its parents.
 *
 * @param target - File path.
 * @param contents - File contents.
 */
function write(target: string, contents: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "getwrite-projects-dir-"));
  legacy = path.join(root, "bundle", "projects");
  userDataDir = path.join(root, "userData");
  destination = path.join(root, "userData", "projects");
  fs.mkdirSync(destination, { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

let userDataDir: string;

/**
 * Builds a packaged-build environment rooted in the test's temp directory.
 *
 * @param overrides - Fields to replace.
 * @returns A complete environment.
 */
function packagedEnv(
  overrides: Partial<ProjectsDirEnvironment> = {},
): ProjectsDirEnvironment {
  return {
    isPackaged: true,
    documentsDir: path.join(root, "Documents"),
    userDataDir,
    resourcesPath: path.join(root, "bundle"),
    repoRoot: path.join(root, "repo"),
    ...overrides,
  };
}

describe("defaultProjectsDir", () => {
  it("puts a packaged build's projects somewhere the user can find them", () => {
    const environment = packagedEnv();

    const resolved = defaultProjectsDir(environment);

    // Documents, not userData: a manuscript is the user's document, and
    // ~/Library is hidden by default on macOS. A writer who cannot find their
    // own work cannot back it up either.
    expect(resolved).toBe(path.join(environment.documentsDir, "GetWrite"));
    // And emphatically not inside the app bundle, which an update replaces.
    expect(resolved).not.toContain(environment.resourcesPath);
  });

  it("leaves development builds on the repo's projects directory", () => {
    const resolved = defaultProjectsDir(
      packagedEnv({ isPackaged: false, repoRoot: "/repo" }),
    );

    // Every contributor's working copy expects this; the fix must not move it.
    expect(resolved).toBe(path.join("/repo", "projects"));
  });

  it("knows every location an older build may have used", () => {
    const environment = packagedEnv();

    expect(legacyProjectsDirs(environment)).toEqual([
      path.join(environment.resourcesPath, "projects"),
      path.join(environment.userDataDir, "projects"),
    ]);
  });
});

describe("the configured workspace location", () => {
  it("defaults to Documents when the user has chosen nothing", () => {
    expect(resolveProjectsDir(packagedEnv())).toBe(
      defaultProjectsDir(packagedEnv()),
    );
  });

  it("honours a recorded choice", () => {
    const chosen = path.join(root, "elsewhere", "Novels");
    writeConfiguredProjectsDir(userDataDir, chosen);

    expect(readConfiguredProjectsDir(userDataDir)).toBe(chosen);
    expect(resolveProjectsDir(packagedEnv())).toBe(chosen);
  });

  it("returns to the default once the choice is cleared", () => {
    writeConfiguredProjectsDir(userDataDir, path.join(root, "elsewhere"));
    clearConfiguredProjectsDir(userDataDir);

    expect(resolveProjectsDir(packagedEnv())).toBe(
      defaultProjectsDir(packagedEnv()),
    );
  });

  it("treats a corrupt config as no choice at all", () => {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(path.join(userDataDir, "workspace.json"), "{not json");

    // Refusing to start because a preferences file is damaged would be a much
    // worse failure than quietly using the default.
    expect(readConfiguredProjectsDir(userDataDir)).toBeNull();
    expect(resolveProjectsDir(packagedEnv())).toBe(
      defaultProjectsDir(packagedEnv()),
    );
  });

  it("ignores a recorded choice in development builds", () => {
    writeConfiguredProjectsDir(userDataDir, path.join(root, "elsewhere"));

    expect(
      resolveProjectsDir(packagedEnv({ isPackaged: false, repoRoot: "/repo" })),
    ).toBe(path.join("/repo", "projects"));
  });
});

describe("validateWorkspaceDir", () => {
  it("accepts a writable folder", () => {
    expect(
      validateWorkspaceDir(path.join(root, "somewhere"), packagedEnv()),
    ).toEqual({ ok: true });
  });

  it("refuses a relative path", () => {
    const result = validateWorkspaceDir("./projects", packagedEnv());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("not-absolute");
  });

  it("refuses a folder inside the app bundle", () => {
    const environment = packagedEnv();
    const inside = path.join(environment.resourcesPath, "projects");

    const result = validateWorkspaceDir(inside, environment);

    // This is the exact mistake the module exists to undo. A user must not be
    // able to re-create it by hand, however deliberately.
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("inside-app-bundle");
    expect(result.ok === false && result.message).toMatch(/delete/i);
  });
});

describe("migrateLegacyProjectsDir", () => {
  it("moves projects out of the bundle", () => {
    write(path.join(legacy, "project-a", "project.json"), '{"name":"A"}');
    write(path.join(legacy, "project-b", "project.json"), '{"name":"B"}');

    const result = migrateLegacyProjectsDir(legacy, destination);

    expect(result).toEqual({ moved: 2, kept: 0, failed: 0 });
    expect(
      fs.readFileSync(
        path.join(destination, "project-a", "project.json"),
        "utf8",
      ),
    ).toBe('{"name":"A"}');
    // Moved, not copied: nothing is left behind to be lost or to confuse.
    expect(fs.existsSync(path.join(legacy, "project-a"))).toBe(false);
  });

  it("carries the keyring and name index, not just the projects", () => {
    write(path.join(legacy, ".getwrite-keyring.json"), '{"version":1}');
    write(path.join(legacy, ".getwrite-names"), "sealed-bytes");
    write(path.join(legacy, "project-a", "project.json"), "{}");

    migrateLegacyProjectsDir(legacy, destination);

    // An encrypted workspace whose keyring was left behind is unrecoverable
    // ciphertext, not a missing file.
    expect(
      fs.existsSync(path.join(destination, ".getwrite-keyring.json")),
    ).toBe(true);
    expect(fs.existsSync(path.join(destination, ".getwrite-names"))).toBe(true);
  });

  it("never overwrites what is already in the destination", () => {
    write(path.join(legacy, "project-a", "project.json"), '{"name":"stale"}');
    write(
      path.join(destination, "project-a", "project.json"),
      '{"name":"live"}',
    );

    const result = migrateLegacyProjectsDir(legacy, destination);

    // The destination is the live workspace. A stale copy from inside the
    // bundle must never clobber it.
    expect(result).toEqual({ moved: 0, kept: 1, failed: 0 });
    expect(
      fs.readFileSync(
        path.join(destination, "project-a", "project.json"),
        "utf8",
      ),
    ).toBe('{"name":"live"}');
  });

  it("is a no-op when there is nothing left to move", () => {
    expect(migrateLegacyProjectsDir(legacy, destination)).toEqual({
      moved: 0,
      kept: 0,
      failed: 0,
    });

    fs.mkdirSync(legacy, { recursive: true });
    expect(migrateLegacyProjectsDir(legacy, destination)).toEqual({
      moved: 0,
      kept: 0,
      failed: 0,
    });
  });

  it("can run on every launch without re-migrating", () => {
    write(path.join(legacy, "project-a", "project.json"), "{}");

    expect(migrateLegacyProjectsDir(legacy, destination).moved).toBe(1);
    // The legacy directory's own emptiness is the "already migrated" flag —
    // there is no separate marker that could disagree with the filesystem.
    expect(migrateLegacyProjectsDir(legacy, destination)).toEqual({
      moved: 0,
      kept: 0,
      failed: 0,
    });
    expect(
      fs.existsSync(path.join(destination, "project-a", "project.json")),
    ).toBe(true);
  });

  it("refuses to migrate a directory onto itself", () => {
    write(path.join(destination, "project-a", "project.json"), "{}");

    expect(migrateLegacyProjectsDir(destination, destination)).toEqual({
      moved: 0,
      kept: 0,
      failed: 0,
    });
    expect(
      fs.existsSync(path.join(destination, "project-a", "project.json")),
    ).toBe(true);
  });

  it("reports what it did", () => {
    write(path.join(legacy, "project-a", "project.json"), "{}");
    const lines: string[] = [];

    migrateLegacyProjectsDir(legacy, destination, (message) =>
      lines.push(message),
    );

    // Silent data movement is not acceptable here; the log is the only record
    // a user or a support request can appeal to.
    expect(lines.join("\n")).toMatch(/migrat/i);
  });
});

describe("ensureProjectsDir", () => {
  it("creates the directory and its parents", () => {
    const target = path.join(root, "deep", "nested", "GetWrite");

    ensureProjectsDir(target);

    expect(fs.existsSync(target)).toBe(true);
  });

  it("is happy when the directory already exists", () => {
    expect(() => ensureProjectsDir(destination)).not.toThrow();
  });

  it("names the path and the cause when it cannot create the folder", () => {
    const readOnly = path.join(root, "read-only");
    fs.mkdirSync(readOnly, { recursive: true });
    fs.chmodSync(readOnly, 0o555);
    const target = path.join(readOnly, "GetWrite");

    // The raw mkdirSync throw this replaces ran before the window existed, so
    // it killed app.whenReady() and left the user with no window and no
    // dialog. The Linux AppImage hit exactly that, from a read-only SquashFS
    // mount, on every launch since the first release.
    try {
      expect(() => ensureProjectsDir(target)).toThrow(/could not create/i);
      expect(() => ensureProjectsDir(target)).toThrow(
        new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    } finally {
      fs.chmodSync(readOnly, 0o755);
    }
  });
});
