# Metadata Query — Implementation Tasks

Derived from `metadata-query-spec.md`. Estimates use story points (1, 2,
3, 5, 8). Each task is one focused session; tasks supporting things
outside the spec's functional requirements (e.g., sidebar conflict
states, source-layer badges) are not included — they are tracked as
follow-up work in the decisions docs.

> Note: Decision reference files can be found in @docs/features/feature-specifications/metadata-query/decisions

### Task 1: Define query AST types and Zod schema

**What:** TypeScript interfaces and matching Zod validators for the
query AST (leaf predicates, boolean combinators, splice nodes).
**Files:** `frontend/src/lib/models/query-ast.ts`, exports added to
`frontend/src/lib/models/schemas.ts`
**Done when:** All node shapes from `decisions/02-query-substrate.md`
have TS types and Zod schemas; a unit test round-trips a sample AST
through parse and serialize.
**Depends on:** none
**Estimate:** 2
**Notes:** Mirror `MetadataValue`'s recursive Zod pattern. Leaf
predicate values use the existing `MetadataValue` schema.
**Decision refs:**

- `02-query-substrate.md` § AST node types — canonical leaf, combinator,
  and splice node shapes
- `02-query-substrate.md` § Concrete AST sketch — sample JSON to use as
  the round-trip fixture
- `09-current-state.md` § MetadataValue (Zod-validated) — recursive
  union pattern to mirror
  **Done:** [x]

### Task 2: Intrinsic field registry

**What:** Module exposing the synthetic intrinsic fields (`type`,
`folderId`, `wordCount`, `createdAt`, `updatedAt`, `statuses`, `tags`,
`linkedFrom`, `linksTo`) with type metadata so the evaluator and chip
UI can enumerate them.
**Files:** `frontend/src/lib/models/query-intrinsics.ts`
**Done when:** Module exports a typed list; each entry has `key`,
`label`, `type` (`MetadataFieldType`), `source`
(`resource | sidecar | config | backlinks`), and a
`read(resource, project) => MetadataValue` accessor; covered by tests.
**Depends on:** none
**Estimate:** 3
**Notes:** `tags` reads from `config.tagAssignments`;
`linkedFrom` / `linksTo` from `BacklinkIndex`.
**Decision refs:**

- `04-chip-internals.md` § Intrinsic fields — merged in at query time —
  canonical type/source table for all nine fields
- `05-schema-layer.md` § Intrinsic queryable fields — merged at query
  time — same table with additional `charCount` entry and source
  annotations
- `05-schema-layer.md` § Tags are not a schema field — how `tags`
  maps to `config.tagAssignments`
- `09-current-state.md` § Backlinks — existing `BacklinkIndex` shape
  feeding `linkedFrom` / `linksTo`
  **Done:** [x]

### Task 3: Project metadata-revision counter

**What:** Add a `metadataRevision: number` field to `ProjectConfig`;
bump it on every `writeSidecar` and on every `metadata-schema.ts`
mutation.
**Files:** `frontend/src/lib/models/project-config.ts`,
`frontend/src/lib/models/sidecar.ts`,
`frontend/src/lib/models/metadata-schema.ts`,
`frontend/src/lib/models/schemas.ts` (Zod update)
**Done when:** Counter increments on each write path; round-trips
through `ProjectConfigSchema`; unit tests cover both write paths.
**Depends on:** none
**Estimate:** 2
**Notes:** Use `withMetaLock` for the sidecar path; `acquireLock` for
schema writes.
**Decision refs:**

- `02-query-substrate.md` § Execution model — specifies the revision
  counter and how sidecar writes trigger cache invalidation
- `09-current-state.md` § Storage layout — `acquireLock` vs
  `withMetaLock` ownership boundary
  **Done:** [x]

### Task 4: Backlinks extraction includes resource-ref values

**What:** Extend `computeBacklinks` to traverse each resource's sidecar
and add every `resource-ref` and `multi-resource-ref` target to the
backlink index.
**Files:** `frontend/src/lib/models/backlinks.ts`
**Done when:** A resource with `pov: { id: <uuid>, name: ... }`
appears as a backlink source for `<uuid>`; wiki-link behavior
unchanged; tests added for the new path.
**Depends on:** none
**Estimate:** 3
**Decision refs:**

- `05-schema-layer.md` § Backlinks are derived from prose today —
  explains the current gap and recommends option (a): extend the
  extractor
- `09-current-state.md` § Backlinks — existing `BacklinkIndex` shape
  and wiki-link scanning behavior
- `01-feature-catalog.md` § Backlink / reference graph queries (#8) —
  feature motivation
  **Done:** [x]

### Task 5: Query AST evaluator (no caching, no refs)

**What:** Implement `evaluate(ast, project) => UUID[]` walking the
AST. Leaf predicates dispatch by field source: declared fields via
sidecar, intrinsics via the registry. `contains` / `matches` on prose
delegates to `inverted-index.ts` `search()`.
**Files:** `frontend/src/lib/models/query-evaluator.ts`
**Done when:** Unit tests cover each predicate × type combination and
boolean composition; `ref` nodes throw "not implemented" pending
task 8.
**Depends on:** 1, 2, 4
**Estimate:** 5
**Decision refs:**

- `02-query-substrate.md` § AST node types — complete operator list
  the evaluator must dispatch
- `02-query-substrate.md` § Execution model — full-text delegation to
  `inverted-index.ts`; eager evaluation rationale
- `04-chip-internals.md` § Operator vocabularies, by field type —
  per-type operator semantics (e.g., `in the last` for dates)
- `05-schema-layer.md` § Intrinsic queryable fields — field-source
  dispatch table (resource record vs. sidecar vs. config vs. backlinks)
- `09-current-state.md` § Indexing pipeline — `inverted-index.ts`
  `search()` interface to delegate `contains` / `matches`
  **Done:** [x]

### Task 6: Saved-query persistence module

**What:** File-backed CRUD for saved queries at
`meta/queries/<uuid>.query.json`. Functions: `listQueries`,
`readQuery`, `writeQuery` (atomic under `withMetaLock`),
`deleteQuery`.
**Files:** `frontend/src/lib/models/saved-queries.ts`
**Done when:** All operations validate against the saved-query Zod
schema (using task 1's AST as the `definition`); concurrent writes
serialized by lock; tests pass.
**Depends on:** 1
**Estimate:** 3
**Notes:** A query file: `{ id, name, definition, view }`. The `view`
shape stays minimal for now.
**Decision refs:**

- `02-query-substrate.md` § Persistence — file path, JSON shape
  (`id`, `name`, `definition`, `view`), project-local-only scope
- `09-current-state.md` § Storage layout — `withMetaLock` ownership;
  existing `meta/` directory conventions
  **Done:** [x]

### Task 7: HTTP API routes for queries

**What:** Next.js App Router endpoints:
`POST /api/project/query/evaluate` for inline-AST evaluation,
`POST /api/project/query/saved` action-discriminated CRUD for saved
queries.
**Files:** `frontend/app/api/project/query/evaluate/route.ts`,
`frontend/app/api/project/query/saved/route.ts`
**Done when:** Endpoints Zod-validate request and response; smoke
tests exercise each action.
**Depends on:** 5, 6
**Estimate:** 3
**Decision refs:**

- `09-current-state.md` § Metadata schema system — action-discriminated
  `POST /api/project/metadata-schema` is the pattern to follow
  **Done:** [x]

### Task 8: Saved-query reference resolution in evaluator

**What:** Extend the evaluator to splice `ref` nodes by loading the
referenced saved query and substituting its AST. Detect cycles and
throw a clear, named error.
**Files:** `frontend/src/lib/models/query-evaluator.ts`
**Done when:** `{ op: "ref", id: <uuid> }` resolves transparently;
A→B→A cycles throw `QueryCycleError`; tests cover both.
**Depends on:** 5, 6
**Estimate:** 3
**Decision refs:**

- `02-query-substrate.md` § AST node types — `ref` (splice node) shape
  and set-operation reductions (∩/∪/\) that produce `ref` trees
- `02-query-substrate.md` § Open questions — cycle detection
  acknowledged as an open issue
- `00-overview.md` § Open questions — cycle detection in `ref` nodes
  **Done:** [x]

### Task 9: Cache layer keyed by metadataRevision

**What:** In-memory cache mapping saved-query id →
`(lastRevision, resultIds)`. On evaluate, compare current
`metadataRevision` to cached; recompute on mismatch.
**Files:** `frontend/src/lib/models/query-cache.ts`
**Done when:** Sequential evaluates return cached results;
intervening sidecar write forces recompute; tests verify both.
**Depends on:** 3, 5, 6
**Estimate:** 2
**Decision refs:**

- `02-query-substrate.md` § Execution model — revision-counter cache
  invalidation strategy; "not reactive" rationale
  **Done:** [x]

### Task 10: Redux slice for queries

**What:** New `querySlice.ts` following existing slice patterns
(transport-service, guards, async thunks). State: `savedQueries`
dict, `activeQuery` AST + ids, per-id `loading` / `error`.
**Files:** `frontend/src/store/querySlice.ts`,
`frontend/src/store/query-transport-service.ts`,
`frontend/src/store/queries-guards.ts`, store config update
**Done when:** Slice supports `loadSavedQueries`, `saveQuery`,
`deleteQuery`, `evaluateQuery`; tests pass; conforms to the existing
slice patterns (use the `getwrite-redux-slice` skill).
**Depends on:** 7
**Estimate:** 5
**Decision refs:**

- `02-query-substrate.md` § Persistence — saved-query JSON shape the
  slice state mirrors
  **Done:** [x]

### Task 11: Chip primitive — field/operator/value cell

**What:** React component for a single filter chip with three slots
(field, operator, value), polarity-in-operator dropdown, drag handle,
and overflow menu (duplicate/delete/move).
**Files:** `frontend/components/QueryBuilder/FilterChip.tsx` plus
styles
**Done when:** Storybook stories render the chip in every
`MetadataFieldType` variant; keyboard tab cycles through slots.
**Depends on:** 2
**Estimate:** 5
**Notes:** Reuse `components/common/UI/Chip` as the base shell.
**Decision refs:**

- `04-chip-internals.md` § Anatomy — three-slot layout, polarity-
  inside-operator design rationale
- `04-chip-internals.md` § Mid-chip mutations — field-change reset vs.
  operator-change preservation rules
- `04-chip-internals.md` § Keyboard / power-user behavior — Tab, Enter,
  ⌘D, ⌘C bindings
- `03-chip-ui.md` § NOT is polarity, not a combinator — why polarity
  lives in the operator slot
- `03-chip-ui.md` § Reordering and editing — drag-handle metaphor
- `09-current-state.md` § Reusable components for new UI —
  `components/common/UI/Chip` primitive to reuse
  **Done:** [x]

### Task 12: Type-driven operator menu

**What:** Component that renders the operator dropdown for a given
field type, using the menus from `decisions/04-chip-internals.md`.
**Files:** `frontend/components/QueryBuilder/OperatorMenu.tsx`
**Done when:** Each `MetadataFieldType` shows the correct operator
list with the `is empty` / `has any value` divider; selecting emits
a typed AST predicate stub.
**Depends on:** 1
**Estimate:** 3
**Decision refs:**

- `04-chip-internals.md` § Operator vocabularies, by field type —
  complete operator tables for all eight `MetadataFieldType` values;
  `is empty` / `has any value` divider rule
- `02-query-substrate.md` § AST node types — operator → AST `op`
  mapping (e.g., `is less than` → `lt`)
  **Done:** [x]

### Task 13: Type-driven value picker

**What:** Switch component rendering the value input appropriate to
the field type + selected operator. Reuses existing controls in
`components/Sidebar/controls/`. Adds a hover-preview popover for
`resource-ref` / `multi-resource-ref` values.
**Files:** `frontend/components/QueryBuilder/ValuePicker.tsx`, new
component for the ref hover preview
**Done when:** Storybook covers each `MetadataFieldType` including
`in the last` for dates, `between` for numbers, multi-select for
`is any of`, and the hover preview for refs.
**Depends on:** 2, 11
**Estimate:** 5
**Decision refs:**

- `04-chip-internals.md` § Value pickers, by type — per-type control
  mapping, `in the last` date pair, hover-preview as the differentiator
  over plain `ResourceRefInput`
- `04-chip-internals.md` § Validation — invalid-value chip error state,
  ambiguous typeahead, out-of-domain select value rendering
- `09-current-state.md` § Reusable components for new UI —
  `components/Sidebar/controls/` controls to reuse
  **Done:** [x]

### Task 14: Field picker dropdown

**What:** Dropdown listing every queryable field (existing
`metadataSchema` + intrinsics), grouped by source layer (builtin /
project / system), with search and source-badge. Shows
"Add a new field…" at the bottom when no result matches.
**Files:** `frontend/components/QueryBuilder/FieldPicker.tsx`
**Done when:** Picker enumerates correct fields per layer; search
filters by key + label; selecting emits a `{key, type}` pair.
**Depends on:** 2, 11
**Estimate:** 3
**Decision refs:**

- `03-chip-ui.md` § Field-picker scoping — three-layer grouping
  (Built-in / Project / System), source-layer badge, `folderId`
  annotation on project fields, "Add a new field…" affordance
- `05-schema-layer.md` § What's in the schema today — default schema
  groups and project-extension distinction
- `08-creation-paths.md` § Reverse navigability — "Edit in Schema
  Manager" hover affordance on picker rows
  **Done:** [x]

### Task 15: Group container with local combinator

**What:** Component wrapping a list of `FilterChip` with an
`All of` / `Any of` header dropdown, `+ Add condition` button,
within-group drag-reorder, and a per-group match-count subtotal.
**Files:** `frontend/components/QueryBuilder/FilterGroup.tsx`
**Done when:** Storybook shows a group with four chips; combinator
toggles; drag reorders; `+ Add condition` inserts a blank chip.
**Depends on:** 11
**Estimate:** 3
**Decision refs:**

- `03-chip-ui.md` § Two-level model — local combinator ("All of" /
  "Any of") dropdown design
- `03-chip-ui.md` § Layout — ASCII wireframe showing group header,
  chip list, `+ Add condition`, and hover subtotal
- `03-chip-ui.md` § Reordering and editing — drag handle at group
  border and chip level
  **Done:** [x]

### Task 16: Top-level query builder with global combinator

**What:** Component hosting a list of `FilterGroup` with the
between-group combinator pill (single AND/OR shared across all
joins), `+ Add group` button, and overall match-count footer.
**Files:** `frontend/components/QueryBuilder/QueryBuilder.tsx`
**Done when:** Storybook reproduces the layout from
`decisions/03-chip-ui.md` with two groups joined by OR; live
match-count updates as chips change.
**Depends on:** 5, 15
**Estimate:** 5
**Decision refs:**

- `03-chip-ui.md` § Two-level model — global combinator pill shared
  across all between-group joins; no mixed `g1 AND g2 OR g3`
- `03-chip-ui.md` § Layout — full ASCII wireframe with groups,
  between-group pill, `+ Add group`, and `[ N matches ]` footer
- `03-chip-ui.md` § Saved-query references are chips — `@query-name`
  chip variant to support in this surface
- `03-chip-ui.md` § Escape hatch — `advanced` tagging and read-only
  chip degradation
  **Done:** [x]

### Task 17: Text/AST escape hatch

**What:** Advanced-mode toggle on `QueryBuilder` with a JSON
textarea. Editable JSON re-parses into chip view if shape allows two
levels; otherwise the query is tagged `advanced` and chips render
read-only.
**Files:**
`frontend/components/QueryBuilder/AdvancedModeToggle.tsx`,
`frontend/components/QueryBuilder/QueryBuilder.tsx`
**Done when:** A 2-level AST round-trips through advanced mode and
back; a 3-level AST stays in advanced mode with chips disabled.
**Depends on:** 16
**Estimate:** 3
**Decision refs:**

- `03-chip-ui.md` § Escape hatch — 3+-deep tree handling, `advanced`
  tag, "edit in advanced mode" affordance; why not to grow the chip UI
- `02-query-substrate.md` § Canonical form is an AST — AST is source
  of truth; text mode is just another view
  **Done:** [x]

### Task 18: Cross-path dedup helper

**What:** Shared helper used by all three field-creation paths:
autocomplete suggestions over existing keys, fuzzy-match warning
("Did you mean `tone`?"), exact-name routing to the existing field.
Also derives slug from typed name and applies the existing
`[a-z0-9-]+` constraint.
**Files:** `frontend/src/lib/models/field-dedup.ts`
**Done when:** Helper exports `findExisting`, `slugifyName`,
`fuzzyMatch`; unit tests cover each routing decision.
**Depends on:** none
**Estimate:** 3
**Decision refs:**

- `08-creation-paths.md` § Deduplication safeguards — the three
  safeguards (autocomplete, exact-name collapse, fuzzy-match warning)
  that apply on every creation path
- `07-metadata-sidebar.md` § Improved `+ Add field` flow — UX spec for
  autocomplete, exact-match, and fuzzy-match interactions
- `09-current-state.md` § Metadata schema system — `allFieldKeys`
  uniqueness check in `metadata-schema.ts` that backs this at the API
  layer
  **Done:** [x]

### Task 19: Chip UI "Add a new field…" → prefilled SchemaManager

**What:** When the field picker shows no match, "Create a new field
[name]" opens `SchemaManager` (modal) with name + auto-derived label
prefilled. If the query has a folder predicate, prefill the new
field's group accordingly. After save, the new field is selected in
the picker and the half-built chip uses it.
**Files:** `frontend/components/QueryBuilder/FieldPicker.tsx`,
`frontend/components/SchemaManager/SchemaManager.tsx`
**Done when:** Click → SchemaManager opens prefilled; save returns
the new field id and the chip UI consumes it.
**Depends on:** 14, 18
**Estimate:** 3
**Notes:** `SchemaManager` needs an optional `prefill` prop +
`onCreated` callback.
**Decision refs:**

- `08-creation-paths.md` § Convergence model — prefill wire-up:
  name → label derivation, group default from folder predicate,
  post-creation toast copy
- `08-creation-paths.md` § The paths — chip UI uses SchemaManager
  form (not sidebar mini-form); commitment level rationale
- `06-fields-panel.md` § Entry point integration — SchemaManager
  must accept a prefill entry point from the chip UI
- `08-creation-paths.md` § Group placement — folder-predicate →
  group heuristic
  **Done:** [x]

### Task 20: Sidebar `+ Add field` augmentations

**What:** Replace `MetadataSidebar`'s current `+ Add field` button
with the inline mini-form: name input with autocomplete (via task
18), label auto-derived from name, type pre-selected from optional
value, group dropdown defaulting to the current folder's
folder-scoped group when present.
**Files:** `frontend/components/Sidebar/MetadataSidebar.tsx`,
new `frontend/components/Sidebar/AddFieldForm.tsx`
**Done when:** Button opens an in-place mini-form; autocomplete
works against existing schema keys; exact / fuzzy match focuses the
existing field; new field creation goes through the existing
`addMetadataField` thunk.
**Depends on:** 18
**Estimate:** 5
**Decision refs:**

- `07-metadata-sidebar.md` § Improved `+ Add field` flow — complete
  mini-form spec including Name / Label / Type / Optional value / Group
  fields, autocomplete behavior, exact-match and fuzzy-match routing
- `08-creation-paths.md` § Group placement — folder-context → group
  default heuristic
- `09-current-state.md` § Sidebar — current `+ Add field` behavior
  (generic key, first group) being replaced
  **Done:** [x]

### Task 21: Distinct-value enumeration utility

**What:** Function that scans every sidecar for a given field key
and returns `Map<value, count>` for migration previews, stale-ref
detection, and "used on N resources" displays.
**Files:** `frontend/src/lib/models/field-values.ts`
**Done when:** Returns correct distinct-value frequencies; handles
`ResourceRef` (id + name), `null`, and missing keys; unit tests
pass.
**Depends on:** none
**Estimate:** 3
**Decision refs:**

- `06-fields-panel.md` § Migration preview before destructive changes —
  identifies distinct-value enumeration as shared infrastructure for
  migration preview and stale-ref detection
- `06-fields-panel.md` § Stale ref-target detection — `id === null`
  handling; `[Show]` / `[Clear stale]` consumer
  **Done:** [x]

### Task 22: SchemaManager migration preview — changeFieldType

**What:** Intercept `changeFieldType` in `SchemaManager`. Before
dispatching, call task 21, render the migration UI from
`decisions/06-fields-panel.md` (distinct values, per-value
resolution, affected-files preview), commit only on Apply.
**Files:**
`frontend/components/SchemaManager/MigrationPreview.tsx`,
`frontend/components/SchemaManager/SchemaManager.tsx`,
`frontend/src/lib/models/metadata-schema.ts` (atomic write +
migration helper)
**Done when:** Type-change preview shows values + resolutions;
Cancel exits without changes; Apply migrates sidecars and updates
schema in one transaction under `withMetaLock`.
**Depends on:** 21
**Estimate:** 5
**Notes:** Mirror the existing `renameFieldKey` migration pattern.
**Decision refs:**

- `06-fields-panel.md` § Migration preview before destructive changes —
  full UI mockup with distinct-value table, per-value resolution
  dropdowns, affected-file preview, and three design principles
- `05-schema-layer.md` § Schema evolution — `changeFieldType` gap:
  currently writes without showing effects
- `09-current-state.md` § Schema Manager — lists what SchemaManager
  does NOT implement (migration preview)
  **Done:** [x]

### Task 23: SchemaManager migration preview — updateFieldOptions

**What:** Same pattern as task 22 for `select` / `multiselect`
option changes. Show which existing values fall outside the new
option list and offer normalize / clear / add-to-options.
**Files:** `frontend/components/SchemaManager/MigrationPreview.tsx`,
`frontend/components/SchemaManager/SchemaManager.tsx`
**Done when:** Removing an option shows affected resources and the
resolution menu; commit applies the right sidecar updates.
**Depends on:** 22
**Estimate:** 3
**Decision refs:**

- `06-fields-panel.md` § Migration preview before destructive changes —
  same three-principle preview pattern; option-removal is the
  `updateFieldOptions` variant
- `05-schema-layer.md` § Schema evolution — `updateFieldOptions` gap:
  does not validate existing values against new options
  **Done:** [x]

### Task 24: SchemaManager deprecate-vs-clear on removeField

**What:** Add `deprecated: boolean` to `MetadataField` (Zod, types,
metadata-schema CRUD). Update the remove flow to present Deprecate /
Clear / Cancel. Deprecated fields render muted in the chip UI's
field picker.
**Files:** `frontend/src/lib/models/types.ts`,
`frontend/src/lib/models/schemas.ts`,
`frontend/src/lib/models/metadata-schema.ts`,
`frontend/components/SchemaManager/SchemaManager.tsx`,
`frontend/components/QueryBuilder/FieldPicker.tsx`
**Done when:** Removing shows the dialog; Deprecate sets the flag
without touching sidecars; Clear runs sidecar migration to delete
the key; both reflected in the picker.
**Depends on:** 21
**Estimate:** 5
**Decision refs:**

- `06-fields-panel.md` § Deprecate vs. clear on field removal —
  full dialog mockup; Deprecate keeps values + adds `deprecated`
  flag; Clear migrates sidecars using `withMetaLock`
- `06-fields-panel.md` § Source-layer markers — muted "deprecated"
  badge in the schema manager field list
- `05-schema-layer.md` § Schema evolution — `removeField` current
  behavior (hard-delete, orphaned sidecar values)
  **Done:** [x]

### Task 25: Save-query dialog

**What:** Dialog launched from `QueryBuilder` that captures name,
optional view preference, and persists via task 10's `saveQuery`
thunk.
**Files:**
`frontend/components/QueryBuilder/SaveQueryDialog.tsx`
**Done when:** Saving a query writes the file, populates the
saved-query list in Redux, closes the dialog; rename / overwrite
handled.
**Depends on:** 10, 16
**Estimate:** 3
**Decision refs:**

- `02-query-substrate.md` § Persistence — query file shape (`id`,
  `name`, `definition`, `view`) and the minimal `view` for now
- `02-query-substrate.md` § Composition primitives — saved queries
  as smart folders; `view.kind` field
  **Done:** [x]

### Task 26: Saved-query smart-folder list

**What:** Render saved queries as a tree section ("Smart folders")
in `ResourceTree`. Selecting a smart folder evaluates the saved
query and shows results in `DataView`.
**Files:**
`frontend/components/ResourceTree/SmartFolders.tsx`,
`frontend/components/WorkArea/DataView.tsx`
**Done when:** Saved queries appear in the tree; selecting one
shows live results (UUIDs resolved to resources); clicking a result
navigates into it.
**Depends on:** 10, 16
**Estimate:** 5
**Decision refs:**

- `02-query-substrate.md` § Composition primitives — named saved
  queries as smart folders; `view` preference shapes `DataView`
  rendering
- `01-feature-catalog.md` § Saved queries as smart folders (#14) —
  feature motivation; `components/ResourceTree/` as the integration
  point
- `09-current-state.md` § Reusable components for new UI —
  `DataView` and `ResourceTree` surfaces
  **Done:** [x]

### Task 27: Saved-query references inside the chip UI

**What:** "Insert saved query reference" affordance on the field
picker. Inserts a special chip variant displaying `@<query-name>`,
mapped to a `ref` AST node.
**Files:** `frontend/components/QueryBuilder/FilterChip.tsx`,
`frontend/components/QueryBuilder/FieldPicker.tsx`
**Done when:** Inserting a saved-query chip evaluates via the
ref-resolution path (task 8); cycle-detection error surfaces with
friendly UI copy.
**Depends on:** 8, 11, 25
**Estimate:** 3
**Decision refs:**

- `03-chip-ui.md` § Saved-query references are chips — `@query-name`
  visual treatment, no field/operator/value triad, factoring-out as
  the escape valve for the two-level cap
- `02-query-substrate.md` § AST node types — `ref` splice node shape
  and set-operation semantics
  **Done:** [x]

### Task 28: AST evaluator unit tests

**What:** Comprehensive test suite for the query evaluator covering
each operator × field type, intrinsic fields, set operations via
refs, cache invalidation, and edge cases (empty values, missing
fields, deleted ref targets).
**Files:** `frontend/tests/query-evaluator.test.ts`
**Done when:** Test count and coverage reach an agreed threshold;
all tests pass under `pnpm test:ci`.
**Depends on:** 5, 8, 9
**Estimate:** 5
**Decision refs:**

- `04-chip-internals.md` § Operator vocabularies, by field type —
  complete operator × type matrix to drive test case enumeration
- `05-schema-layer.md` § Intrinsic queryable fields — nine intrinsics
  each needing at least one test
- `02-query-substrate.md` § AST node types — all leaf, combinator,
  and splice node shapes to exercise
- `04-chip-internals.md` § Validation — edge cases: deleted ref
  (`id: null`), ambiguous typeahead, out-of-domain select value
  **Done:** [x]

### Task 29: E2E — build a chip query and verify results

**What:** Playwright test that opens `QueryBuilder`, composes a
multi-condition filter against a seeded test project, and verifies
the resulting resource list rendered in `DataView`.
**Files:** `frontend/e2e/metadata-query.spec.ts`
**Done when:** Test passes via `pnpm test:e2e` against the
Storybook server.
**Depends on:** 16, 26
**Estimate:** 3
**Decision refs:**

- `03-chip-ui.md` § Layout — ASCII wireframe is the reference layout
  the test should reproduce (two groups joined by OR)
- `02-query-substrate.md` § Concrete AST sketch — sample multi-field
  query to use as the seed scenario
  **Done:** [ ]

## Summary

- **Total tasks:** 29
- **Total estimated effort:** 105 story points
- **Critical path:** 1 → 2 → 5 → 11 → 13 → 16 → 10 → 26
  (≈ 35 SP). The chip UI and evaluator have to land before saved
  queries and smart folders are usable.
- **Risks:**
  - **Task 5 (evaluator)** is central and integrates intrinsics,
    sidecar reads, and full-text delegation. Buggy here corrupts
    every downstream feature.
  - **Task 13 (value picker)** reuses many existing controls plus a
    new hover-preview component; integration surface is broad.
  - **Task 16 (query builder)** is the major UI assembly point;
    rerender / state-management mistakes here are costly.
  - **Tasks 22, 23, 24 (migration previews)** mutate sidecars in
    bulk; atomicity and lock discipline must mirror
    `renameFieldKey`'s existing pattern.
  - **Task 26 (smart folders)** touches `ResourceTree`, `DataView`,
    and Redux concurrently — coordinate carefully or split if
    estimates blow up.
