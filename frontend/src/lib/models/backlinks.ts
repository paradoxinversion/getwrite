import path from "node:path";
import { readFile, writeFile, readdir, mkdir } from "./io";
import { loadResourceContent } from "../tiptap-utils";
import type { UUID } from "./types";

const UUID_REGEX =
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export type BacklinkIndex = Record<string, string[]>;

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

/** Compute backlinks mapping resourceId -> referencedResourceIds by scanning content. */
export async function computeBacklinks(
    projectRoot: string,
): Promise<BacklinkIndex> {
    const ids = await listResourceIds(projectRoot);
    const index: BacklinkIndex = {};

    for (const id of ids) {
        const loaded = await loadResourceContent(projectRoot, id);
        const text = loaded.plainText ?? "";
        const refs = new Set<string>();

        let m: RegExpExecArray | null;
        while ((m = UUID_REGEX.exec(text))) {
            const found = m[0];
            if (found !== id) refs.add(found);
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
