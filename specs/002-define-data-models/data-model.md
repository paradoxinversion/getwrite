# Data Model: Type Definitions and Schemas

This document defines the TypeScript interfaces and example JSON schema fragments for Projects, Folders, Resources, Revisions, and Metadata.

## TypeScript Interfaces (high level)

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
- TipTap minimal shape (recommended for validation)

```ts
// minimal-safe TipTap shape for storage/validation (not full TipTap schema)
export interface TipTapNode {
    type: string;
    attrs?: Record<string, any>;
    content?: TipTapNode[];
}

export interface TipTapDocument {
    type: "doc";
    content: TipTapNode[];
}
```

Implementations should validate incoming TipTap JSON against this minimal shape and provide conversion helpers to/from `plainText`. Add unit tests for conversion helpers.

- Use runtime validators (`zod`) in implementation to validate incoming data and sidecar files.

## Implemented TypeScript files

The following TypeScript implementations exist and map to the interfaces and concepts described above. See each file for implementation details and unit tests.

- [frontend/src/lib/models/project.ts](frontend/src/lib/models/project.ts)
- [frontend/src/lib/models/project-config.ts](frontend/src/lib/models/project-config.ts)
- [frontend/src/lib/models/project-creator.ts](frontend/src/lib/models/project-creator.ts)
- [frontend/src/lib/models/resource.ts](frontend/src/lib/models/resource.ts)
- [frontend/src/lib/models/revision.ts](frontend/src/lib/models/revision.ts)
- [frontend/src/lib/models/revision-manager.ts](frontend/src/lib/models/revision-manager.ts)
- [frontend/src/lib/models/schemas.ts](frontend/src/lib/models/schemas.ts)
- [frontend/src/lib/models/sidecar.ts](frontend/src/lib/models/sidecar.ts)
- [frontend/src/lib/models/uuid.ts](frontend/src/lib/models/uuid.ts)
- [frontend/src/lib/models/index.ts](frontend/src/lib/models/index.ts)
- [frontend/lib/tiptap-utils.ts](frontend/lib/tiptap-utils.ts)

If you want me to add or update line-numbered links to specific symbols inside these files, say which files and I'll add precise anchors.
