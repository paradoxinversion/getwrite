# Data Model (canonical)

This file mirrors the canonical data model used across the project. The source-of-truth for these definitions is
[specs/002-define-data-models/data-model.md](../002-define-data-models/data-model.md).

## TypeScript Interfaces (canonical)

```ts
export type UUID = string; // UUID v4

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
    maxRevisions?: number; // default 50
    statuses?: string[];
}

export interface Project {
    id: UUID;
    slug?: string;
    name: string;
    createdAt: string; // ISO
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

export interface TextResource extends ResourceBase {
    type: "text";
    plainText?: string; // canonical plain text body
    tiptap?: TipTapDocument; // TipTap JSON/Delta format (see minimal shape below)
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
```

## Notes

- Use the canonical file at [specs/002-define-data-models/data-model.md](../002-define-data-models/data-model.md) for additional examples, sidecar formats, and implementation guidance.
- Implementations should validate data shapes at runtime (e.g., using `zod`) and provide conversion helpers for TipTap documents.
