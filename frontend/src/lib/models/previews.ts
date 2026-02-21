import path from "node:path";
import type { UUID, TextResource, ImageResource, AudioResource } from "./types";
import { mkdir, readFile, writeFile } from "./io";
import { withMetaLock } from "./meta-locks";

export type ImagePreview = {
    type: "image";
    width: number;
    height: number;
    thumbnail?: string;
};
export type AudioPreview = {
    type: "audio";
    duration?: number;
    waveform?: number[];
};
export type TextPreview = {
    type: "text";
    excerpt?: string;
    wordCount?: number;
};

export type Preview = ImagePreview | AudioPreview | TextPreview;

const PREVIEWS_DIR = (projectRoot: string) =>
    path.join(projectRoot, "meta", "previews");

export function previewPath(projectRoot: string, resourceId: UUID) {
    return path.join(PREVIEWS_DIR(projectRoot), `${resourceId}.json`);
}

async function ensurePreviewsDir(projectRoot: string) {
    await mkdir(PREVIEWS_DIR(projectRoot), { recursive: true });
}

export async function savePreview(
    projectRoot: string,
    resourceId: UUID,
    preview: Preview,
) {
    await withMetaLock(projectRoot, async () => {
        await ensurePreviewsDir(projectRoot);
        const p = previewPath(projectRoot, resourceId);
        await writeFile(p, JSON.stringify(preview, null, 2), "utf8");
    });
}

export async function loadPreview(
    projectRoot: string,
    resourceId: UUID,
): Promise<Preview | null> {
    const p = previewPath(projectRoot, resourceId);
    try {
        const raw = await readFile(p, "utf8");
        return JSON.parse(raw) as Preview;
    } catch (_) {
        return null;
    }
}

/**
 * Generate a preview for a resource. Generators can be supplied for tests or
 * to integrate with native/image/audio processing libraries.
 */
export async function generatePreview(
    projectRoot: string,
    resource: TextResource | ImageResource | AudioResource,
    generators?: {
        image?: (r: ImageResource) => Promise<ImagePreview> | ImagePreview;
        audio?: (r: AudioResource) => Promise<AudioPreview> | AudioPreview;
        text?: (r: TextResource) => Promise<TextPreview> | TextPreview;
    },
) {
    let out: Preview | null = null;

    if ((resource as ImageResource).type === "image") {
        const img = resource as ImageResource;
        if (generators && generators.image) out = await generators.image(img);
        else
            out = {
                type: "image",
                width: 160,
                height: 90,
            };
    } else if ((resource as AudioResource).type === "audio") {
        const aud = resource as AudioResource;
        if (generators && generators.audio) out = await generators.audio(aud);
        else
            out = {
                type: "audio",
                duration: (aud as any).duration ?? 0,
                waveform: [],
            };
    } else {
        const txt = resource as TextResource;
        if (generators && generators.text) out = await generators.text(txt);
        else
            out = {
                type: "text",
                excerpt: (txt.plainText ?? "").slice(0, 200),
                wordCount: (txt.plainText ?? "").split(/\s+/).filter(Boolean)
                    .length,
            };
    }

    if (out) {
        await savePreview(projectRoot, resource.id, out);
    }

    return out;
}

export default { previewPath, savePreview, loadPreview, generatePreview };
