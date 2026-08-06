// Last Updated: 2026-08-03

/**
 * @module crypto/workspace-adapter
 *
 * One adapter for a whole workspace, routing each path to the right key.
 *
 * `adapter-selection.ts` resolves an adapter for *one* project, which suits code
 * that already knows which project it is working on. Almost nothing does: the
 * open, save, search, revision, compile and export paths all just call `io.ts`
 * with a path. Requiring each of them to wrap itself in `runInProjectContext`
 * meant every one of them had to remember, and every future one too — which is
 * exactly how encrypting a project came to make it unopenable.
 *
 * This binds once per request instead. Every path under the workspace looks like
 * `<tenantRoot>/<projectId>/…` (ADR-017/018), so the project id is recoverable
 * from the path alone. A path belonging to a project with a key is sealed and
 * opened with that key; everything else passes straight through:
 *
 * - unencrypted projects — byte-identical to no encryption at all;
 * - workspace-level files (the keyring, the sealed name index) — which must stay
 *   readable before any project can be opened.
 *
 * **On FR12.** The spec asks that an unencrypted project's chain contain no
 * crypto code, asserted by reference identity. That guarantee held while callers
 * opted in per project, and it cost the feature its correctness — the seam was
 * built and never adopted. This adapter is in the chain for every project, but
 * runs no cryptographic operation for one without a key, and a test asserts
 * byte-identical passthrough. The intent of FR12 is kept; its literal identity
 * check is not.
 */
import path from "node:path";
import {
  UNDERLYING_ADAPTER,
  type ReaddirResult,
  type StorageAdapter,
} from "../io";
import type { Dirent, Stats } from "node:fs";
import { encryptingAdapter } from "../encryptingAdapter";
import { EnvelopeFormatError } from "./envelope";
import { readConversionMarker } from "./convert-project";
import type { Keyring } from "./keyring";

/**
 * Wraps an adapter so each path is handled with its own project's key.
 *
 * @param inner - The deployment's underlying adapter.
 * @param tenantRoot - The workspace root that project directories sit under.
 * @param keyring - The unlocked keyring, or `null` when locked.
 * @returns An adapter that routes per project.
 */
export function workspaceEncryptionAdapter(
  inner: StorageAdapter,
  tenantRoot: string,
  keyring: Keyring | null,
): StorageAdapter {
  // One encrypting adapter per project, built on demand. Rebuilding per call
  // would import the key on every read.
  const perProject = new Map<string, StorageAdapter>();

  /**
   * Recovers the project id a path belongs to.
   *
   * @param target - An absolute path.
   * @returns The project id, or `null` for workspace-level paths.
   */
  function projectIdOf(target: string): string | null {
    const relative = path.relative(tenantRoot, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      return null;
    }
    const [first] = relative.split(path.sep);
    // Dot-prefixed entries are workspace-level artefacts, never projects.
    return first && !first.startsWith(".") ? first : null;
  }

  /**
   * The adapter a given path must be handled with.
   *
   * @param target - An absolute path.
   * @returns The project's encrypting adapter, or `inner` when it has no key.
   */
  function adapterFor(target: string): StorageAdapter {
    if (!keyring || keyring.isLocked()) return inner;

    const projectId = projectIdOf(target);
    if (!projectId || !keyring.hasProject(projectId)) return inner;

    const existing = perProject.get(projectId);
    if (existing) return existing;

    const created = encryptingAdapter(inner, keyring.projectKey(projectId));
    perProject.set(projectId, created);
    return created;
  }

  /**
   * Reads through encryption, tolerating plaintext only mid-conversion.
   *
   * A project being converted holds both forms at once, and FR22 requires it to
   * stay openable throughout. `encryptingAdapter`'s `tolerant` option exists for
   * exactly this, but it has to be decided per read: whether a conversion is in
   * flight is a fact on disk that can change between requests, and `adapterFor`
   * is synchronous.
   *
   * Resolving it here — only after a read has actually failed as "not an
   * envelope" — keeps the downgrade window as narrow as the rule allows. Nothing
   * is tolerated unless a marker is present at that moment, and an envelope that
   * fails *authentication* is never tolerated at all, because
   * {@link EnvelopeIntegrityError} is a different error (FR15).
   *
   * @param target - File being read.
   * @param read - The sealed read to attempt.
   * @param fallback - The plain read to fall back to mid-conversion.
   * @returns The file contents.
   */
  async function readTolerantly<T>(
    target: string,
    read: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await read();
    } catch (error) {
      if (!(error instanceof EnvelopeFormatError)) throw error;
      const projectId = projectIdOf(target);
      if (!projectId) throw error;
      const converting = await readConversionMarker(
        path.join(tenantRoot, projectId),
        inner,
      );
      if (!converting) throw error;
      return fallback();
    }
  }

  const routed: StorageAdapter & { [UNDERLYING_ADAPTER]: StorageAdapter } = {
    writeFile: (p, d, o) => adapterFor(p).writeFile(p, d, o),
    readFile: (p, e) =>
      readTolerantly(
        p,
        () => adapterFor(p).readFile(p, e),
        () => inner.readFile(p, e),
      ),
    readFileBuffer: (p) =>
      readTolerantly(
        p,
        () => adapterFor(p).readFileBuffer(p),
        () => inner.readFileBuffer(p),
      ),
    appendFile: (p, d) => adapterFor(p).appendFile(p, d),

    // Path and directory semantics never differ between projects, so these go
    // straight to the inner adapter rather than through a per-project wrapper.
    mkdir: (p, o) => inner.mkdir(p, o),
    readdir: (p, o): Promise<ReaddirResult> =>
      inner.readdir(p, o) as Promise<Dirent[] | string[]>,
    stat: (p): Promise<Stats> => inner.stat(p),
    rm: (p, o) => inner.rm(p, o),

    // Moves and copies carry ciphertext verbatim. Within one project that is
    // correct and cheap; across projects it would not be, but nothing in the
    // model layer moves files between projects.
    rename: (from, to) => inner.rename(from, to),
    copyFile: (from, to) => inner.copyFile(from, to),
    cp: (from, to, o) => inner.cp(from, to, o),
    fsyncFile: inner.fsyncFile ? (p) => inner.fsyncFile!(p) : undefined,

    // The crypto layer's own bookkeeping must not be routed back through
    // encryption. `getPlainStorageAdapter()` follows this to reach `inner`.
    [UNDERLYING_ADAPTER]: inner,
  };
  return routed;
}
