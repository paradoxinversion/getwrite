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

- The index format is intentionally simple (JSON). For larger projects or better performance, consider moving to a binary/LMDB-backed store or using a search engine (e.g., SQLite FTS, Tantivy, or Elastic).
- Keep the tokenization and ranking logic in `inverted-index.ts` consistent with search UI expectations.

Contact

- For questions about design decisions, see `specs/002-define-data-models` and the commit history on branch `002-define-data-models`.
