import path from "node:path";
import { mkdir, readFile, writeFile } from "./io";
import { withMetaLock } from "./meta-locks";
import type { TextResource } from "./types";
import { tiptapToPlainText, loadResourceContent } from "../tiptap-utils";

export type InvertedIndex = Record<string, Record<string, number>>;

const INDEX_DIR = "meta/index";
const INDEX_FILE = "inverted.json";

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

async function ensureIndexDir(projectRoot: string) {
    await mkdir(path.join(projectRoot, INDEX_DIR), { recursive: true });
}

async function loadIndex(projectRoot: string): Promise<InvertedIndex> {
    const p = path.join(projectRoot, INDEX_DIR, INDEX_FILE);
    try {
        const raw = await readFile(p, "utf8");
        return JSON.parse(raw) as InvertedIndex;
    } catch (_) {
        return {};
    }
}

async function saveIndex(projectRoot: string, index: InvertedIndex) {
    await ensureIndexDir(projectRoot);
    const p = path.join(projectRoot, INDEX_DIR, INDEX_FILE);
    await withMetaLock(projectRoot, async () => {
        await writeFile(p, JSON.stringify(index, null, 2), "utf8");
    });
}

/** Remove any existing occurrences of resourceId from the index (helper). */
function removeFromIndexObj(index: InvertedIndex, resourceId: string) {
    for (const term of Object.keys(index)) {
        const posting = index[term];
        if (posting[resourceId] !== undefined) {
            delete posting[resourceId];
            if (Object.keys(posting).length === 0) delete index[term];
        }
    }
}

/** Index a resource's plain text into the project's inverted index. */
export async function indexResource(projectRoot: string, res: TextResource) {
    const index = await loadIndex(projectRoot);

    // Remove previous entries for resource
    removeFromIndexObj(index, res.id);

    // Determine text: prefer resource.plainText, else tiptap, else load persisted
    let text = res.plainText ?? "";
    if (!text && res.tiptap) text = tiptapToPlainText(res.tiptap as any);
    if (!text) {
        try {
            const loaded = await loadResourceContent(projectRoot, res.id);
            text = loaded.plainText ?? "";
            if (!text && loaded.tiptap)
                text = tiptapToPlainText(loaded.tiptap as any);
        } catch (_) {
            text = "";
        }
    }

    if (!text) {
        await saveIndex(projectRoot, index);
        return;
    }

    const terms = tokenize(text);
    const counts: Record<string, number> = {};
    for (const t of terms) counts[t] = (counts[t] ?? 0) + 1;

    for (const [t, c] of Object.entries(counts)) {
        index[t] = index[t] ?? {};
        index[t][res.id] = (index[t][res.id] ?? 0) + c;
    }

    await saveIndex(projectRoot, index);
}

/** Remove a resource from the index fully. */
export async function removeResourceFromIndex(
    projectRoot: string,
    resourceId: string,
) {
    const index = await loadIndex(projectRoot);
    removeFromIndexObj(index, resourceId);
    await saveIndex(projectRoot, index);
}

/**
 * Search the inverted index for a query string and return ranked resource ids.
 * Simple ranking: sum of term frequencies for query terms.
 */
export async function search(
    projectRoot: string,
    query: string,
): Promise<string[]> {
    const index = await loadIndex(projectRoot);
    const terms = tokenize(query);
    const scores: Record<string, number> = {};
    const perTermFreq: Record<string, Record<string, number>> = {};

    for (const t of terms) {
        const posting = index[t];
        perTermFreq[t] = {};
        if (!posting) continue;
        for (const [rid, freq] of Object.entries(posting)) {
            scores[rid] = (scores[rid] ?? 0) + freq;
            perTermFreq[t][rid] = freq;
        }
    }

    const firstTerm = terms[0];
    return Object.entries(scores)
        .sort((a, b) => {
            const scoreA = a[1];
            const scoreB = b[1];
            if (scoreB !== scoreA) return scoreB - scoreA;
            // tie-break: prefer higher frequency for first query term
            if (firstTerm) {
                const fa = perTermFreq[firstTerm][a[0]] ?? 0;
                const fb = perTermFreq[firstTerm][b[0]] ?? 0;
                if (fb !== fa) return fb - fa;
            }
            // final deterministic tie-break: lexicographic id
            return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
        })
        .map((e) => e[0]);
}

export default { indexResource, removeResourceFromIndex, search };
