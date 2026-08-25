import { listResourceIds } from "./backlinks";
import { readSidecar } from "./sidecar";

/**
 * One entity's matchable terms: its `name` plus any declared `aliases`,
 * exactly as stored in its sidecar (not normalized) so callers can still
 * render/compare original casing.
 */
export type EntityAliasEntry = {
  entityId: string;
  entityKind: string;
  name: string;
  aliases: string[];
  /** `name` + `aliases`, in that order, verbatim (not normalized). */
  terms: string[];
};

/**
 * Per-project alias table: every entity's matchable terms, plus a map of
 * every normalized term claimed by more than one entity (FR-14).
 *
 * `claimedBy` is keyed by the normalized term (lowercase, trimmed) and only
 * contains entries with two or more claiming entity ids — a term claimed by
 * exactly one entity is unambiguous and is omitted.
 */
export type EntityAliasTable = {
  entities: Record<string, EntityAliasEntry>;
  claimedBy: Record<string, string[]>;
};

/** Normalize a term for ambiguity comparison: lowercase, trimmed. */
function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

/**
 * Build a per-project alias table from every resource with `entityKind` set.
 *
 * Reuses `listResourceIds` (`./backlinks.ts`) to enumerate resources and
 * `readSidecar` (`./sidecar.ts`) to read each one's metadata, mirroring
 * `backlinks.ts`'s `buildResolverMaps` but scoped to declared entities only
 * (resources with `entityKind` set) and tracking every claimant of a term
 * rather than resolving to a single winner.
 */
export async function buildEntityAliasTable(
  projectRoot: string,
): Promise<EntityAliasTable> {
  const ids = await listResourceIds(projectRoot);
  const entities: Record<string, EntityAliasEntry> = {};
  const claimants: Record<string, Set<string>> = {};

  for (const id of ids) {
    let sidecar;
    try {
      sidecar = await readSidecar(projectRoot, id);
    } catch {
      // ignore sidecar read errors per-resource, consistent with
      // backlinks.ts's buildResolverMaps
      continue;
    }
    if (!sidecar) continue;

    const entityKind = sidecar["entityKind"];
    if (typeof entityKind !== "string" || entityKind.length === 0) continue;

    const name = typeof sidecar["name"] === "string" ? sidecar["name"] : "";
    const rawAliases = sidecar["aliases"];
    const aliases: string[] = Array.isArray(rawAliases)
      ? rawAliases.filter((a): a is string => typeof a === "string")
      : [];

    const terms = name ? [name, ...aliases] : [...aliases];

    entities[id] = { entityId: id, entityKind, name, aliases, terms };

    for (const term of terms) {
      const normalized = normalizeTerm(term);
      if (!normalized) continue;
      const bucket = claimants[normalized] ?? new Set<string>();
      bucket.add(id);
      claimants[normalized] = bucket;
    }
  }

  const claimedBy: Record<string, string[]> = {};
  for (const [normalized, entityIds] of Object.entries(claimants)) {
    if (entityIds.size > 1) {
      claimedBy[normalized] = Array.from(entityIds);
    }
  }

  return { entities, claimedBy };
}

const entityAliasTable = { buildEntityAliasTable };
export default entityAliasTable;
