import path from "node:path";
import fs from "node:fs/promises";
import { readFile, writeFile, readdir, mkdir } from "./io";
import { loadResourceContent } from "../tiptap-utils";
import { readSidecar } from "./sidecar";
import type { UUID } from "./types";

const UUID_REGEX =
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

export type BacklinkIndex = Record<string, string[]>;

function slugify(s: string): string {
    return s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");
}

/** List resource ids present under projectRoot/resources/ */
export async function listResourceIds(projectRoot: string): Promise<string[]> {
    const base = path.join(projectRoot, "resources");
    try {
        const entries = await readdir(base, { withFileTypes: true });
        return entries
            .filter((e: any) => e.isDirectory())
            .map((d: any) => d.name);
    } catch (err) {
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
    } catch (_) {
        return {};
    }
}

/** Build resolver maps from resource sidecars: slug -> id, nameLower -> id, aliases -> id */
async function buildResolverMaps(projectRoot: string, ids: string[]) {
    const slugToId: Record<string, string> = {};
    const nameToId: Record<string, string> = {};
    const aliasesToId: Record<string, string> = {};

    for (const id of ids) {
        try {
            const side = await readSidecar(projectRoot, id);
            if (!side) continue;
            const name = (side as any).name;
            const slug =
                (side as any).slug ??
                (name ? slugify(String(name)) : undefined);
            const aliases = (side as any).aliases as string[] | undefined;

            if (slug) slugToId[String(slug).toLowerCase()] = id;
            if (name) nameToId[String(name).toLowerCase()] = id;
            if (Array.isArray(aliases)) {
                for (const a of aliases)
                    aliasesToId[String(a).toLowerCase()] = id;
            }
        } catch (err) {
            // ignore sidecar read errors per-resource
        }
    }

    return { slugToId, nameToId, aliasesToId };
}

/** Resolve a wiki/link target to a resource id using redirects and resolver maps. */
function resolveTarget(
    target: string,
    redirects: Record<string, string>,
    maps: ReturnType<typeof buildResolverMaps> extends Promise<infer R>
        ? R
        : any,
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
    if (maps.slugToId && maps.slugToId[low]) return maps.slugToId[low];

    // exact name
    if (maps.nameToId && maps.nameToId[low]) return maps.nameToId[low];

    // aliases
    if (maps.aliasesToId && maps.aliasesToId[low]) return maps.aliasesToId[low];

    // slugify fallback
    const s = slugify(t);
    if (s && maps.slugToId && maps.slugToId[s]) return maps.slugToId[s];

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
            const resolved = resolveTarget(primary, redirects, maps as any);
            if (resolved && resolved !== id) refs.add(resolved);
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
    } catch (_) {
        // ignore
    }
    const out = path.join(metaDir, "backlinks.json");
    await writeFile(out, JSON.stringify(index, null, 2), "utf8");
}

/** Load persisted backlinks if present. */
export async function loadBacklinks(
    projectRoot: string,
): Promise<BacklinkIndex> {
    const p = path.join(projectRoot, "meta", "backlinks.json");
    try {
        const raw = await readFile(p, "utf8");
        return JSON.parse(raw) as BacklinkIndex;
    } catch (_) {
        return {};
    }
}

export default {
    listResourceIds,
    computeBacklinks,
    persistBacklinks,
    loadBacklinks,
};
