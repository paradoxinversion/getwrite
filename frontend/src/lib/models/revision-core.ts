// Last Updated: 2026-07-25

/**
 * @module revision-core
 *
 * **ADR-021 Phase 1 (Task 2) — transport-agnostic revision core.** The
 * business logic behind `app/api/resource/revision/[resource-id]/route.ts`,
 * lifted so it can be reused by both the HTTP route (web/desktop) and the
 * native in-process transport (`store/transport/native-revision-backend.ts`)
 * with byte-for-byte identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. Every function operates on plain
 * `projectRoot`/`resourceId` values and throws plain `Error`s. The route
 * catches those errors and maps them to its existing HTTP status codes; the
 * native backend lets them propagate directly to the caller. Error messages
 * are intentionally kept identical to the route's pre-refactor inline
 * messages so that mapping continues to work unmodified.
 */
import path from "node:path";
import { readFile, writeFile, rm } from "./io";
import {
  listRevisions,
  revisionDir,
  setCanonicalRevision as setCanonicalRevisionByVersion,
  writeRevision,
} from "./revision";
import { readSidecar, writeSidecar } from "./sidecar";
import type { Revision } from "./types";
import { persistResourceContent } from "../tiptap-utils";
import type { TipTapDocument } from "../models";
import { resolveProjectRoot } from "./project-root-resolver";

/**
 * When `content` is omitted, {@link createRevision} reads the resource's
 * current saved content from the filesystem.
 */
export interface CreateRevisionOptions {
  content?: string;
  author?: string;
  isCanonical?: boolean;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Project root resolution
// ---------------------------------------------------------------------------

/**
 * Validates `projectId` against the canonical UUID validator and, on
 * success, resolves it to its on-disk project directory under
 * {@link resolveProjectsDir}.
 *
 * A plain, `Response`-free counterpart to `project-path.ts`'s
 * `resolveProjectPath` — same validate-then-join logic, but returns `null`
 * instead of a 400 `Response` on invalid/missing input, so it can be used
 * from non-HTTP callers (the native transport).
 *
 * @param projectId - The candidate project identifier to validate.
 * @returns The resolved on-disk project directory, or `null` when
 *   `projectId` is not a well-formed UUID.
 */
export const resolveRevisionProjectRoot = resolveProjectRoot;

// ---------------------------------------------------------------------------
// Private helpers (lifted verbatim from the route)
// ---------------------------------------------------------------------------

async function findRevisionById(
  projectPath: string,
  resourceId: string,
  revisionId: string,
): Promise<Revision> {
  const revisions = await listRevisions(projectPath, resourceId);
  const match = revisions.find((r) => r.id === revisionId);
  if (!match) throw new Error(`Revision ${revisionId} not found.`);
  return match;
}

async function readRevisionContent(
  projectPath: string,
  resourceId: string,
  versionNumber: number,
): Promise<string> {
  const contentPath = path.join(
    revisionDir(projectPath, resourceId, versionNumber),
    "content.bin",
  );
  return readFile(contentPath, "utf8");
}

async function writeRevisionContent(
  projectPath: string,
  resourceId: string,
  versionNumber: number,
  content: string,
): Promise<void> {
  const contentPath = path.join(
    revisionDir(projectPath, resourceId, versionNumber),
    "content.bin",
  );
  await writeFile(contentPath, content, "utf8");
}

/**
 * Best-effort sync of a resource's derived content files from a canonical
 * revision's serialized TipTap content.
 *
 * Compile, export, and the search index read `resources/<id>/content.txt` and
 * `content.tiptap.json` — not the revision's `content.bin`. Rewriting them here
 * keeps them from drifting behind the canonical revision, so newly typed text
 * reaches a compile without first remounting the editor (which previously was
 * the only thing that re-synced these files).
 *
 * Silently no-ops when the content is not a TipTap document (e.g. a legacy
 * plain-text revision); the revision write remains the source of truth then.
 */
async function syncDerivedResourceContent(
  projectPath: string,
  resourceId: string,
  content: string,
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { type?: unknown }).type !== "doc"
  ) {
    return;
  }

  await persistResourceContent(
    projectPath,
    resourceId,
    parsed as TipTapDocument,
  );
}

/**
 * Reads the current saved content for a resource from the filesystem.
 *
 * Checks for `content.tiptap.json` first, then falls back to `content.txt`.
 * Returns the raw file contents as a string, or throws if neither file exists.
 */
async function readCurrentResourceContent(
  projectPath: string,
  resourceId: string,
): Promise<string> {
  const resourceDir = path.join(projectPath, "resources", resourceId);

  const tiptapPath = path.join(resourceDir, "content.tiptap.json");
  try {
    return await readFile(tiptapPath, "utf8");
  } catch {
    // Fall through to plaintext
  }

  const plaintextPath = path.join(resourceDir, "content.txt");
  try {
    return await readFile(plaintextPath, "utf8");
  } catch {
    throw new Error(
      `No readable content file found for resource ${resourceId}.`,
    );
  }
}

/**
 * Derives the next sequential version number for a resource.
 *
 * Returns 1 when no prior revisions exist, otherwise increments the
 * highest existing version number by 1.
 */
async function resolveNextVersionNumber(
  projectPath: string,
  resourceId: string,
): Promise<number> {
  const existing = await listRevisions(projectPath, resourceId);
  if (existing.length === 0) return 1;
  const highest = Math.max(...existing.map((r) => r.versionNumber));
  return highest + 1;
}

// ---------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------

/**
 * Reads a specific revision's metadata and content.
 *
 * @throws {Error} `Revision ${revisionId} not found.` when no matching
 *   revision exists.
 */
export async function readRevision(
  projectRoot: string,
  resourceId: string,
  revisionId: string,
): Promise<{ revision: Revision; content: string }> {
  const revision = await findRevisionById(projectRoot, resourceId, revisionId);
  const content = await readRevisionContent(
    projectRoot,
    resourceId,
    revision.versionNumber,
  );
  return { revision, content };
}

/**
 * Creates a new revision, reading current filesystem content when
 * `opts.content` is omitted, and optionally flips it canonical.
 */
export async function createRevision(
  projectRoot: string,
  resourceId: string,
  opts: CreateRevisionOptions,
): Promise<Revision> {
  const content =
    opts.content ?? (await readCurrentResourceContent(projectRoot, resourceId));

  const versionNumber = await resolveNextVersionNumber(projectRoot, resourceId);

  const revision = await writeRevision(
    projectRoot,
    resourceId,
    versionNumber,
    content,
    {
      author: opts.author,
      isCanonical: opts.isCanonical ?? false,
      metadata: opts.metadata,
    },
  );

  if (opts.isCanonical) {
    await setCanonicalRevisionByVersion(projectRoot, resourceId, versionNumber);
  }

  return revision;
}

/**
 * Updates the canonical revision's content in place, syncing derived
 * resource content files and bumping the resource sidecar's `updatedAt`.
 *
 * @throws {Error} `Revision ${revisionId} not found.` when no matching
 *   revision exists.
 * @throws {Error} `"Only the canonical revision can be updated in place."`
 *   when the target revision is not canonical.
 */
export async function updateRevisionInPlace(
  projectRoot: string,
  resourceId: string,
  revisionId: string,
  content: string,
): Promise<Revision & { updatedAt: string }> {
  const revisions = await listRevisions(projectRoot, resourceId);
  const target = revisions.find((revision) => revision.id === revisionId);

  if (!target) {
    throw new Error(`Revision ${revisionId} not found.`);
  }

  if (!target.isCanonical) {
    throw new Error("Only the canonical revision can be updated in place.");
  }

  await writeRevisionContent(
    projectRoot,
    resourceId,
    target.versionNumber,
    content,
  );

  // Keep the derived content files (read by compile/export/search) in sync
  // with the canonical revision so they cannot drift behind the editor.
  await syncDerivedResourceContent(projectRoot, resourceId, content);

  const updatedAt = new Date().toISOString();
  const existingSidecar = await readSidecar(projectRoot, resourceId);
  await writeSidecar(projectRoot, resourceId, {
    ...(existingSidecar ?? {}),
    updatedAt,
  });

  return { ...target, updatedAt };
}

/**
 * Marks the given revision as canonical (unmarking every other revision for
 * the resource).
 *
 * @throws {Error} `Revision ${revisionId} not found.` when no matching
 *   revision exists.
 */
export async function setCanonicalRevision(
  projectRoot: string,
  resourceId: string,
  revisionId: string,
): Promise<Revision> {
  const revisions = await listRevisions(projectRoot, resourceId);
  const target = revisions.find((revision) => revision.id === revisionId);

  if (!target) {
    throw new Error(`Revision ${revisionId} not found.`);
  }

  const canonicalRevision = await setCanonicalRevisionByVersion(
    projectRoot,
    resourceId,
    target.versionNumber,
  );

  if (!canonicalRevision) {
    throw new Error(`Revision ${revisionId} not found.`);
  }

  return canonicalRevision;
}

/**
 * Deletes a non-canonical revision.
 *
 * @throws {Error} `Revision ${revisionId} not found.` when no matching
 *   revision exists.
 * @throws {Error} `"Cannot delete the canonical revision; promote another
 *   revision first."` when the target revision is canonical.
 */
export async function deleteRevision(
  projectRoot: string,
  resourceId: string,
  revisionId: string,
): Promise<Revision> {
  const revisions = await listRevisions(projectRoot, resourceId);
  const target = revisions.find((r) => r.id === revisionId);

  if (!target) {
    throw new Error(`Revision ${revisionId} not found.`);
  }

  if (target.isCanonical) {
    throw new Error(
      "Cannot delete the canonical revision; promote another revision first.",
    );
  }

  const directory = revisionDir(projectRoot, resourceId, target.versionNumber);
  await rm(directory, { recursive: true, force: true });

  return target;
}
