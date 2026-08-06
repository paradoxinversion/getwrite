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
  /** Electron's per-user data directory (`app.getPath("userData")`). */
  userDataDir: string;
  /** The bundle's resources directory (`process.resourcesPath`). */
  resourcesPath: string;
  /** The repo root, used only by development builds. */
  repoRoot: string;
}

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
 * Resolves where projects live.
 *
 * A packaged build stores them under `userData`. It previously stored them
 * inside its own app bundle, under `process.resourcesPath`, which was wrong in
 * three separate ways:
 *
 * - **It lost data on upgrade.** Replacing `GetWrite.app` replaces its
 *   `Contents/`, so a drag-to-Applications update discarded every project.
 * - **It breaks code signing.** A signed bundle is sealed; writing into
 *   `Contents/Resources` at runtime invalidates the signature and can fail
 *   outright under a strict Gatekeeper policy.
 * - It ignored the platform convention that user data belongs in `userData`.
 *
 * Development builds are unchanged: they keep using the repo's `projects/`
 * directory, which is what every contributor's working copy expects.
 *
 * @param environment - See {@link ProjectsDirEnvironment}.
 * @returns Absolute path to the projects directory.
 */
export function resolveProjectsDir(
  environment: ProjectsDirEnvironment,
): string {
  return environment.isPackaged
    ? path.join(environment.userDataDir, "projects")
    : path.join(environment.repoRoot, "projects");
}

/**
 * Resolves where a previous packaged build wrongly kept projects.
 *
 * Exists only so {@link migrateLegacyProjectsDir} can find what is still there.
 * Nothing may ever write to this path again.
 *
 * @param environment - See {@link ProjectsDirEnvironment}.
 * @returns Absolute path to the legacy, in-bundle projects directory.
 */
export function legacyProjectsDir(environment: ProjectsDirEnvironment): string {
  return path.join(environment.resourcesPath, "projects");
}

/**
 * Moves anything left in the legacy in-bundle directory to the real one.
 *
 * Safe to call on every launch: once the legacy directory is gone or empty this
 * does nothing, so it needs no "already migrated" flag — the directory's own
 * presence is the flag.
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
