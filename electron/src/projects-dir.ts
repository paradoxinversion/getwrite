/**
 * @module projects-dir
 *
 * Where the desktop build keeps a user's projects, and how it rescues projects
 * an earlier build put somewhere it should never have put them.
 *
 * Split out of `main.ts` so it can be tested without an Electron runtime:
 * everything here takes its environment as arguments rather than reaching for
 * `app` or `process.resourcesPath`. That matters more than usual, because the
 * bug this module exists to fix destroyed user data silently.
 */
import fs from "fs";
import path from "path";

/** The environment a packaged or development build runs in. */
export interface ProjectsDirEnvironment {
  /** Whether this is a packaged build rather than `electron dist/main.js`. */
  isPackaged: boolean;
  /** The user's documents directory (`app.getPath("documents")`). */
  documentsDir: string;
  /** Electron's per-user data directory (`app.getPath("userData")`). */
  userDataDir: string;
  /** The bundle's resources directory (`process.resourcesPath`). */
  resourcesPath: string;
  /** The repo root, used only by development builds. */
  repoRoot: string;
}

/** The visible folder name a user's workspace gets inside Documents. */
export const WORKSPACE_FOLDER_NAME = "GetWrite";

/** What a migration did, for logging and for tests to assert on. */
export interface MigrationResult {
  /** Entries moved or copied into the destination. */
  moved: number;
  /** Entries left alone because the destination already had them. */
  kept: number;
  /** Entries that could not be migrated at all. */
  failed: number;
}

/**
 * Resolves where a packaged build keeps projects by default.
 *
 * `~/Documents/GetWrite`, because a manuscript is the user's document and not
 * the application's private state. A writer has to be able to find their own
 * work — to back it up, copy it to another machine, or put it in a synced
 * folder deliberately — and `userData` is hidden by default on macOS, so
 * anything filed there is effectively invisible. It is also where Scrivener,
 * Ulysses and Obsidian keep their equivalents, which is to say where people
 * already look.
 *
 * It is emphatically **not** `process.resourcesPath`, where a packaged build
 * used to put it. That was wrong three ways over: replacing `GetWrite.app`
 * replaces its `Contents/`, so a drag-to-Applications update discarded every
 * project; a signed bundle is sealed, so runtime writes invalidate the
 * signature and can fail outright under a strict Gatekeeper policy; and it put
 * user documents inside a program.
 *
 * Development builds are unchanged: they keep using the repo's `projects/`
 * directory, which is what every contributor's working copy expects.
 *
 * @param environment - See {@link ProjectsDirEnvironment}.
 * @returns Absolute path to the default projects directory.
 */
export function defaultProjectsDir(
  environment: ProjectsDirEnvironment,
): string {
  return environment.isPackaged
    ? path.join(environment.documentsDir, WORKSPACE_FOLDER_NAME)
    : path.join(environment.repoRoot, "projects");
}

/**
 * Every location an earlier build may have left projects in.
 *
 * Ordered oldest first. {@link migrateLegacyProjectsDir} drains each in turn,
 * so someone who skips a version is still rescued rather than quietly starting
 * with an empty workspace beside their real one.
 *
 * @param environment - See {@link ProjectsDirEnvironment}.
 * @returns Absolute paths that may still hold a user's projects.
 */
export function legacyProjectsDirs(
  environment: ProjectsDirEnvironment,
): string[] {
  return [
    // Inside the app bundle — the location that lost data on every update.
    path.join(environment.resourcesPath, "projects"),
    // userData — right about durability, wrong about discoverability.
    path.join(environment.userDataDir, "projects"),
  ];
}

/**
 * Moves anything left in the legacy in-bundle directory to the real one.
 *
 * Safe to call on every launch: once the legacy directory is gone or empty this
 * does nothing, so it needs no "already migrated" flag — the directory's own
 * presence is the flag.
 *
 * **It rescues a narrower set of users than it appears to.** The in-bundle
 * location is destroyed by the very act of replacing `GetWrite.app`, so a user
 * who updates the normal way — a new `.dmg` dragged over the old app — has
 * already lost the data before any code in the new bundle can run. No fix
 * shipped *inside* the application can execute early enough to prevent that.
 * This helps only where the old directory survives to the new build's first
 * launch: an in-place run of a rebuilt app, a copy restored from a backup, or a
 * user who never updated. That is worth having, and it is not a full recovery
 * story. Verified the hard way: repackaging over an installed build destroyed
 * an encrypted test project before this function ever saw it.
 *
 * Three rules, all of them about not turning a bad situation into a worse one:
 *
 * - **Never overwrite.** An entry already present at the destination is left
 *   untouched. The destination is the live workspace, and a stale copy from
 *   inside the bundle must not clobber it.
 * - **Never delete on failure.** `rename` moves atomically and clears the
 *   source; if it fails, the fallback copies and deliberately leaves the
 *   original in place. A duplicate is recoverable, a deletion is not.
 * - **Carry the dotfiles.** `.getwrite-keyring.json` and `.getwrite-names` sit
 *   beside the project directories, and an encrypted workspace whose keyring
 *   was left behind is unrecoverable ciphertext, not merely a missing file.
 *
 * @param legacy - The in-bundle directory to drain.
 * @param destination - The real projects directory; must already exist.
 * @param log - Sink for progress messages.
 * @returns What was moved, kept, and failed.
 */
export function migrateLegacyProjectsDir(
  legacy: string,
  destination: string,
  log: (message: string) => void = () => {},
): MigrationResult {
  const empty: MigrationResult = { moved: 0, kept: 0, failed: 0 };
  if (path.resolve(legacy) === path.resolve(destination)) return empty;
  if (!fs.existsSync(legacy)) return empty;

  let entries: string[];
  try {
    entries = fs.readdirSync(legacy);
  } catch (error) {
    log(`Could not read legacy projects directory ${legacy}: ${String(error)}`);
    return empty;
  }
  if (entries.length === 0) return empty;

  log(`Migrating ${entries.length} entry/entries from ${legacy}`);
  const result: MigrationResult = { moved: 0, kept: 0, failed: 0 };

  for (const entry of entries) {
    const from = path.join(legacy, entry);
    const to = path.join(destination, entry);

    if (fs.existsSync(to)) {
      log(`  skipped ${entry}: the destination already has it`);
      result.kept += 1;
      continue;
    }

    try {
      fs.renameSync(from, to);
      result.moved += 1;
    } catch {
      // A different volume, or a bundle we are not permitted to modify.
      try {
        fs.cpSync(from, to, { recursive: true });
        result.moved += 1;
        log(`  copied ${entry}; the original was left in place`);
      } catch (error) {
        result.failed += 1;
        log(`  FAILED to migrate ${entry}: ${String(error)}`);
      }
    }
  }

  log(
    `Migration finished: ${result.moved} moved, ${result.kept} already present, ${result.failed} failed`,
  );
  return result;
}

/** Filename, inside `userData`, of the workspace-location override. */
export const WORKSPACE_CONFIG_FILENAME = "workspace.json";

/** Why a proposed workspace location was rejected. */
export type WorkspaceRejection =
  | "not-absolute"
  | "inside-app-bundle"
  | "not-writable";

/** The outcome of validating a proposed workspace location. */
export type WorkspaceValidation =
  | { ok: true }
  | { ok: false; reason: WorkspaceRejection; message: string };

/**
 * Resolves the file holding the user's chosen workspace location.
 *
 * It lives in `userData`, never in the workspace itself — a pointer stored
 * inside the thing it points at cannot be read before the thing is found.
 *
 * @param userDataDir - Electron's per-user data directory.
 * @returns Absolute path to the config file.
 */
function workspaceConfigPath(userDataDir: string): string {
  return path.join(userDataDir, WORKSPACE_CONFIG_FILENAME);
}

/**
 * Reads the user's chosen workspace location, if they have set one.
 *
 * A missing, unreadable, or malformed file means "no choice recorded" and
 * yields `null`, so a corrupted config downgrades to the default rather than
 * preventing the app from starting.
 *
 * @param userDataDir - Electron's per-user data directory.
 * @returns The configured path, or `null` to use the default.
 */
export function readConfiguredProjectsDir(userDataDir: string): string | null {
  try {
    const raw = fs.readFileSync(workspaceConfigPath(userDataDir), "utf8");
    const parsed = JSON.parse(raw) as { projectsDir?: unknown };
    return typeof parsed.projectsDir === "string" && parsed.projectsDir
      ? parsed.projectsDir
      : null;
  } catch {
    return null;
  }
}

/**
 * Records the user's chosen workspace location.
 *
 * @param userDataDir - Electron's per-user data directory.
 * @param projectsDir - The directory to use from now on.
 */
export function writeConfiguredProjectsDir(
  userDataDir: string,
  projectsDir: string,
): void {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(
    workspaceConfigPath(userDataDir),
    `${JSON.stringify({ projectsDir }, null, 2)}\n`,
  );
}

/**
 * Clears any recorded choice, returning the app to the default location.
 *
 * @param userDataDir - Electron's per-user data directory.
 */
export function clearConfiguredProjectsDir(userDataDir: string): void {
  try {
    fs.rmSync(workspaceConfigPath(userDataDir), { force: true });
  } catch {
    // Already gone — the desired end state either way.
  }
}

/**
 * Resolves where projects actually live: the user's choice, or the default.
 *
 * A configured location is honoured even if it has since become unreachable,
 * because silently falling back to the default would present an empty
 * workspace and invite the user to start rewriting work that still exists.
 * Failing loudly is the kinder outcome.
 *
 * @param environment - See {@link ProjectsDirEnvironment}.
 * @returns Absolute path to the projects directory.
 */
export function resolveProjectsDir(
  environment: ProjectsDirEnvironment,
): string {
  if (!environment.isPackaged) return defaultProjectsDir(environment);
  return (
    readConfiguredProjectsDir(environment.userDataDir) ??
    defaultProjectsDir(environment)
  );
}

/**
 * Decides whether a proposed workspace location may be used.
 *
 * @param candidate - The directory the user picked.
 * @param environment - See {@link ProjectsDirEnvironment}.
 * @returns Whether it is usable, and why not when it is not.
 */
export function validateWorkspaceDir(
  candidate: string,
  environment: ProjectsDirEnvironment,
): WorkspaceValidation {
  if (!path.isAbsolute(candidate)) {
    return {
      ok: false,
      reason: "not-absolute",
      message: "Choose a full path to a folder.",
    };
  }

  // Inside the app bundle is the exact mistake this whole module exists to
  // undo; refuse to let a user re-create it by hand.
  const bundle = path.resolve(environment.resourcesPath);
  const resolved = path.resolve(candidate);
  if (
    environment.resourcesPath &&
    (resolved === bundle || resolved.startsWith(`${bundle}${path.sep}`))
  ) {
    return {
      ok: false,
      reason: "inside-app-bundle",
      message:
        "That folder is inside the GetWrite application. Updating the app would delete everything in it.",
    };
  }

  try {
    fs.mkdirSync(resolved, { recursive: true });
    fs.accessSync(resolved, fs.constants.W_OK);
  } catch {
    return {
      ok: false,
      reason: "not-writable",
      message: "GetWrite cannot write to that folder. Choose another.",
    };
  }

  return { ok: true };
}

/**
 * Creates the projects directory, failing with a message worth reading.
 *
 * The raw `mkdirSync` throw this replaces was invisible. It ran inside
 * `app.whenReady()` before the window was created, so a failure killed the
 * callback and the user got a launched app with no window, no dialog, and
 * nothing to diagnose.
 *
 * Not hypothetical: the Linux AppImage runs from a read-only SquashFS mount,
 * and this directory used to be created under `process.resourcesPath` inside
 * it — raising EROFS on every launch since the first release. Moving the
 * location fixes that particular cause; this makes the *next* cause legible,
 * whatever it turns out to be (a redirected Documents folder, a full disk, a
 * permissions change).
 *
 * @param projectsDir - The directory to create.
 * @throws {Error} With a message naming the path and the underlying cause.
 */
export function ensureProjectsDir(projectsDir: string): void {
  try {
    fs.mkdirSync(projectsDir, { recursive: true });
  } catch (error) {
    throw new Error(
      `GetWrite could not create its projects folder at ${projectsDir}. ` +
        `Check that the folder is writable, then restart. (${String(error)})`,
    );
  }
}
