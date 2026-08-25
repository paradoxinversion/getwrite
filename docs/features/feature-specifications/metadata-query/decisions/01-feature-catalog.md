# Feature Catalog

Twenty candidate metadata-query features identified during ideation, scored by
value to creative writers and uniqueness within the writing-software landscape.
Sorted by combined score, highest first.

This is a _scope catalog_, not a commitment. The spec and task list draw from
this when deciding MVP and later phases.

## Scoring axes

- **Value (V)** — usefulness to creative writers: novelists, screenwriters,
  podcasters, etc. Scale 1-10.
- **Uniqueness (U)** — rarity in writing-focused tools (Scrivener, Ulysses,
  Novelist, etc.; not generic databases like Notion or Airtable). Scale 1-10.
- **Combined (V+U)** — ranking key.

## Features

### 1. Story-time vs document-order queries — V:9 U:10 (19)

Query and sort by _in-story chronology_ separately from document position.
"Scenes between Tuesday and Friday of story-week 3." Treats chronology as a
first-class queryable axis. Almost no writing tool supports this.

**Existing implementation**: the data side is already done. The locked
`builtin-story-timeline` group declares `storyDate` (date),
`storyDuration` (number, minutes), and `storyEndDate` (date) on every
project — see `09-current-state.md`. `TimelineView` already consumes
them. The missing piece is the _query layer_: predicates that filter
and sort on these fields independently of document order.

### 2. Character/entity co-occurrence queries — V:9 U:9 (18)

"Scenes where Alice and Bob both appear but Carol doesn't." Hugely valuable
for fiction, screenwriting, podcasting; effectively absent from author tools.

### 3. Word-count goal vs actual queries — V:9 U:7 (16)

"Chapters under 80% of their target." "Scenes more than 2× average length."
Treats per-resource goals/budgets as queryable fields.

### 4. Aggregation / group-by queries — V:8 U:8 (16)

"Total wordcount per POV character." "Scenes per act." Pivot-style summaries
across any metadata field.

### 5. Multi-view rendering of query results — V:8 U:8 (16)

Same query rendered as table, kanban, timeline, beat board, index-card grid,
or pin map. Query is one object; many views.

### 6. Character / entity extraction queries — V:8 U:8 (16)

Content-aware: "Every scene mentioning the Lighthouse." Built on extracted
entities (characters, locations, props), not just user-applied tags.

### 7. Full-text + metadata combined search — V:9 U:6 (15)

"Scenes tagged `flashback`, POV=Mara, containing the word 'rain'."

### 8. Backlink / reference graph queries — V:8 U:7 (15)

"All resources that link to the Antagonist's character sheet." Inverse
of what most writing tools surface. **Existing implementation**:
`backlinks.ts` already builds a `BacklinkIndex` from `[[wiki-link]]`
syntax in prose. It does _not_ currently include `resource-ref` field
values — extending it to do so is the recommended path (see
`05-schema-layer.md`).

### 9. Missing / null metadata queries — V:8 U:7 (15)

"Scenes without a POV character." "Resources missing a status." Quality-control
for long projects. Built on the universal `is empty` operator (see
`04-chip-internals.md`).

### 10. Bulk operations on query results — V:9 U:6 (15)

Re-tag, restage, retitle, move, mark for compile, batch-export — driven by a
query rather than manual selection.

### 11. Revision / staleness queries — V:7 U:8 (15)

"Chapters untouched in 30 days." "Resources with >10 revisions." Uses the
revision graph as queryable metadata.

### 12. Query-driven kanban / status board — V:8 U:7 (15)

A board defined by a saved query plus a group-by field. Moving a card mutates
metadata. Closer to a writer's brain than a Trello clone.

### 13. Boolean field filters (AND / OR / NOT, parenthesized) — V:10 U:4 (14)

Foundational. Implemented as the two-level chip UI; see `03-chip-ui.md`.

### 14. Saved queries as smart folders — V:9 U:5 (14)

Dynamic, always-current folders defined by a query. Appear in the tree
(`components/ResourceTree/`) alongside real folders. The existing
`SearchFilterPanel` is the closest precedent and would be the layer
this generalizes.

### 15. Query as filter for the tree / editor view — V:8 U:6 (14)

Toggle a query to dim or hide non-matching resources in the main tree.

### 16. Hierarchical / structural queries — V:8 U:6 (14)

"All descendants of Act 2." Tree-aware predicates over folder/parent
relationships.

### 17. Query composition / named sub-queries — V:7 U:7 (14)

`@activeCharacters = POV in (Mara, Jonah)` → reuse `@activeCharacters` in
many other queries.

### 18. Trend / temporal aggregation — V:7 U:7 (14)

"Wordcount per day for the past 30 days, grouped by project section."

### 19. Cross-project queries — V:6 U:8 (14)

"All resources tagged `pitch` across every project." Especially valuable for
writers running multiple manuscripts or recurring podcast formats.

### 20. Set operations between query results (diff / intersect / union) — V:6 U:8 (14)

"Scenes in Draft 2 that weren't in Draft 1." Treat saved queries as sets.
Falls out of the AST design for free; see `02-query-substrate.md`.

## Patterns to notice when sequencing implementation

- The top of the list (chronology, co-occurrence, goal gaps, entity
  extraction) is where this feature can leapfrog the category — business-tool
  databases don't model these concepts, and author-tool databases lack a
  query layer.
- The middle (full-text + metadata, backlinks, bulk operations, kanban)
  reaches parity with Obsidian's Dataview or Scrivener's collections,
  generalized.
- The foundational items (booleans, saved queries) score lower on uniqueness
  but are the substrate everything else needs — they should land first even
  though they're not the differentiators.
