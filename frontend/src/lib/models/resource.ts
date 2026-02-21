import { generateUUID } from "./uuid";
import type {
    UUID,
    TextResource,
    ImageResource,
    AudioResource,
    MetadataValue,
    TipTapDocument,
} from "./types";
import {
    TextResourceSchema,
    ImageResourceSchema,
    AudioResourceSchema,
    AnyResourceSchema,
} from "./schemas";

/** Create a `TextResource` with sensible defaults and derived metrics. */
export function createTextResource(params: {
    name: string;
    folderId?: UUID | null;
    plainText?: string;
    tiptap?: TipTapDocument;
    slug?: string;
    metadata?: Record<string, MetadataValue>;
}): TextResource {
    const now = new Date().toISOString();
    const id = generateUUID();
    const plain = params.plainText ?? "";

    const wordCount =
        plain.trim() === "" ? 0 : plain.trim().split(/\s+/).length;
    const charCount = plain.length;
    const paragraphCount =
        plain.split(/\n\s*\n/).filter(Boolean).length || (plain.trim() ? 1 : 0);

    const res: TextResource = {
        id,
        name: params.name,
        slug: params.slug,
        type: "text",
        folderId: params.folderId,
        createdAt: now,
        plainText: plain,
        tiptap: params.tiptap,
        wordCount,
        charCount,
        paragraphCount,
        metadata: params.metadata,
    };

    // Runtime validation - will throw on invalid shapes
    TextResourceSchema.parse(res);
    return res;
}

/** Create an `ImageResource` with optional metadata. */
export function createImageResource(params: {
    name: string;
    folderId?: UUID | null;
    width?: number;
    height?: number;
    exif?: Record<string, MetadataValue>;
    slug?: string;
    metadata?: Record<string, MetadataValue>;
}): ImageResource {
    const now = new Date().toISOString();
    const id = generateUUID();

    const res: ImageResource = {
        id,
        name: params.name,
        slug: params.slug,
        type: "image",
        folderId: params.folderId,
        createdAt: now,
        width: params.width,
        height: params.height,
        exif: params.exif,
        metadata: params.metadata,
    };

    ImageResourceSchema.parse(res);
    return res;
}

/** Create an `AudioResource` with optional metadata. */
export function createAudioResource(params: {
    name: string;
    folderId?: UUID | null;
    durationSeconds?: number;
    format?: string;
    slug?: string;
    metadata?: Record<string, MetadataValue>;
}): AudioResource {
    const now = new Date().toISOString();
    const id = generateUUID();

    const res: AudioResource = {
        id,
        name: params.name,
        slug: params.slug,
        type: "audio",
        folderId: params.folderId,
        createdAt: now,
        durationSeconds: params.durationSeconds,
        format: params.format,
        metadata: params.metadata,
    };

    AudioResourceSchema.parse(res);
    return res;
}

/** Validate an arbitrary input as AnyResource and return the typed value. */
export function validateResource(input: unknown) {
    return AnyResourceSchema.parse(input);
}

export default {
    createTextResource,
    createImageResource,
    createAudioResource,
    validateResource,
};
