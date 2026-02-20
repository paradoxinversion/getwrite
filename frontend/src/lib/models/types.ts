// Type definitions for GetWrite models
// Follow docs/standards/typescript-implementation.md: no `any`, explicit types, and clear documentation.

export type UUID = string; // UUID v4

// MetadataValue is a recursive, JSON-like union used for sidecar metadata.
export type MetadataValue =
    | string
    | number
    | boolean
    | null
    | string[]
    | number[]
    | boolean[]
    | { [key: string]: MetadataValue };

export interface ProjectConfig {
    /** Maximum revisions to retain per resource. Defaults to 50 when omitted. */
    maxRevisions?: number;
    /** Custom status values available to the project. */
    statuses?: string[];
    /** If true, automatically prune oldest non-canonical revisions when limit is exceeded. */
    autoPrune?: boolean;
}

export interface Project {
    id: UUID;
    slug?: string;
    name: string;
    createdAt: string; // ISO 8601
    updatedAt?: string;
    projectType?: string;
    rootPath?: string;
    config?: ProjectConfig;
    metadata?: Record<string, MetadataValue>;
}

export interface Folder {
    id: UUID;
    slug?: string;
    name: string;
    parentId?: UUID | null;
    orderIndex?: number;
    createdAt: string;
    updatedAt?: string;
}

export type ResourceType = "text" | "image" | "audio";

export interface ResourceBase {
    id: UUID;
    slug?: string;
    name: string;
    type: ResourceType;
    folderId?: UUID | null;
    sizeBytes?: number;
    notes?: string;
    statuses?: string[];
    metadata?: Record<string, MetadataValue>;
    createdAt: string;
    updatedAt?: string;
}

// Minimal TipTap AST-safe types used for editor persistence.
export interface TipTapNode {
    type: string;
    attrs?: Record<string, MetadataValue>;
    content?: TipTapNode[];
}

export interface TipTapDocument {
    type: "doc";
    content: TipTapNode[];
}

export interface TextResource extends ResourceBase {
    type: "text";
    plainText?: string;
    tiptap?: TipTapDocument;
    wordCount?: number;
    charCount?: number;
    paragraphCount?: number;
}

export interface ImageResource extends ResourceBase {
    type: "image";
    width?: number;
    height?: number;
    exif?: Record<string, MetadataValue>;
}

export interface AudioResource extends ResourceBase {
    type: "audio";
    durationSeconds?: number;
    format?: string;
}

export interface Revision {
    id: UUID;
    resourceId: UUID;
    versionNumber: number;
    createdAt: string;
    savedAt?: string;
    author?: string;
    filePath: string;
    isCanonical: boolean;
}

export type AnyResource = TextResource | ImageResource | AudioResource;
