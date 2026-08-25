# GetWrite Roadmap

Forward-looking product direction, organized by horizon (**Now → Next → Later → Exploring**) and grouped by capability theme within each horizon. Each entry notes its current build state and links to relevant docs.

Horizons reflect priority and readiness, not committed dates. This document covers **features** only — engineering/tech-debt work lives in [tech-debt.md](tech-debt.md), and a full classified inventory of the feature surface is in [getwrite.features.md](../specs/product/getwrite.features.md).

---

## Now — In Progress

### Authoring & Editor

- **Organizer view filters** — Filtering of Organizer cards by status, character, location, and word count. _Status: not started. Verified against code 2026-08-24 — `OrganizerView.tsx` has no filter state or filter UI; its only control is a show/hide-bodies toggle. This entry previously claimed status and folder filtering shipped; that was inaccurate._ → [user/features.md](user/features.md)

---

## Next — Committed

### Versioning & History

- **Trash recovery UI** — A visual trash bin to browse, restore, and permanently purge soft-deleted resources. _Status: model complete (`restoreResource`/`purgeResource` in `trash.ts`), UI not started._ → [revisions.md](features/revisions.md)

---

## Later — Planned

### Templates & Scaffolding

- **Template CLI expansion** — Additional template commands: `save-from-resource`, `parametrize`, `create --vars` (with `--dry-run`), `inspect`, `export`, `import`, and `validate`. _Status: partial — `save`, `create`, `duplicate`, and `list` shipped._ → [cli.md](features/cli.md)

### Platform

- **Android packaging and distribution** — Wire a real Gradle build and produce a distributable Android artifact. _Status: not started. The app itself runs in-process; `pnpm --filter getwrite-android build` is still a `console.log` placeholder and CI runs only that._

### Search & Discovery

- **Scalable search backend** — Evaluate a durable backend (SQLite FTS, Tantivy) to replace the JSON inverted index for large projects where it becomes a bottleneck. _Status: under evaluation._ → [indexing.md](features/indexing.md)

---

## Exploring — Ideas

### Platform

- **Mobile / tablet responsive layout** — Progressive sidebar reduction and a mobile-first writing surface. _Status: partial implementation exists._

### Collaboration

- **Multi-device sync for a single writer** — The same writer reaching the same projects from more than one device. _Status: hosted foundations shipped (tenancy, auth, object store, E2EE); the offline conflict/merge model is undesigned._ → [../specs/product/getwrite.md](../specs/product/getwrite.md)

  _Multi-user collaboration (two people editing one project) was a former entry here. As of 2026-08-24 it is a **permanent non-goal**, not a future maybe — see the product spec's Non-goals._

---

## Recently Shipped

A curated snapshot of recent highlights — not an exhaustive changelog.

- **End-to-end encryption** — Per-project opt-in encryption on desktop and native Android: a workspace keyring with a lock/unlock session, sealed file bodies, crash-safe resumable conversion in both directions, and a plaintext export escape hatch. Deliberately excluded from the hosted deployment by a fail-closed server-side gate. → [ADRs/adr-022-end-to-end-encryption-via-storage-adapter-decorator.md](architecture/ADRs/adr-022-end-to-end-encryption-via-storage-adapter-decorator.md)
- **Native Android app (in-process)** — The whole data layer collapses in-process on native with no HTTP round-trip, over a real Capacitor filesystem bridge. Shipped as code; packaging and distribution are not done (see Later). → [ADRs/adr-021-native-android-via-capacitor-in-process.md](architecture/ADRs/adr-021-native-android-via-capacitor-in-process.md)
- **Image and audio resources** — Add image and audio resources through the UI, with drag-and-drop into the editor, a media viewer, and ingest-time metadata.
- **Full-text search** — Cross-resource search with folder/status/tag filtering, backed by the inverted index. → [indexing.md](features/indexing.md)
- **Tags** — Project-scoped tag management plus per-resource assignment from the Metadata sidebar. → [tags.md](features/tags.md)
- **Metadata queries & smart folders** — Saved queries rendered as folder-like rows in the resource tree. → [user/metadata-queries.md](user/metadata-queries.md)
- **Compile & export** — Manuscript compilation to PDF, DOCX, and plain text with preview. → [user/compiling.md](user/compiling.md)
- **Timeline view** — Resources positioned chronologically by `timeframe` metadata.
- **Diff view** — Side-by-side revision comparison.
- **Config-driven editor toolbar** — Toolbar generated from typed command descriptors.
- **Revision system & soft-delete** — Versioned snapshots, pruning, canonical invariant, preserve flag, and `.trash/` soft-delete. → [revisions.md](features/revisions.md)
- **Backlinks** — Wiki-link parsing and a maintained reverse-reference index. → [indexing.md](features/indexing.md)
- **Indexer hardening** — Promise-based drain (`waitForDrain`), graceful shutdown, opt-in durable writes, and a `reindex` CLI command. → [indexing.md](features/indexing.md), [cli.md](features/cli.md)

---

## Related Docs

- **Tech debt & infrastructure** — [tech-debt.md](tech-debt.md)
- **Feature catalog (classified inventory)** — [getwrite.features.md](../specs/product/getwrite.features.md)
