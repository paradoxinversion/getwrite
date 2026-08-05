// Last Updated: 2026-07-24

/**
 * @module lib/search/execute-search
 *
 * Transport-agnostic full-text search core, extracted from the App Router
 * search route so it can be driven by *any* caller — the HTTP route handler
 * (hosted/desktop) and, per ADR-021, an in-process transport backend on a
 * native (Capacitor) build with no server.
 *
 * This module knows nothing about HTTP: no `NextRequest`/`NextResponse`, no
 * status codes. It operates purely over a project root and the ambient
 * `StorageContext` adapter (`io.ts`), which is exactly why it is reusable in
 * process. The route file re-exports {@link executeSearch} and
 * {@link findProjectRoot} for backward compatibility with existing callers and
 * tests.
 */
import type { Dirent } from "node:fs";
import path from "node:path";
import { readFile, readdir } from "../models/io";
import { search, tokenize } from "../models/inverted-index";
import { computeProximityScore } from "../models/search-scoring";
import { readSidecar } from "../models/sidecar";
import type { MetadataValue, Project } from "../models/types";
import { getCanonicalRevision, revisionDir } from "../models/revision";
import { extractSnippet } from "../models/search-snippet";
import { tiptapToPlainText } from "../tiptap-utils";

const SNIPPET_MAX_LEN = 160;
// Maximum candidates scored for proximity before applying filters + limit.
// Caps content loading for very broad multi-term queries on large projects.
const PROXIMITY_CANDIDATE_LIMIT = 200;

export interface SearchResult {
  resourceId: string;
  title: string;
  snippet: string;
  status: string | null;
  folderId: string | null;
  tags: string[];
}

export interface SearchFilters {
  folder?: string;
  status?: string;
  tags?: string[];
}

type SidecarData = Awaited<ReturnType<typeof readSidecar>>;

interface ScoredCandidate {
  id: string;
  text: string | null;
  sidecar: SidecarData;
  proxScore: number;
  rank: number;
}

/**
 * Locates a project's on-disk root by scanning `projectsDir` for a `project.json`
 * whose `id` matches. Runs against the ambient storage adapter, so it works
 * identically over the filesystem, object store, or Capacitor filesystem.
 */
export async function findProjectRoot(
  projectsDir: string,
  projectId: string,
): Promise<string | null> {
  let entries: Dirent[];
  try {
    entries = (await readdir(projectsDir, { withFileTypes: true })) as Dirent[];
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(projectsDir, entry.name);
    try {
      const raw = await readFile(path.join(candidate, "project.json"), "utf8");
      const parsed = JSON.parse(raw) as { id?: string };
      if (parsed?.id === projectId) return candidate;
    } catch {
      // skip unreadable or non-project directories
    }
  }

  return null;
}

async function loadCanonicalText(
  projectRoot: string,
  resourceId: string,
): Promise<string> {
  const canonical = await getCanonicalRevision(projectRoot, resourceId);
  if (!canonical) return "";

  const contentPath = path.join(
    revisionDir(projectRoot, resourceId, canonical.versionNumber),
    "content.bin",
  );

  let text: string;
  try {
    text = await readFile(contentPath, "utf8");
  } catch (error) {
    // A missing revision is ordinary — a stub resource has no canonical text —
    // and yields "" so search simply finds nothing in it.
    //
    // A file that exists but cannot be *decrypted* is not ordinary, and must
    // not be flattened into the same answer. Reporting an encrypted resource as
    // empty hides real content from search and, worse, invites an editor to
    // open an empty document over a real file and autosave it back (FR15).
    if (isMissingFileError(error)) return "";
    throw error;
  }

  if (text.trimStart().startsWith("{")) {
    try {
      text = tiptapToPlainText(JSON.parse(text));
    } catch {
      // fall through — treat the raw string as plain text
    }
  }

  return text;
}

/**
 * Whether a thrown value means "this file is not there".
 *
 * Anything else — notably an integrity or format failure from the encrypting
 * adapter — is a real error and must propagate.
 *
 * @param error - The thrown value.
 * @returns `true` for a missing-file error.
 */
function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

async function loadTagAssignments(
  projectRoot: string,
): Promise<Record<string, string[]>> {
  // Load tag assignments from project.json (tags live in project config, not sidecars).
  try {
    const raw = await readFile(path.join(projectRoot, "project.json"), "utf8");
    const project = JSON.parse(raw) as Project;
    return project.config?.tagAssignments ?? {};
  } catch {
    // proceed without tag data
    return {};
  }
}

// For multi-term queries, preload canonical text and sidecar for all
// candidates (up to PROXIMITY_CANDIDATE_LIMIT), then re-rank by how
// closely the query terms appear together. The title is included in the
// proximity text so that a resource named "Dragon Knight" scores as a
// tight phrase match even when the body is sparse. Within equal proximity
// scores the original term-freq rank is preserved as a tiebreaker.
async function scoreMultiTermCandidates(
  projectRoot: string,
  rankedIds: string[],
  terms: string[],
): Promise<ScoredCandidate[]> {
  const cap = Math.min(rankedIds.length, PROXIMITY_CANDIDATE_LIMIT);
  const candidates: ScoredCandidate[] = [];
  for (let i = 0; i < cap; i++) {
    const id = rankedIds[i]!;
    const [text, sidecar] = await Promise.all([
      loadCanonicalText(projectRoot, id),
      readSidecar(projectRoot, id),
    ]);
    const title = typeof sidecar?.name === "string" ? sidecar.name : "";
    const textForProximity = title ? `${title}\n${text}` : text;
    candidates.push({
      id,
      text,
      sidecar,
      proxScore: computeProximityScore(textForProximity, terms),
      rank: i,
    });
  }
  candidates.sort((a, b) =>
    b.proxScore !== a.proxScore ? b.proxScore - a.proxScore : a.rank - b.rank,
  );
  return candidates;
}

/**
 * Core full-text search over one project's indexed resources. Returns results
 * ordered by proximity score (multi-term) or term frequency (single-term),
 * after applying folder/status/tag filters and a result limit.
 */
export async function executeSearch(
  projectRoot: string,
  query: string,
  filters: SearchFilters,
  limit: number,
): Promise<SearchResult[]> {
  const tagAssignments = await loadTagAssignments(projectRoot);

  const terms = tokenize(query);
  const rankedIds = await search(projectRoot, query);

  const candidates: ScoredCandidate[] =
    terms.length > 1
      ? await scoreMultiTermCandidates(projectRoot, rankedIds, terms)
      : rankedIds.map((id, rank) => ({
          id,
          text: null,
          sidecar: null,
          proxScore: 0,
          rank,
        }));

  const results: SearchResult[] = [];

  for (const candidate of candidates) {
    if (results.length >= limit) break;

    const sidecar =
      candidate.sidecar ?? (await readSidecar(projectRoot, candidate.id));

    const title =
      typeof sidecar?.name === "string" ? sidecar.name : candidate.id;
    const userMetadata = sidecar?.userMetadata as
      | Record<string, MetadataValue>
      | undefined;
    const status =
      typeof userMetadata?.status === "string" ? userMetadata.status : null;
    const folderId =
      typeof sidecar?.folderId === "string" ? sidecar.folderId : null;
    const resourceTags: string[] = tagAssignments[candidate.id] ?? [];

    // Apply filters — all active filters must match.
    if (filters.folder !== undefined && folderId !== filters.folder) continue;
    if (filters.status !== undefined && status !== filters.status) continue;
    if (
      filters.tags !== undefined &&
      filters.tags.length > 0 &&
      !filters.tags.some((t) => resourceTags.includes(t))
    )
      continue;

    // Reuse preloaded text for multi-term queries; load on demand for single-term.
    const text =
      candidate.text ?? (await loadCanonicalText(projectRoot, candidate.id));
    const snippet = extractSnippet(text, query, SNIPPET_MAX_LEN);

    results.push({
      resourceId: candidate.id,
      title,
      snippet,
      status,
      folderId,
      tags: resourceTags,
    });
  }

  return results;
}
