/**
 * @module mentions-core
 *
 * Transport-agnostic reads over the mention index (see `mention-index.ts`,
 * Task 4). Two directions are exposed, matching FR-9 and FR-10 of
 * `specs/features/entity-layer.md`:
 *
 * - {@link getResourceMentions} — "which entities does this resource
 *   mention" (FR-9), read via the index's native `resourceId` key.
 * - {@link getEntityMentionedIn} — "which resources mention this entity,
 *   with a snippet per occurrence" (FR-10), read via
 *   {@link invertMentionIndex}.
 *
 * Both are pure reads: neither writes to the mention index nor triggers
 * (re)detection. Detection itself is the indexer-queue's responsibility
 * (FR-7/FR-8), not this module's.
 *
 * **Task 15 addition — merging in explicit links (FR-12) and ambiguity
 * (FR-14).** `getEntityMentionedIn` is the one place an entity's detected
 * mentions and its explicit `linkedFrom` backlinks need to appear together
 * as a single list (FR-12: "wherever this list and the entity's explicit
 * backlinks appear together..."), so rather than add a second route/
 * transport/native-backend pair (a full ADR-021 plumbing set) purely to
 * fetch `linkedFrom` for one resource, this function now reads the already-
 * persisted `backlinks.json` (`loadBacklinks`, degrades to `{}` when
 * missing, same as the mention index) and merges explicit linkers into the
 * same result set, keyed by `resourceId` so a resource that is both linked
 * and mentioned appears exactly once with both flags set. This keeps the
 * existing route/transport/native-backend untouched — no new plumbing layer
 * — while satisfying FR-12's merge requirement at the one call site that
 * needs it.
 *
 * Ambiguity (FR-14) is likewise derived here rather than exposed via a new
 * client-facing read of `entity-alias-table.ts`'s `claimedBy` map:
 * `indexer-queue.ts` already records a mention against *every* claiming
 * entity when an alias is ambiguous, and it does so by re-running
 * `findMentionOffsets` per entity — so an ambiguous occurrence surfaces as
 * two (or more) `MentionRecord`s for the *same* `resourceId` and the *same*
 * character offset, one per claiming `entityId`. `resolveAmbiguousWith`
 * below detects this directly from the already-loaded `MentionIndex` by
 * checking, for each of our entity's occurrence offsets, whether any other
 * entity's record for that resource also claims that exact offset. No new
 * index, field, or route is needed for this — the ambiguity is already
 * latent in the persisted mention data once two entities share a term.
 */
import { loadResourceContent } from "../tiptap-utils";
import {
  loadMentionIndex,
  invertMentionIndex,
  type MentionIndex,
  type MentionRecord,
} from "./mention-index";
import { loadBacklinks } from "./backlinks";
import { readSidecar } from "./sidecar";

/** A single entity mentioned in a resource (FR-9). */
export type ResourceMention = { entityId: string; name: string };

/**
 * A single resource associated with an entity, either by an explicit link
 * (`isLinked`, FR-12) or a detected prose mention (`isMentioned`, FR-10), or
 * both. A resource that is both linked and mentioned appears once with both
 * flags set — never as two rows.
 *
 * `snippets` and `ambiguousWith` are only populated for mentioned
 * occurrences (empty arrays for a linked-only row, since a plain explicit
 * link carries no occurrence offsets to snippet). `ambiguousWith` is
 * parallel to `snippets`: `ambiguousWith[i]` names every other entity whose
 * own mention record also claims `snippets[i]`'s occurrence (FR-14) — empty
 * when that occurrence is unambiguous.
 */
export type EntityMentionedIn = {
  resourceId: string;
  name: string;
  snippets: string[];
  isLinked: boolean;
  isMentioned: boolean;
  ambiguousWith: string[][];
};

const SNIPPET_MAX_LEN = 160;

/**
 * Resolves a resource or entity's display name from its sidecar's `name`
 * field, falling back to the id itself when the sidecar is missing or has
 * no `name` (e.g. deleted between indexing and read).
 */
async function resolveName(projectRoot: string, id: string): Promise<string> {
  const sidecar = await readSidecar(projectRoot, id);
  const name = sidecar?.["name"];
  return typeof name === "string" && name.length > 0 ? name : id;
}

/**
 * Extracts a fixed-width snippet of `text` centered on a known character
 * offset.
 *
 * This is a small offset-based sibling of `search-snippet.ts`'s
 * `extractSnippet`, not a reuse of it. `extractSnippet` takes a query
 * *string* and re-searches `text` for its first occurrence — appropriate
 * when the caller only has a term, not a position. Here the mention index
 * already carries the exact character offset of each occurrence (FR-6), so
 * re-searching would be redundant work that can additionally center the
 * wrong occurrence whenever an alias appears more than once in a resource
 * (the leftmost match `extractSnippet` finds is not necessarily the one at
 * this offset). Centering directly on the stored offset is the correct
 * disambiguation and the entire reason FR-6 stores offsets in the first
 * place, so this small helper mirrors `extractSnippet`'s windowing math
 * instead of calling through it.
 */
function snippetAtOffset(
  text: string,
  offset: number,
  maxLen: number = SNIPPET_MAX_LEN,
): string {
  if (!text) return "";
  let start = Math.max(0, offset - Math.floor(maxLen / 2));
  const end = Math.min(text.length, start + maxLen);
  if (end - start < maxLen) {
    start = Math.max(0, end - maxLen);
  }
  return text.slice(start, end);
}

/**
 * Returns every entity detected as mentioned within `resourceId` (FR-9),
 * resolving each entity's display name from its sidecar.
 *
 * Returns an empty array when the resource has no mention records, or when
 * the mention index has never been built for this project.
 */
export async function getResourceMentions(
  projectRoot: string,
  resourceId: string,
): Promise<ResourceMention[]> {
  const index = await loadMentionIndex(projectRoot);
  const records = index[resourceId] ?? [];

  const seen = new Set<string>();
  const mentions: ResourceMention[] = [];
  for (const record of records) {
    if (seen.has(record.entityId)) continue;
    seen.add(record.entityId);
    const name = await resolveName(projectRoot, record.entityId);
    mentions.push({ entityId: record.entityId, name });
  }
  return mentions;
}

/**
 * For each of `offsets` (one entity's occurrence offsets within
 * `resourceId`), finds every *other* entity whose own mention record for
 * the same resource also claims that exact offset (FR-14) and resolves
 * their display names.
 *
 * Returns a parallel array to `offsets`: `result[i]` is the (possibly
 * empty) list of other entity names claiming `offsets[i]`.
 */
async function resolveAmbiguousWith(
  projectRoot: string,
  index: MentionIndex,
  resourceId: string,
  entityId: string,
  offsets: number[],
): Promise<string[][]> {
  const otherRecords = (index[resourceId] ?? []).filter(
    (record) => record.entityId !== entityId,
  );
  if (otherRecords.length === 0) return offsets.map(() => []);

  const nameCache = new Map<string, string>();
  const resolveCached = async (id: string): Promise<string> => {
    const cached = nameCache.get(id);
    if (cached !== undefined) return cached;
    const name = await resolveName(projectRoot, id);
    nameCache.set(id, name);
    return name;
  };

  const result: string[][] = [];
  for (const offset of offsets) {
    const claimants = otherRecords.filter((record) =>
      record.offsets.includes(offset),
    );
    const names: string[] = [];
    for (const claimant of claimants) {
      names.push(await resolveCached(claimant.entityId));
    }
    result.push(names);
  }
  return result;
}

/**
 * Builds the mentioned-occurrence half of one `EntityMentionedIn` row from a
 * single `MentionRecord`, or `null` when the resource's content can no
 * longer be loaded (e.g. deleted after indexing but before the mention
 * index was rebuilt) — such a record is skipped rather than surfaced with
 * empty snippets.
 */
async function buildMentionedRow(
  projectRoot: string,
  index: MentionIndex,
  record: MentionRecord,
): Promise<EntityMentionedIn | null> {
  let plainText: string | undefined;
  try {
    const loaded = await loadResourceContent(projectRoot, record.resourceId);
    plainText = loaded.plainText;
  } catch {
    return null;
  }
  if (plainText === undefined) return null;

  const name = await resolveName(projectRoot, record.resourceId);
  const snippets = record.offsets.map((offset) =>
    snippetAtOffset(plainText, offset),
  );
  const ambiguousWith = await resolveAmbiguousWith(
    projectRoot,
    index,
    record.resourceId,
    record.entityId,
    record.offsets,
  );

  return {
    resourceId: record.resourceId,
    name,
    snippets,
    isLinked: false,
    isMentioned: true,
    ambiguousWith,
  };
}

/**
 * Returns every resource associated with `entityId`, merging two sources
 * (FR-10, FR-12):
 *
 * - Detected prose mentions, one snippet per occurrence, resolved via the
 *   persisted mention index (FR-10).
 * - Explicit links, read from the persisted backlink index — any resource
 *   whose backlinks target `entityId` (the same relationship the
 *   `linkedFrom` query intrinsic exposes for query evaluation).
 *
 * A resource present in both sources is returned once, with both
 * `isLinked` and `isMentioned` set — never as two rows. A resource that is
 * mentioned but whose content can no longer be loaded (e.g. deleted after
 * indexing but before the mention index was rebuilt) is skipped for the
 * mention side; if it is also explicitly linked it still appears as a
 * link-only row (a stale backlink entry with a resolvable sidecar name).
 *
 * Returns an empty array when the entity has neither mentions nor explicit
 * links.
 */
export async function getEntityMentionedIn(
  projectRoot: string,
  entityId: string,
): Promise<EntityMentionedIn[]> {
  const index = await loadMentionIndex(projectRoot);
  const byEntity = invertMentionIndex(index);
  const records = byEntity[entityId] ?? [];

  let backlinks: Record<string, string[]> = {};
  try {
    backlinks = await loadBacklinks(projectRoot);
  } catch {
    backlinks = {};
  }
  const linkedResourceIds = new Set(
    Object.entries(backlinks)
      .filter(([, targets]) => targets.includes(entityId))
      .map(([sourceId]) => sourceId),
  );

  const results = new Map<string, EntityMentionedIn>();

  for (const record of records) {
    const row = await buildMentionedRow(projectRoot, index, record);
    if (row === null) continue;
    row.isLinked = linkedResourceIds.has(row.resourceId);
    results.set(row.resourceId, row);
    linkedResourceIds.delete(row.resourceId);
  }

  // Whatever remains in linkedResourceIds is linked but not (successfully)
  // mentioned above — an explicit-link-only row.
  for (const resourceId of linkedResourceIds) {
    const name = await resolveName(projectRoot, resourceId);
    results.set(resourceId, {
      resourceId,
      name,
      snippets: [],
      isLinked: true,
      isMentioned: false,
      ambiguousWith: [],
    });
  }

  return Array.from(results.values());
}

const mentionsCore = { getResourceMentions, getEntityMentionedIn };
export default mentionsCore;
