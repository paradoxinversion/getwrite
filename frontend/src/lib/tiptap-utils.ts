import { readFile, writeFile, mkdir } from "./models/io";

export type TipTapNode = {
    type: string;
    text?: string;
    content?: TipTapNode[];
};

export type TipTapDocument = {
    type: "doc";
    content: TipTapNode[];
};

function extractTextFromNode(node: TipTapNode): string {
    let out = "";
    if (node.text) out += node.text;
    if (node.content) {
        for (const c of node.content) out += extractTextFromNode(c);
    }
    // add spacing for block nodes
    if (node.type === "paragraph" || node.type === "heading") out += "\n";
    return out;
}

/** Convert a TipTap document to plain text. */
export function tiptapToPlainText(doc: TipTapDocument): string {
    return doc.content.map(extractTextFromNode).join("").replace(/\n+$/g, "");
}

/** Convert plain text into a minimal TipTap document (one paragraph per line). */
export function plainTextToTiptap(plain: string): TipTapDocument {
    const lines = plain.split(/\r?\n/);
    const content: TipTapNode[] = lines.map((l) => ({
        type: "paragraph",
        content: l === "" ? [] : [{ type: "text", text: l }],
    }));
    return { type: "doc", content };
}

/**
 * Persist both TipTap JSON and plain text forms for a resource.
 * Writes to: <projectRoot>/resources/<resourceId>/content.tiptap.json
 * and      <projectRoot>/resources/<resourceId>/content.txt
 */
export async function persistResourceContent(
    projectRoot: string,
    resourceId: string,
    doc: TipTapDocument,
): Promise<void> {
    const base = `${projectRoot}/resources/${resourceId}`;
    await mkdir(base, { recursive: true });
    const tiptapPath = `${base}/content.tiptap.json`;
    const plainPath = `${base}/content.txt`;
    await writeFile(tiptapPath, JSON.stringify(doc, null, 2), "utf8");
    const plain = tiptapToPlainText(doc);
    await writeFile(plainPath, plain, "utf8");
}

/**
 * Load TipTap JSON and plain text if present. Returns object with both fields (plain may be derived).
 */
export async function loadResourceContent(
    projectRoot: string,
    resourceId: string,
): Promise<{ tiptap?: TipTapDocument; plainText?: string }> {
    const base = `${projectRoot}/resources/${resourceId}`;
    const tiptapPath = `${base}/content.tiptap.json`;
    const plainPath = `${base}/content.txt`;
    const result: { tiptap?: TipTapDocument; plainText?: string } = {};
    try {
        const raw = await readFile(tiptapPath, "utf8");
        result.tiptap = JSON.parse(raw) as TipTapDocument;
    } catch (_) {
        // ignore
    }
    try {
        result.plainText = await readFile(plainPath, "utf8");
    } catch (_) {
        // if plain missing but tiptap present, derive
        if (result.tiptap) result.plainText = tiptapToPlainText(result.tiptap);
    }
    return result;
}

export default {
    tiptapToPlainText,
    plainTextToTiptap,
    persistResourceContent,
    loadResourceContent,
};
