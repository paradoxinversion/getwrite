# Sidecar Metadata

**Purpose:** Sidecars are small JSON files that store metadata for resources (and other objects) separate from the primary content file. They let the system persist discovery and indexing metadata without modifying resource text files.

**Location & Naming**

- Sidecars live under a project's `meta/` directory by convention (e.g., `<projectRoot>/meta/resource-<id>.meta.json`).
- Naming convention: `resource-<uuid>.meta.json` for resource sidecars. Other sidecar types may use different prefixes (e.g., `folder-<id>.meta.json`).

**Primary Fields (recommended)**

- `id` (string): resource id (UUID) — canonical key.
- `name` (string): display name or title.
- `type` (string): resource type (e.g., `text`, `image`).
- `createdAt` / `modifiedAt` (ISO string): timestamps for lifecycle events.
- `folderId` (string): id of the containing folder.
- `tags` (array[string], optional): project-scoped tags.
- `preserve` (boolean, optional): if true, prevents pruning of revisions (or signals special handling).
- `templateId` (string, optional): if resource came from a template, the originating template id.
- `metadata` (object, optional): freeform, owner-controlled fields for extensions.

## Example sidecar (`resource-<id>.meta.json`)

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
    "metadata": {
        "wordCount": 12
    }
}
```

## API & Helpers

- Read/write helpers live in `frontend/src/lib/models/sidecar.ts` and expose functions to `readSidecar(projectRoot, resourceId)` and `writeSidecar(projectRoot, resourceId, meta)`.
- When updating resource content, keep the sidecar in sync; tests rely on sidecar presence for indexing and pruning logic.

## Best Practices

- Keep sidecars small and focused: prefer scalar fields and shallow objects to reduce read/write churn.
- Use sidecars for derived, mutable, or indexable attributes (tags, previews, derived counts), not as canonical copies of resource content.
- Always write sidecars atomically when updating (write temp file and rename) to reduce risk of partial writes.
- Add new fields to sidecars conservatively and document them in `docs/features/sidecars.md` to maintain interoperability.

## Troubleshooting

- If sidecar reads fail, check file permissions and path (`<projectRoot>/meta/resource-<id>.meta.json`).
- If tests fail due to missing fields, verify unit tests that create test projects are creating sidecars as expected.
