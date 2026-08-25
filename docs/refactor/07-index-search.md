# Slice 07 — Index & Search

**Risk:** 🟡 **~2.5k lines.** Layer: core + store + api + UI.

## Scope

- **Core:** `indexer-queue.ts` (239), `inverted-index.ts` (256), `backlinks.ts` (234),
  `backlinks-watcher.ts` (100), `field-values.ts` (150)_, `field-dedup.ts` (143),
  `field-value-keys.ts` (5), `previews.ts` (107), `search-scoring.ts` (61),
  `search-snippet.ts` (59). _(shared with slice 04 — coordinate.)\*
- **Store:** `searchSlice.ts` (132), `search-transport-service.ts` (73).
- **API:** `app/api/project/[project-id]/search/route.ts` (313),
  `app/api/project/[project-id]/reindex/route.ts` (64).
- **UI:** `components/SearchBar/` (335), `components/common/ResourceCommandPalette.tsx` (198).

## Goal

The search route (313) and inverted-index/scoring can be clarified. Watch for
shared dedup/key logic across `field-*` modules that can be unified.

## Watch out for

- Index materialization writes `meta/index/` — output format must be stable
  (a `reindex` must produce equivalent indexes). Scoring order affects search
  results; lean on `search-scoring` / `search-route` tests.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/inverted-index unit/backlinks unit/backlinks-wiki unit/indexer-queue \
  unit/field-values unit/field-dedup unit/previews unit/search-scoring \
  unit/search-route searchBar
```

Then `pnpm knip` at repo root.
