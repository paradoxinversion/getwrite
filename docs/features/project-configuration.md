# Project Configuration (developer)

Purpose

This document explains the internal project configuration model used by the codebase and how developers can extend or integrate with it.

Location

- The project configuration file lives at the project root as `project.json`.
- Runtime loader: `frontend/src/lib/models/project-config.ts` (loads `project.json` and applies defaults).

Primary fields

- `id` (string, optional): project identifier. Generated when omitted.
- `name` (string): human-friendly project name.
- `description` (string, optional): a short description used in listings.
- `maxRevisions` (number, default 50): maximum number of revisions retained per resource. The `revision-manager` enforces this when creating revisions.
- `autoPrune` (boolean, default true): whether to automatically prune older revisions when `maxRevisions` is exceeded.
- `meta` (object, optional): per-project meta options (e.g., paths or flags for previews/indexing). See examples below.

Meta/Derived storage

- Sidecars: `meta/resource-<id>.meta.json` (written by `writeSidecar()`)
- Index: `meta/index/inverted.json` (managed by `frontend/src/lib/models/inverted-index.ts`)
- Backlinks: `meta/backlinks.json` (managed by `frontend/src/lib/models/backlinks.ts`)
- Templates: `meta/templates/<id>.json`
- Previews: `meta/previews/<resourceId>.json`

Concurrency and durability concerns

- All writers that modify files under `meta/` should use `withMetaLock(projectRoot, fn)` from `frontend/src/lib/models/meta-locks.ts` to serialize operations and avoid races.
- Indexing runs asynchronously via the indexer queue: `frontend/src/lib/models/indexer-queue.ts`. Tests may call `flushIndexer()` to wait for the queue to drain.
- For operations that require durable writes (e.g., export/import workflows), consider performing an `fsync` on the file descriptor after `writeFile` (not currently enabled by default).

Schema and validation

- Runtime schema definitions live in `frontend/src/lib/models/schemas.ts` and are validated at load time. When adding new configuration keys, update the zod schema there and add unit tests.

Extension points

- Add new meta keys under `meta` and provide a clear default in the loader.
- If adding a new background task that writes into `meta/`, ensure it uses `withMetaLock` and (if necessary) enqueues indexing via dynamic `import()` to avoid circular imports.

Examples

Minimal `project.json`:

```json
{
    "name": "My Project",
    "maxRevisions": 50,
    "autoPrune": true
}
```

Advanced `project.json` (dev-friendly):

```json
{
    "id": "proj-abc",
    "name": "Novel Draft",
    "description": "A project for my novel",
    "maxRevisions": 100,
    "autoPrune": true,
    "meta": {
        "enablePreviews": true,
        "index": { "enabled": true }
    }
}
```

Testing

- Unit tests should mock filesystem through `frontend/src/lib/models/io.ts` where practical and call the loader to ensure defaults are applied.
- When tests touch `meta/` and background indexing may run, call the indexer `flushIndexer()` helper to avoid teardown races.

See also

- `frontend/src/lib/models/project-config.ts`
- `frontend/src/lib/models/schemas.ts`
- `specs/002-define-data-models/tasks.md`
