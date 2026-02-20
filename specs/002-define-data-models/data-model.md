# Data Model: Type Definitions and Schemas

This document defines the TypeScript interfaces and example JSON schema fragments for Projects, Folders, Resources, Revisions, and Metadata.

## TypeScript Interfaces (high level)

```ts
export type UUID = string; // UUID v4

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
    metadata?: Record<string, any>;
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
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt?: string;
}

export interface TextResource extends ResourceBase {
    type: "text";
    plainText?: string; // canonical plain text body
    tiptap?: any; // TipTap JSON/Delta format
    wordCount?: number;
    charCount?: number;
    paragraphCount?: number;
}

export interface ImageResource extends ResourceBase {
    type: "image";
    width?: number;
    height?: number;
    exif?: Record<string, any>;
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

## Sidecar Metadata Example

Example `resource-<id>.meta.json`:

```json
{
    "id": "<uuid>",
    "slug": "chapter-1",
    "notes": "First draft of chapter 1",
    "statuses": ["Draft"],
    "metadata": { "wordCount": 1234 },
    "updatedAt": "2026-02-20T12:34:56Z"
}
```

## Notes

- Text resources SHOULD store both `plainText` (for exports and plain editing) and `tiptap` (for editor persistence). Conversion helpers will be provided in `frontend/src/lib/tiptap-utils.ts`.
- Use runtime validators (`zod`) in implementation to validate incoming data and sidecar files.
