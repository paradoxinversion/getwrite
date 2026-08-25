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
 */
import { loadResourceContent } from "../tiptap-utils";
import { loadMentionIndex, invertMentionIndex } from "./mention-index";
import { readSidecar } from "./sidecar";

/** A single entity mentioned in a resource (FR-9). */
export type ResourceMention = { entityId: string; name: string };

/** A single occurrence-annotated resource mentioning an entity (FR-10). */
export type EntityMentionedIn = {
  resourceId: string;
  name: string;
  snippets: string[];
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
 * Returns every resource mentioning `entityId` (FR-10), one snippet per
 * occurrence, resolving each resource's display name from its sidecar.
 *
 * Snippets are built by loading the resource's canonical persisted plain
 * text (the same source `indexer-queue` reads for detection, via
 * `loadResourceContent`) and slicing it around each stored offset. A
 * resource whose content can no longer be loaded (e.g. deleted after
 * indexing but before the mention index was rebuilt) is skipped rather than
 * throwing.
 *
 * Returns an empty array when the entity has no mention records.
 */
export async function getEntityMentionedIn(
  projectRoot: string,
  entityId: string,
): Promise<EntityMentionedIn[]> {
  const index = await loadMentionIndex(projectRoot);
  const byEntity = invertMentionIndex(index);
  const records = byEntity[entityId] ?? [];

  const results: EntityMentionedIn[] = [];
  for (const record of records) {
    let plainText: string | undefined;
    try {
      const loaded = await loadResourceContent(projectRoot, record.resourceId);
      plainText = loaded.plainText;
    } catch {
      // Resource content unreadable (e.g. deleted); skip this record.
      continue;
    }
    if (plainText === undefined) continue;

    const name = await resolveName(projectRoot, record.resourceId);
    const snippets = record.offsets.map((offset) =>
      snippetAtOffset(plainText, offset),
    );
    results.push({ resourceId: record.resourceId, name, snippets });
  }
  return results;
}

const mentionsCore = { getResourceMentions, getEntityMentionedIn };
export default mentionsCore;
