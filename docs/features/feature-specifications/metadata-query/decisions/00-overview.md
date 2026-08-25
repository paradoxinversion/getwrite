# Metadata Query — Design Decisions

This folder captures design decisions for the metadata query feature.
The spec and task list reference these documents; implementation should
treat them as the authoritative record of the "why" behind each choice.

**Start with `09-current-state.md`** for what already exists in the
codebase. The design documents (02-08) are reconciled to that baseline —
they describe augmentations and net-new layers, not greenfield work.

## Document map

- `01-feature-catalog.md` — Candidate scope: 20 query features scored by
  value to creative writers and uniqueness within the writing-software
  landscape.
- `02-query-substrate.md` — The AST, composition primitives (named
  queries, set operations, parameters), persistence, and execution
  model.
- `03-chip-ui.md` — Two-level filter-chip UI with explicit AND/OR
  combinators and a text/AST-mode escape hatch.
- `04-chip-internals.md` — Field/operator/value triad; operator menus
  and value pickers keyed off the existing `MetadataFieldType`.
- `05-schema-layer.md` — How the query layer reads the existing
  `metadataSchema`, how intrinsic fields are merged in at query time,
  and the open question of observed fields.
- `06-fields-panel.md` — Augmentations to the existing `SchemaManager`
  component: migration preview, deprecation, source-layer markers,
  stale-ref detection.
- `07-metadata-sidebar.md` — Augmentations to the existing
  `MetadataSidebar`: placeholders for unset fields, improved `+ Add
field` flow, conflict states, cross-link to SchemaManager.
- `08-creation-paths.md` — How the three field-creation entry points
  (sidebar, SchemaManager, chip UI) converge.
- `09-current-state.md` — The authoritative reference for what the
  metadata system already does today.

## Architectural principles

1. **The existing system is the foundation.** `metadataSchema`,
   `metadata-schema.ts`, `SchemaManager`, `MetadataSidebar`,
   `sidecar.ts`, `tags.ts`, `backlinks.ts`, the
   `/api/project/metadata-schema` API — all stay. The query feature
   builds on top.
2. **Use the existing type system.** `MetadataFieldType` is the only
   vocabulary: `text`, `number`, `date`, `boolean`, `select`,
   `multiselect`, `resource-ref`, `multi-resource-ref`. No invented
   names.
3. **The chip UI is a thin shell over the type system.** Operator
   vocabularies and value pickers derive mechanically from
   `MetadataFieldType`.
4. **Intrinsic fields are synthetic at query time.** Resource-level
   facts (`type`, `wordCount`, `createdAt`, `tags`, `linkedFrom`,
   etc.) are presented as if they were declared fields, but they're
   not added to `metadataSchema`.
5. **Migrations are previewed, never silent.** Type changes, option
   removals, and field removals show their full effect before commit
   — this is the main gap in the existing `SchemaManager`.
6. **Three creation paths, one declaration model.** All three produce
   a declared field; the existing `metadata-schema.ts` uniqueness and
   slug-regex validation is the single source of truth.

## Open questions

- **Add observed fields as a new layer?** Default no (see
  `05-schema-layer.md`). The existing declared-only model has lower
  entropy; observed adds inference, promotion, conflict-resolution
  surface. Revisit as v2 if writers ask for it.
- **Should `resource-ref` field values feed the backlink index?**
  Recommended yes (`05-schema-layer.md`). Required for `linksTo` /
  `linkedFrom` query predicates to capture metadata-driven references,
  not just prose `[[wiki-links]]`.
- **Per-resource word-count goals.** Feature-catalog item #3 needs
  per-resource numbers; today only project-level `wordCountGoal`
  exists. A new schema field is the obvious answer but worth
  confirming.
- **Multi-select behavior in the metadata sidebar** when multiple
  resources are selected in the tree — batch-edit, show common-values-
  only, or refuse?
- **Cycle detection in `ref` AST nodes** (saved query A references B
  references A).
- **How aggregation / group-by predicates compose with the AST** —
  currently treated as a view-layer concern, not part of the filter
  AST.
- **`param` (parameterized query) resolution timing** — at
  query-definition time or invocation time.
