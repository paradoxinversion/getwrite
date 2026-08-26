# Indexing feature

Overview

The project includes a simple per-project full-text indexing system to enable fast search across resources. The index is incremental, persisted under the project's `meta/index/` directory, and is updated whenever resource content or metadata changes.

Key components

- `frontend/src/lib/models/inverted-index.ts`
  - Implements the inverted index data structure persisted as `meta/index/inverted.json`.
  - API:
    - `indexResource(projectRoot, resource)` — index a single resource (adds/updates postings).
    - `removeResourceFromIndex(projectRoot, resourceId)` — remove a resource from the index.
    - `search(projectRoot, query)` — simple term-frequency based search returning ranked resource ids.
  - Tokenization: lowercased, split on non-alphanumeric characters; only `[a-z0-9]` tokens are kept.
  - Ranking: sum of term frequencies across query terms, ties broken by higher freq for the first query term then lexicographic id.

- `frontend/src/lib/models/indexer-queue.ts`
  - Background FIFO queue that processes indexing tasks sequentially to avoid concurrent FS stress.
  - API:
    - `enqueueIndex(projectRoot, resourceId)` — enqueue a resource for indexing (non-blocking).
    - `flushIndexer(timeout?)` — wait for the queue to drain (useful in tests to avoid teardown races).
  - When processing tasks, the queue attempts to obtain canonical plain text from (in order): resource persisted content, tiptap content (converted to plain text), last revision content fallback.

- `frontend/src/lib/models/meta-locks.ts`
  - A lightweight per-project promise-chain lock to serialize writes to the `meta/` directory. Used to avoid races where multiple writers create/remove files concurrently.

Triggers / wiring

Indexing is triggered in the following places:

- After revision creation (revision manager enqueues the resource id).
- After resource saves (e.g., `persistResourceContent` enqueues indexing dynamically).
- After sidecar writes (`writeSidecar` enqueues indexing dynamically).

To avoid circular imports, enqueues are performed via dynamic `import()` calls.

Persistence

- Index file: `<projectRoot>/meta/index/inverted.json`
- Backlink index: `<projectRoot>/meta/backlinks.json`
- Entity mention index: `<projectRoot>/meta/index/mentions.json` (see [Entity mentions](#entity-mentions) below)

## Backlinks

The backlinks system maintains a cross-reference index: for each resource, it records which other resources link to it.

**What it tracks**

- Wiki-style links: `[[Resource Name]]` or `[[resource-slug]]` or `[[uuid]]` inside resource content
- Raw UUIDs embedded anywhere in the resource text
- Aliases defined in the resource's sidecar (`aliases` field)
- `resource-ref` / `multi-resource-ref` sidecar field values, detected structurally by `extractSidecarRefIds` (any `{ id, name }` shape or array of them) — scanned at the sidecar's top level and one level down under `sidecar.userMetadata`, since that's where user-defined metadata fields live

**`BacklinkIndex` type**

```ts
type BacklinkIndex = Record<string, string[]>;
// { resourceId: [referencedResourceId, ...] }
```

Each key is a resource UUID; its value is the list of resource UUIDs that the key resource links to (outgoing links). To find all resources that link _to_ a given resource, scan all values for that ID.

**Resolution order** (for `[[...]]` targets)

1. If the target is a UUID, use it directly
2. Check `meta/redirects.json` for slug/alias redirects
3. Match by `slug` from sidecar
4. Match by `name` (case-insensitive) from sidecar
5. Match by `aliases` array from sidecar
6. Slugify the target string and match by slug

**API** (`frontend/src/lib/models/backlinks.ts`)

| Function                               | Description                                                    |
| -------------------------------------- | -------------------------------------------------------------- |
| `listResourceIds(projectRoot)`         | Lists resource UUIDs from `resources/` directory               |
| `computeBacklinks(projectRoot)`        | Scans all resource content and builds the full `BacklinkIndex` |
| `persistBacklinks(projectRoot, index)` | Writes `meta/backlinks.json` under meta lock                   |
| `loadBacklinks(projectRoot)`           | Reads `meta/backlinks.json`, returns `{}` if absent            |

**Live updates** (`frontend/src/lib/models/backlinks-watcher.ts`)

`backlinks-watcher.ts` watches the project's resource files for changes and triggers `computeBacklinks` + `persistBacklinks` on updates. This keeps `meta/backlinks.json` in sync without requiring a full rebuild on every read.

**Storage**: `<projectRoot>/meta/backlinks.json`

## Entity mentions

Separate from backlinks (explicit `[[wiki-link]]`/UUID references), the entity mention index tracks resources whose prose _mentions_ a declared entity by name or alias, without an explicit link. A mention is detected, never authored; an explicit link is authored, never detected. The two are computed and stored independently and are only merged for display (see below) — never conflated into one record.

**What it tracks**

- A resource becomes an entity by setting `entityKind` (an open string, e.g. `"character"`, `"place"`) on its sidecar, optionally with an `aliases` array of alternate names.
- `frontend/src/lib/models/entity-detection.ts` scans other resources' persisted plain text for case-insensitive, word-boundary occurrences of an entity's name/aliases, including possessive (`Aria's`) and simple plural (`Arias`) forms.
- `frontend/src/lib/models/entity-alias-table.ts` builds the per-project table of every entity's matchable terms and flags terms claimed by more than one entity as ambiguous.
- `frontend/src/lib/models/entity-alias-warnings.ts` is a non-blocking heuristic (never rejects an alias) that flags very short or common-word aliases as noise-prone.

**`MentionIndex` type** (`frontend/src/lib/models/mention-index.ts`)

```ts
type MentionIndex = Record<string, MentionRecord[]>;
// { resourceId: [{ entityId, resourceId, count, offsets }, ...] }
```

Keyed by `resourceId` so a resource's own mentions are a direct lookup; `invertMentionIndex` flips it to `entityId -> MentionRecord[]` for an entity's own "mentioned in" view.

**Reads** (`frontend/src/lib/models/mentions-core.ts`) — transport-agnostic, read-only (never triggers detection):

- `getResourceMentions(projectRoot, resourceId)` — which entities a resource mentions.
- `getEntityMentionedIn(projectRoot, entityId)` — which resources mention an entity, one snippet per occurrence, merged with the entity's explicit `linkedFrom` backlinks (a resource that is both linked and mentioned appears once with both flags set) and annotated with ambiguity when another entity's alias claims the same occurrence.

**Wiring**: `indexer-queue.ts` detects mentions on the normal per-resource save path, plus a targeted rescan of every resource whenever an entity's `name`/`aliases`/`entityKind` changes (so other resources are re-matched against the updated terms). `getwrite-cli reindex` rebuilds the mention index from scratch alongside the inverted index and backlinks.

**Storage**: `<projectRoot>/meta/index/mentions.json`

Testing and determinism

- `flushIndexer()` is exported and used in unit tests to wait for background indexing to complete before test cleanup (this avoids `ENOTEMPTY` directory errors on some platforms).
- Meta writes are serialized via `withMetaLock(projectRoot, fn)` to avoid concurrent write/remove races during tests and runtime.

Developer notes

- `flushIndexer()` uses a short polling loop with a configurable timeout; it's intended for tests and developer tooling, not for production control flows.
- If you need stronger guarantees in production (fsync or durable write semantics), consider adding explicit `fsync`/`fdatasync` after writes and handling graceful shutdown of the queue.

How to use the APIs

- Enqueue indexing (non-blocking):

```ts
import indexer from "../lib/models/indexer-queue";
indexer.enqueueIndex(projectRoot, resourceId);
```

- Wait for indexing to finish (tests / tooling):

```ts
import { flushIndexer } from "../lib/models/indexer-queue";
await flushIndexer(); // optional timeout: await flushIndexer(3000);
```

Maintenance

- To rebuild a project's inverted index, backlinks, and entity mention index from scratch (after bulk filesystem changes that bypassed the save path, or to recover from a corrupted/stale index), run the `reindex` CLI command: `getwrite-cli reindex [projectRoot]`. See [docs/features/cli.md](./cli.md).
- The index format is intentionally simple (JSON). For larger projects or better performance, consider moving to a binary/LMDB-backed store or using a search engine (e.g., SQLite FTS, Tantivy, or Elastic).
- Keep the tokenization and ranking logic in `inverted-index.ts` consistent with search UI expectations.

Contact

- For questions about design decisions, see `specs/002-define-data-models` and the commit history on branch `002-define-data-models`.

## TODO

- Replace `flushIndexer()` polling with a promise-based signaling mechanism.

  What: implement a completion signal in `frontend/src/lib/models/indexer-queue.ts` (for example an internal promise or EventEmitter-based API) that resolves when the queue has finished processing the currently enqueued tasks. Export a `waitForDrain()` or similar API consumers (tests and tooling) can call instead of polling.

  Why: polling adds latency and relies on timeouts which can mask races or cause flaky tests on slow CI. A promise-based signal is deterministic, faster, and eliminates the need for arbitrary timeouts, improving test stability and making shutdown semantics clearer.

## Proposals

- Promise-based drain signal

  What: replace `flushIndexer()` polling with a deterministic `waitForDrain()` API (e.g. an internal promise or EventEmitter) that resolves when the queue has finished processing currently enqueued tasks. Export this API for tests and tooling.

  Why: eliminates polling/timeouts, yields deterministic synchronization for tests and shutdown flows, reduces CI flakiness and wasted wait time.

- Durable meta writes (fsync)

  What: after writing key meta files (index, backlinks, templates), optionally perform an `fsync`/`fdatasync` on the file descriptor before closing to ensure data is flushed to disk.

  Why: reduces risk of data loss on sudden crashes and makes integration tests behave more deterministically across platforms. Note: this increases latency and should be configurable.

- Graceful indexer shutdown

  What: add an explicit shutdown/flush method for the indexer queue that stops accepting new tasks, finishes in-flight tasks, and signals completion. Integrate this with application lifecycle hooks (e.g. before-exit).

  Why: avoids data races and incomplete writes when the app is stopped or during test teardown; it's more explicit and safer than relying on ad-hoc waits.

- Optional backend/search engine migration

  What: evaluate replacing the JSON index with a more scalable store (SQLite FTS, Tantivy, or an external search service) for larger datasets.

  Why: a JSON file works for small projects but will become slow and memory-heavy at scale. A proper search engine will provide better performance, advanced queries, and durability guarantees.
