# Data Types

This document describes the core application data types, storage layout, and runtime expectations used across the GetWrite frontend and CLI code.

Overview

- The app models a small set of domain entities: `Project`, `Folder`, `Resource` (with typed subtypes such as `TextResource`), `Revision`, and `Sidecar` metadata files.
- Types are defined at the TypeScript level under `frontend/src/lib/models/` and validated at runtime with Zod schemas in `frontend/src/lib/models/schemas.ts`.

Primitive and ID types

- `UUID` (string): v4 UUID used as canonical identifiers for projects, folders, resources, revisions.
- `ISO-8601` timestamps (string): used for `createdAt`, `modifiedAt` fields.
- `MetadataValue` (union): values allowed in sidecar `metadata` and `userMetadata` fields — `string | number | boolean | null | Record<string, MetadataValue>`. The type is recursive: nested objects are supported.

Project

- Purpose: top-level container describing a workspace on disk.
- Typical file: `<projectRoot>/project.json`.
- Fields (representative):
  - `id` (UUID)
  - `name` (string)
  - `projectType` (string) — the `id` of the project-type spec used to create it
  - `rootPath` (string)
  - `maxRevisions` (number)
  - `createdAt`, `modifiedAt` (ISO strings)

Folder

- Purpose: logical grouping for resources within a project. Each folder also corresponds to a directory under `<projectRoot>/folders/<slug>`.
- Folder object fields (representative):
  - `id` (UUID)
  - `slug` (string) — filesystem-safe slug generated from the folder name
  - `name` (string)
  - `parentId` (UUID | null)
  - `orderIndex` (number | undefined)
  - `createdAt` (ISO string)

Resource (base)

- Purpose: a resource represents an editable unit (text, image, audio, etc.). On disk, primary content lives in `<projectRoot>/resources/` and sidecar metadata in `<projectRoot>/meta/`.
- Base fields:
  - `id` (UUID)
  - `name` (string)
  - `slug` (string)
  - `type` (string) — e.g., `text`, `image`, `audio`
  - `folderId` (UUID)
  - `createdAt` (ISO string)

TextResource (concrete)

- Additional/representative fields:
  - `plainText` (string)
  - `tiptap` (optional TipTap JSON)
- Files (directory-per-resource layout):
  - Plain text: `<projectRoot>/resources/<uuid>/content.txt`
  - TipTap JSON: `<projectRoot>/resources/<uuid>/content.tiptap.json`
  - Sidecar: `<projectRoot>/meta/resource-<id>.meta.json`

Revision

- Purpose: versioned snapshot of a resource's content used for history and pruning.
- Storage: each revision version is a directory under `<projectRoot>/revisions/<resourceId>/v-<versionNumber>/` containing two files:
  - `content.bin` — the serialized content payload
  - `metadata.json` — revision metadata (id, resourceId, versionNumber, createdAt, isCanonical, etc.)
- Representative fields:
  - `id` (UUID)
  - `resourceId` (UUID)
  - `versionNumber` (number) — sequential; highest number is most recent
  - `createdAt` / `savedAt` (ISO string)
  - `author` (string | undefined)
  - `isCanonical` (boolean) — exactly one revision per resource is canonical at any time
  - `metadata` (object | undefined) — arbitrary revision-level metadata; `metadata.preserve: true` prevents pruning

Sidecar Metadata

- Purpose: store derived or indexable metadata separately from the resource content.
- Location: `<projectRoot>/meta/resource-<id>.meta.json` (other sidecars may use different prefixes).
- Common fields:
  - `id`, `name`, `type`, `createdAt`, `modifiedAt`, `folderId`
  - `tags` (string[]), `preserve` (boolean), `metadata` (shallow object)
- Helpers: read/write helpers live in `frontend/src/lib/models/sidecar.ts`.

Project-Type Spec (scaffolding)

- Purpose: JSON spec used to scaffold a new project. Example location for runtime templates: `getwrite-config/templates/project-types/`.
- Fields:
  - `id`, `name`, `description`
  - `folders`: array of `{ name, special? }` objects
  - `defaultResources`: optional array of `{ folder?, name, type, template? }`
- Validation: use `validateProjectType()` / `validateProjectTypeFile()` from `frontend/src/lib/models/schemas.ts`.
- Runtime behavior: `createProjectFromType()` loads and validates the spec, creates folder directories and default resource files, and writes sidecars.

Inverted Index & Backlinks

- The app stores derived indexing artifacts under `<projectRoot>/meta/index/` (inverted index) and `<projectRoot>/meta/backlinks.json`.
- Indexing helpers are implemented in the models module and invoked on resource save operations.

Storage layout (convention)

- `<projectRoot>/project.json` — project descriptor
- `<projectRoot>/folders/<folder-slug>/folder.json` — folder descriptor
- `<projectRoot>/resources/<uuid>/content.txt` — resource plain text content
- `<projectRoot>/resources/<uuid>/content.tiptap.json` — resource TipTap JSON content
- `<projectRoot>/meta/resource-<id>.meta.json` — resource sidecar metadata
- `<projectRoot>/revisions/<resourceId>/v-<version>/content.bin` — revision content payload
- `<projectRoot>/revisions/<resourceId>/v-<version>/metadata.json` — revision metadata
- `<projectRoot>/meta/index/` — indexing artifacts
- `<projectRoot>/meta/backlinks.json` — cross-resource backlink index

Validation & Runtime Schemas

- The authoritative runtime validation lives in `frontend/src/lib/models/schemas.ts` and uses Zod.
- When updating types or adding fields, update the Zod schema and corresponding unit tests under `frontend/tests/unit`.

Examples

- Example resource sidecar:

```json
{
  "id": "b19abcd4-81b2-44ef-b4b4-ba1310dbdf87",
  "name": "Title Page",
  "type": "text",
  "createdAt": "2026-02-21T07:17:41.691Z",
  "modifiedAt": "2026-02-21T07:17:41.691Z",
  "folderId": "folder-123",
  "tags": ["front-matter"],
  "preserve": true,
  "metadata": { "wordCount": 12 }
}
```

Best practices

- Keep sidecars small and shallow to minimize I/O when reading metadata.
- Prefer storing large derived artifacts (indexes, previews) under `meta/` with clear naming conventions.
- Use `slug` fields for stable, filesystem-safe names and `id` for canonical references.
- When extending models, add unit tests that assert schema validation and round-trip persistence.

See also

- `frontend/src/lib/models/schemas.ts` (runtime zod schemas)
- `frontend/src/lib/models/project-creator.ts` (scaffolding)
- `frontend/src/lib/models/sidecar.ts` (sidecar helpers)

> **Developer note:** `specs/002-define-data-models/` contains example specs and documentation used as test fixtures. It is an implementation artifact, not authoritative documentation — the canonical data definitions are in the source files and Zod schemas above.
