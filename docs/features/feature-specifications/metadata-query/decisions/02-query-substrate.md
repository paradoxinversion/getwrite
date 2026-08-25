# Query Substrate

The core language and execution layer beneath all query UIs. New
infrastructure — none of this exists today. Read `09-current-state.md`
for the data model it queries against.

## Decisions

### Canonical form is an AST

All query UIs (chip UI, text mode, programmatic API) serialize to and from a
single AST. The AST is the source of truth; UIs are views.

### AST node types

- **Leaf predicates**: `eq`, `ne`, `lt`, `gt`, `gte`, `lte`, `in`, `exists`,
  `contains`, `matches`, `linksTo`, `linkedFrom`
- **Boolean combinators**: `and`, `or`, `not`
- **Splice nodes**: `ref` (references a saved query by id), `param`
  (parameter slot)

Set operations are not first-class nodes. They reduce to boolean
combinations of `ref` nodes:

- `A ∩ B` → `and(ref(A), ref(B))`
- `A ∪ B` → `or(ref(A), ref(B))`
- `A \ B` → `and(ref(A), not(ref(B)))`

### Composition primitives, in order of value

1. **Named saved queries.** A query has id, name, definition, and view
   preference. Smart folders are saved queries with a render mode.
2. **Set operations on saved-query refs.** Highest power-to-complexity ratio
   in the layer. Free once `ref` is an AST node.
3. **Parameters.** Reusable query templates: `scenesByCharacter(name)`,
   `chaptersInAct(n)`. Optional but pays for itself fast.

### Deliberately excluded

- **Piping / chaining** (`q1 | filter X | sort Y`). Author tools don't need
  it; balloons the surface.
- **Joins across refs** (`pov.tags includes "antagonist"`). Joins in filter
  UIs explode the surface area. Users who want them should declare a
  derived field on the resource or factor through a saved query. See
  `04-chip-internals.md`.
- **Window functions and computed-field DSL.** Tar pit.

### Persistence

Queries are files. Two scopes:

- **Project-local**: `meta/queries/<uuid>.query.json`. Rides in git,
  shareable per-project. The `meta/` directory already hosts sidecars,
  the inverted index (`meta/index/`), redirects, and the backlink
  index — a new `meta/queries/` subdirectory does not conflict.
- **User-global**: `~/.getwrite/queries/` (or equivalent).
  Cross-project queries. Later extension.

Start with project-local only.

A query file:

```json
{
  "id": "uuid",
  "name": "Act 2 scenes missing POV",
  "definition": {
    /* AST */
  },
  "view": { "kind": "table", "columns": ["title", "wordcount", "status"] }
}
```

### Execution model

- **Eager evaluation, aggressive invalidation.** Every sidecar write
  bumps a project-level metadata-revision counter. Saved queries cache
  against that counter; recompute on demand when the counter advances.
  Hook into the existing `indexer-queue.ts` background pipeline —
  sidecar writes already trigger reindex; this just adds query-cache
  invalidation to the same path.
- **Not reactive.** Do not build a reactive dataflow. Scale is small
  (thousands of resources max); cache misses are cheap.
- **Full-text predicates delegate to `inverted-index.ts`.** When the AST
  contains a `contains` / `matches` predicate on resource content, the
  query engine calls the existing `search()` function. The text index
  already implements title-boosted multi-term AND search.

### Concrete AST sketch

Field names match existing `metadataSchema` keys (`pov`, `status`,
`storyDate`) and intrinsic fields (`wordCount`, `type`, `folderId`,
`tags`, `linkedFrom`):

```json
{
  "op": "and",
  "children": [
    { "op": "eq", "field": "type", "value": "text" },
    { "op": "eq", "field": "folderId", "value": "<scenes-folder-uuid>" },
    { "op": "in", "field": "pov", "value": ["<mara-uuid>", "<jonah-uuid>"] },
    { "op": "lt", "field": "wordCount", "value": 500 },
    { "op": "not", "child": { "op": "ref", "id": "scenes-already-revised" } },
    { "op": "linksTo", "id": "<antagonist-uuid>" }
  ]
}
```

Notes:

- `pov` is `resource-ref` so the value is a UUID, not a name. The chip
  UI's typeahead resolves "Mara" to the underlying UUID before
  building this node.
- Folder-tree predicates (e.g., "in this folder or any descendant")
  are leaf predicates the engine resolves via the resource tree;
  `appliesTo`-style multi-type scoping is not in the language.

The AST is the entire filter language. Aggregation, projection, and
group-by live in the _view_ layer on top of the AST, not inside the filter
itself.

## Open questions

- Cycle detection in `ref` nodes (saved query A references B references A).
- How aggregation / group-by predicates compose with the AST — currently
  view-layer-only, but some flows may want them inline.
- Whether `param` resolution happens at query-definition time or
  invocation time.

## Cross-refs

- Chip-UI representation of this AST: `03-chip-ui.md`
- Field/operator/value semantics inside each chip: `04-chip-internals.md`
- Schema layer that feeds field metadata into AST predicates:
  `05-schema-layer.md`
