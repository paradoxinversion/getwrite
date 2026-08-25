# Revisions (developer reference)

This document covers the GetWrite revision system: on-disk layout, version numbering, the canonical invariant, pruning, the `preserve` flag, and soft-delete (trash). For the writer-facing guide to revisions in the app, see [docs/user/revisions.md](../user/revisions.md).

---

## On-Disk Layout

Each revision is stored in its own directory under the project root:

```
<projectRoot>/revisions/<resourceId>/v-<versionNumber>/
├── content.bin       — serialized content payload (UTF-8 text or TipTap JSON)
└── metadata.json     — revision metadata object (see fields below)
```

Writes are atomic: content and metadata are first written to a temporary directory (`revisions/<resourceId>/.tmp-<uuid>/`) and then atomically renamed into the final `v-<N>` directory. Partial writes are never exposed.

---

## Version Numbering

- Version numbers are sequential integers starting at `1`.
- The highest version number is the most recently created revision.
- When saving a new revision, the next version number is: `max(existing versionNumbers) + 1`, or `1` if no revisions exist yet.
- Version numbers are never reused after a revision is deleted.

---

## Revision Metadata Fields

Each `metadata.json` contains a `Revision` object:

| Field           | Type       | Description                                                          |
| --------------- | ---------- | -------------------------------------------------------------------- |
| `id`            | UUID       | Stable revision UUID (not the same as versionNumber)                 |
| `resourceId`    | UUID       | Resource this revision belongs to                                    |
| `versionNumber` | number     | Sequential version number                                            |
| `createdAt`     | ISO string | When the revision was created                                        |
| `savedAt`       | ISO string | When the metadata was last written (updated on canonical set)        |
| `author`        | string?    | Optional author identifier                                           |
| `filePath`      | string     | Absolute path to `content.bin`                                       |
| `isCanonical`   | boolean    | Whether this is the currently canonical revision                     |
| `metadata`      | object?    | Arbitrary key/value bag; `metadata.preserve = true` prevents pruning |

---

## The `isCanonical` Invariant

**Exactly one revision per resource is canonical at any time.**

- When a project is created, the initial revision (v-1) is written with `isCanonical: true`.
- When `setCanonicalRevision(projectRoot, resourceId, versionNumber)` is called, it rewrites every `metadata.json` under `revisions/<resourceId>/`: the target version is set to `isCanonical: true`, all others to `isCanonical: false`.
- The Redux layer enforces this invariant client-side via `revision-canonical-guards.ts`, which provides `applyCanonicalRevision` (marks one entry canonical, clears all others) and `isStaleCanonicalUpdate` (guards against out-of-order updates).

The `revision-transport-service.ts` resolves revision operations through the transport seam (HTTP on web/desktop, in-process on native; ADR-021) and feeds normalized `RevisionEntry` objects to the Redux slice via `revision-normalization.ts`.

---

## The `preserve` Flag

Setting `metadata.preserve = true` on a revision marks it as protected. The pruning system (see below) will never select a preserved revision for deletion, regardless of how many revisions exist.

Use `preserve` to protect milestone revisions (e.g., submitted drafts, chapter completions) that must be retained even under aggressive `maxRevisions` settings.

---

## Pruning

Pruning removes old revisions to enforce a `maxRevisions` cap.

### Selection rules (`selectPruneCandidates`)

Given all revisions for a resource:

1. Exclude canonical revisions (`isCanonical: true`)
2. Exclude preserved revisions (`metadata.preserve: true`)
3. Sort remaining by ascending `versionNumber` (oldest first)
4. Return the oldest `total - maxRevisions` entries

### `pruneRevisions(projectRoot, resourceId, maxRevisions, options)`

- Calls `selectPruneCandidates` to identify deletion candidates
- Deletes each candidate's `revisions/<resourceId>/v-<N>/` directory
- If `options.autoPrune === false` and the required number of revisions cannot be removed (because protected revisions consume capacity), the function aborts and returns `[]` without deleting anything
- Default `maxRevisions` in the project config is `50`

### CLI pruning

The `getwrite prune` command runs pruning across all resources in a project:

```sh
getwrite prune [projectRoot] [--max <number>]
```

See [docs/features/cli.md](./cli.md) for full CLI reference.

### `pruneExecutor.ts`

The `runCli` function in `pruneExecutor.ts` orchestrates CLI-driven pruning. It:

1. Reads all resource IDs from `resources/`
2. Calls `pruneRevisions` for each with the configured `maxRevisions`
3. Reports pruned counts to stdout

---

## API Routes

| Method | Path                                   | Description                               |
| ------ | -------------------------------------- | ----------------------------------------- |
| GET    | `/api/resource/revision/[resource-id]` | Fetch revision metadata + content         |
| POST   | `/api/resource/revision/[resource-id]` | Save a new revision                       |
| PATCH  | `/api/resource/revision/[resource-id]` | Set canonical or update canonical content |
| DELETE | `/api/resource/revision/[resource-id]` | Delete a revision by UUID                 |

See [docs/api/openapi.yaml](../api/openapi.yaml) for full request/response schemas.

---

## Soft-Delete (Trash)

GetWrite implements **soft-delete** for resources via `trash.ts`. When a resource is deleted through the UI, `softDeleteResource` moves its files to a `.trash/` directory inside the project root rather than permanently deleting them.

### `.trash/` layout

`.trash/` is split into `resources/` and `meta/` subtrees. Each moved resource file is prefixed with the resource ID, and the sidecar keeps its canonical name:

```
<projectRoot>/.trash/
├── resources/
│   ├── <resourceId>-content.txt
│   └── <resourceId>-content.tiptap.json
└── meta/
    └── resource-<resourceId>.meta.json
```

The revision directories under `<projectRoot>/revisions/<resourceId>/` are **not** moved to `.trash/` — only the resource content and sidecar are relocated.

### Recovery

`trash.ts` exports `restoreResource(projectRoot, resourceId)`, which moves the content files and sidecar back out of `.trash/`, and `purgeResource(projectRoot, resourceId)`, which permanently deletes them. There is currently no UI wired to these functions — recovery happens programmatically (or by manually moving files). A trash-bin UI is on the roadmap.

---

## Source Files

| File                                                        | Role                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `frontend/src/lib/models/revision.ts`                       | Core revision filesystem utilities                                            |
| `frontend/src/lib/models/pruneExecutor.ts`                  | CLI-orchestrated pruning across all project resources                         |
| `frontend/src/lib/models/trash.ts`                          | Soft-delete implementation                                                    |
| `frontend/src/store/revisionsSlice.ts`                      | Redux state for revision UI                                                   |
| `frontend/src/store/revision-canonical-guards.ts`           | Client-side canonical invariant enforcement                                   |
| `frontend/src/store/revision-normalization.ts`              | Normalizes raw revision data into `RevisionEntry` shape                       |
| `frontend/src/store/revision-transport-service.ts`          | Transport layer for revision operations (HTTP web/desktop, in-process native) |
| `frontend/app/api/resource/revision/[resource-id]/route.ts` | Next.js route handler                                                         |
