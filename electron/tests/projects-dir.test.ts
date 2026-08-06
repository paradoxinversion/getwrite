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
  legacyProjectsDir,
  migrateLegacyProjectsDir,
  resolveProjectsDir,
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
  destination = path.join(root, "userData", "projects");
  fs.mkdirSync(destination, { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("resolveProjectsDir", () => {
  it("keeps a packaged build's projects out of the app bundle", () => {
    const environment: ProjectsDirEnvironment = {
      isPackaged: true,
      userDataDir: "/Users/x/Library/Application Support/getwrite-electron",
      resourcesPath: "/Applications/GetWrite.app/Contents/Resources",
      repoRoot: "/repo",
    };

    const resolved = resolveProjectsDir(environment);

    // The whole point: an update replaces Contents/, so anything under
    // resourcesPath is destroyed by a routine upgrade.
    expect(resolved).not.toContain(environment.resourcesPath);
    expect(resolved).toBe(path.join(environment.userDataDir, "projects"));
  });

  it("leaves development builds on the repo's projects directory", () => {
    const resolved = resolveProjectsDir({
      isPackaged: false,
      userDataDir: "",
      resourcesPath: "",
      repoRoot: "/repo",
    });

    // Every contributor's working copy expects this; the fix must not move it.
    expect(resolved).toBe(path.join("/repo", "projects"));
  });

  it("points the legacy location at the old in-bundle path", () => {
    expect(
      legacyProjectsDir({
        isPackaged: true,
        userDataDir: "/userdata",
        resourcesPath: "/Applications/GetWrite.app/Contents/Resources",
        repoRoot: "/repo",
      }),
    ).toBe("/Applications/GetWrite.app/Contents/Resources/projects");
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
