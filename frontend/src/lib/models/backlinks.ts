import path from "node:path";
import type { Dirent } from "node:fs";
import { readFile, atomicWriteFile, readdir, mkdir } from "./io";
import { withMetaLock } from "./meta-locks";
import { loadResourceContent } from "../tiptap-utils";
import { readSidecar } from "./sidecar";
import type { ResourceRef, MetadataValue } from "./types";
import { slugify } from "../utils";

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Type guard for a single `ResourceRef` value shape `{ id: string|null, name: string }`.
 * Detects resource-ref sidecar values structurally without consulting the metadata schema.
 */
function isResourceRef(value: unknown): value is ResourceRef {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const v = value as Record<string, unknown>;
  return (
    "id" in v &&
    "name" in v &&
    (typeof v.id === "string" || v.id === null) &&
    typeof v.name === "string"
  );
}

/**
 * Scans one set of sidecar field values for `resource-ref` /
 * `multi-resource-ref` shapes, adding any referenced ids into `ids`.
 */
function collectRefIds(
  values: Iterable<MetadataValue>,
  ids: Set<string>,
): void {
  for (const value of values) {
    if (isResourceRef(value)) {
      if (value.id !== null) ids.add(value.id);
    } else if (Array.isArray(value)) {
      for (const elem of value) {
        if (isResourceRef(elem) && elem.id !== null) ids.add(elem.id);
      }
    }
  }
}

/**
 * Returns all non-null, non-self resource UUIDs referenced by `resource-ref`
 * and `multi-resource-ref` sidecar field values.
 *
 * Detection is structural: any sidecar value matching `{ id, name }` or an
 * array of such values is treated as a resource reference. The schema is not
 * consulted so this works even for undeclared fields.
 *
 * User-defined metadata fields are stored one level down, under
 * `sidecar.userMetadata` (see `flattenUserMetadata` in `field-values.ts` for
 * the equivalent one-level merge used elsewhere), so that nested object is
 * scanned as well as the sidecar's top level. No other nested path is
 * descended into.
 */
function extractSidecarRefIds(
  sidecar: Record<string, MetadataValue>,
): string[] {
  const ids = new Set<string>();
  collectRefIds(Object.values(sidecar), ids);

  const userMetadata = sidecar.userMetadata;
  if (
    userMetadata &&
    typeof userMetadata === "object" &&
    !Array.isArray(userMetadata)
  ) {
    collectRefIds(
      Object.values(userMetadata as Record<string, MetadataValue>),
      ids,
    );
  }

  return Array.from(ids);
}

export type BacklinkIndex = Record<string, string[]>;

/** List resource ids present under projectRoot/resources/ */
export async function listResourceIds(projectRoot: string): Promise<string[]> {
  const base = path.join(projectRoot, "resources");
  try {
    const entries = await readdir(base, { withFileTypes: true });
    return (entries as Dirent[])
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Read optional redirects map from meta/redirects.json */
async function loadRedirects(
  projectRoot: string,
): Promise<Record<string, string>> {
  const p = path.join(projectRoot, "meta", "redirects.json");
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

type ResolverMaps = {
  slugToId: Record<string, string>;
  nameToId: Record<string, string>;
  aliasesToId: Record<string, string>;
};

/** Build resolver maps from resource sidecars: slug -> id, nameLower -> id, aliases -> id */
async function buildResolverMaps(
  projectRoot: string,
  ids: string[],
): Promise<ResolverMaps> {
  const slugToId: Record<string, string> = {};
  const nameToId: Record<string, string> = {};
  const aliasesToId: Record<string, string> = {};

  for (const id of ids) {
    try {
      const side = await readSidecar(projectRoot, id);
      if (!side) continue;
      const name = side["name"];
      const slug = side["slug"] ?? (name ? slugify(String(name)) : undefined);
      const aliases = side["aliases"];

      if (slug) slugToId[String(slug).toLowerCase()] = id;
      if (name) nameToId[String(name).toLowerCase()] = id;
      if (Array.isArray(aliases)) {
        for (const a of aliases) aliasesToId[String(a).toLowerCase()] = id;
      }
    } catch {
      // ignore sidecar read errors per-resource
    }
  }

  return { slugToId, nameToId, aliasesToId };
}

/** Resolve a wiki/link target to a resource id using redirects and resolver maps. */
function resolveTarget(
  target: string,
  redirects: Record<string, string>,
  maps: ResolverMaps,
): string | null {
  const t = target.trim();
  // If target looks like a UUID, return it directly
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t,
    )
  )
    return t;

  const low = t.toLowerCase();
  // redirects take precedence
  if (redirects[low]) return redirects[low];

  // exact slug
  if (maps.slugToId[low]) return maps.slugToId[low];

  // exact name
  if (maps.nameToId[low]) return maps.nameToId[low];

  // aliases
  if (maps.aliasesToId[low]) return maps.aliasesToId[low];

  // slugify fallback
  const s = slugify(t);
  if (s && maps.slugToId[s]) return maps.slugToId[s];

  return null;
}

/** Compute backlinks mapping resourceId -> referencedResourceIds by scanning content.
 *
 * Detection strategy (in order):
 * - UUIDs embedded in text (primary, exact)
 * - Wiki-style links `[[Title]]` resolved via redirects, slug, or name
 * - Slug/title fallback using sidecar-derived slug/name/aliases
 */
export async function computeBacklinks(
  projectRoot: string,
): Promise<BacklinkIndex> {
  const ids = await listResourceIds(projectRoot);
  const index: BacklinkIndex = {};
  const redirects = await loadRedirects(projectRoot);
  const maps = await buildResolverMaps(projectRoot, ids);

  for (const id of ids) {
    const loaded = await loadResourceContent(projectRoot, id);
    const text = loaded.plainText ?? "";
    const refs = new Set<string>();

    // UUID matches
    let m: RegExpExecArray | null;
    while ((m = UUID_REGEX.exec(text))) {
      const found = m[0];
      if (found !== id) refs.add(found);
    }

    // Wiki-style links [[...]]
    while ((m = WIKI_LINK_REGEX.exec(text))) {
      const inner = m[1];
      // allow `Title|alias` or `id` inside wiki link; take left side before pipe
      const primary = inner.split("|")[0].trim();
      const resolved = resolveTarget(primary, redirects, maps);
      if (resolved && resolved !== id) refs.add(resolved);
    }

    // resource-ref and multi-resource-ref sidecar values
    const sidecar = await readSidecar(projectRoot, id);
    if (sidecar) {
      for (const refId of extractSidecarRefIds(sidecar)) {
        if (refId !== id) refs.add(refId);
      }
    }

    index[id] = Array.from(refs);
  }

  return index;
}

/** Persist backlink index under `meta/backlinks.json`. */
export async function persistBacklinks(
  projectRoot: string,
  index: BacklinkIndex,
): Promise<void> {
  const metaDir = path.join(projectRoot, "meta");
  try {
    await mkdir(metaDir, { recursive: true });
  } catch {
    // ignore
  }
  const out = path.join(metaDir, "backlinks.json");
  await withMetaLock(projectRoot, async () => {
    await atomicWriteFile(out, JSON.stringify(index, null, 2), {
      writeOptions: "utf8",
      durable: process.env.GETWRITE_DURABLE_META === "1",
    });
  });
}

/** Load persisted backlinks if present. */
export async function loadBacklinks(
  projectRoot: string,
): Promise<BacklinkIndex> {
  const p = path.join(projectRoot, "meta", "backlinks.json");
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as BacklinkIndex;
  } catch {
    return {};
  }
}

const backlinks = {
  listResourceIds,
  computeBacklinks,
  persistBacklinks,
  loadBacklinks,
};
export default backlinks;
