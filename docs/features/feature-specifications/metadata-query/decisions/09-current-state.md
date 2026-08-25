# Current State of the Metadata System

The authoritative reference for what exists today (as of this design
work). All other decision documents should be read in the context of
these facts — when the design says "observed field" or "appliesTo," it's
proposing something new on top of this baseline.

## What exists

### Storage layout

- `project.json` at the project root, containing `config.metadataSchema`,
  `config.tags`, `config.tagAssignments`, `config.statuses`,
  `config.editorConfig`, etc. Loaded and validated via
  `loadProject()` / `loadProjectConfig()` in `project-config.ts`.
- Sidecars at `meta/resource-<uuid>.meta.json`. Flat
  `Record<string, MetadataValue>` — keys correspond to field `key` in
  the schema. Read/write via `readSidecar` / `writeSidecar` in
  `sidecar.ts`.
- Inverted full-text index at `meta/index/inverted.json`
  (`inverted-index.ts`) — title-boosted, multi-term AND semantics over
  resource `plainText`.
- Backlink index persisted under `meta/` (`backlinks.ts`,
  `BacklinkIndex = Record<string, string[]>`), derived from
  `[[wiki-link]]` syntax in prose, not from metadata refs.
- Project lock via `acquireLock` (`locks.ts`) — per-project mutex on
  `project.json` writes.
- Sidecar lock via `withMetaLock` (`meta-locks.ts`) — per-project mutex
  on `meta/` writes.

### Metadata schema system — already complete

Stored at `Project.config.metadataSchema`:

```
MetadataSchema { groups: MetadataGroup[] }

MetadataGroup {
  id: string
  label: string
  folderId?: string   // group renders only for resources in this folder
  fields: MetadataField[]
}

MetadataField {
  key: string             // slug [a-z0-9-]+ enforced at API write time
  label: string
  type: MetadataFieldType
  locked?: boolean        // can't be removed/renamed/type-changed
  options?: string[]      // for select / multiselect
  multiple?: boolean      // deprecated; legacy resource-ref
  refFolder?: string      // ref candidate scope
  includeSubfolders?: boolean
  maxSelections?: number  // multi-resource-ref limit
}

MetadataFieldType =
  "text" | "number" | "date" | "boolean"
  | "select" | "multiselect" | "resource-ref" | "multi-resource-ref"
```

CRUD operations live in `src/lib/models/metadata-schema.ts`:
`addField`, `removeField`, `reorderFields`, `renameField`,
`updateFieldOptions`, `updateRefProperties`, `changeFieldType`,
`addGroup`, `removeGroup`, `reorderGroups`, `renameFieldKey`.
All run under the project lock. `renameFieldKey` also migrates sidecar
keys across the project after the schema write.

HTTP surface: `POST /api/project/metadata-schema`, action-discriminated
body (`add-field`, `remove-field`, `reorder-fields`, etc.).

### Default schema (hardcoded in `default-metadata-schema.ts`)

Group `builtin-document`:

- `synopsis` — text, locked
- `notes` — text, locked
- `status` — select, locked (options pulled at render time from
  `config.statuses`)
- `pov` — resource-ref, locked

Group `builtin-story-timeline`:

- `storyDate` — date, locked
- `storyDuration` — number, locked (minutes)
- `storyEndDate` — date, locked

The story-timeline group is the existing implementation of in-story
chronology (feature-catalog item #1). It's already declared and
writable, and `TimelineView` already consumes it. What's missing is
the query layer that can filter and aggregate on these fields.

### Resource types — closed enum

`text | image | audio | folder`. Not extensible. There are no
first-class "scene", "chapter", or "character" resource types — those
distinctions are made via _folder structure_ (e.g., a Characters
folder containing text resources), not via resource subtype.

This makes group-`folderId` scoping the _de facto_ resource-typing
mechanism today.

### MetadataValue (Zod-validated)

Recursive union from `schemas.ts`:

- `string`, `number`, `boolean`, `null`
- `string[]`, `number[]`, `boolean[]`
- `ResourceRef = { id: string | null, name: string }`
- `ResourceRef[]`
- `Record<string, MetadataValue>` (nested)

ResourceRef stores `id` plus a denormalised `name` so deleted-target
display survives. `id: null` means the target has been deleted but the
display name is preserved.

### Sidebar

`components/Sidebar/MetadataSidebar.tsx`:

- Only renders for `type === "text"` resources (empty state otherwise).
- Iterates over `schema.groups`; renders a group only if its `folderId`
  is unset or matches the resource's `folderId`.
- Locked built-in keys get specialised controls: `SynopsisInput`,
  `NotesInput`, `StatusSelector`, `POVAutocomplete`, `DateTimeInput`,
  `DurationInput`, `EndDateInput`.
- Other fields render generic controls by `type`: `GenericTextInput`,
  `NumberInput`, `DateTimeInput`, `BooleanToggle`, `SelectInput`,
  `ResourceRefInput`, `MultiResourceRefInput`.
- `TagsSection` renders as a separate collapsible section — tags are
  not a schema field.
- `+ Add field` button: dispatches `addMetadataField` to add a `text`
  field with key `field-<timestamp>`, label `"New Field"`, into the
  first group of the schema. **It declares a field in the schema.**
  There is no autocomplete, no inferred type, no observed-field path.

### Schema Manager

`components/SchemaManager/SchemaManager.tsx`. Already implements:

- Group list with collapse / reorder.
- Field rows with reorder, inline label rename, key rename (with
  confirmation modal), type change, options edit for select/multiselect,
  `multi-resource-ref` property edits via `updateMetadataRefProperties`.
- Delete confirmations.
- Locked fields rendered read-only.

What it does **not** implement:

- Migration preview when changing types or removing enum values.
- Deprecate-vs-hard-delete distinction.
- Query-breakage detection (no queries exist).
- Stale ref-target detection.
- Source-layer grouping beyond locked/unlocked (no "observed" tier
  exists).

### Search

`components/SearchBar/`:

- `SearchBar.tsx` — query input + results.
- `SearchFilterPanel.tsx` — folder dropdown, status chips, tag chips.
  Filter state: `SearchFilters = { folder?: string, status?: string,
tags?: string[] }`.

Not a chip-based boolean composition surface. Backed by the inverted
full-text index plus filter narrowing.

### Project types

`ProjectTypeSchema` declares: folders, default resources, default
subfolders, editor config, statuses, wordCountGoal. **It does not
declare metadata fields or groups.**

`DEFAULT_METADATA_SCHEMA` is hardcoded in TypeScript, shared by every
project regardless of type. To have project types declare schema groups
would require extending `ProjectTypeSchema` and the project-creator
flow — neither exists today.

### Backlinks

`src/lib/models/backlinks.ts`:

- Scans resource prose for `[[Target]]` syntax and UUIDs.
- Resolves via slug / name / aliases with an optional `meta/redirects.json`
  override map.
- Produces `BacklinkIndex = Record<string, string[]>` (target id →
  source ids).

**Backlinks are derived from prose, not from `resource-ref` field
values.** A `pov` field set to a character resource does not currently
contribute to the backlink index.

### Indexing pipeline

`src/lib/models/indexer-queue.ts` is a background queue that runs after
each sidecar write. Today it only feeds `inverted-index.ts`. Any
future metadata-query index (e.g., per-field value index, group-by
caches) could hook in via the same mechanism.

### Reusable components for new UI

- `components/Sidebar/controls/` — typed input controls for every
  field type already exist. Reusable in chip value pickers.
- `components/common/UI/Chip` — chip primitive exists.
- `components/WorkArea/Views/` — `DataView`, `OrganizerView`,
  `TimelineView`, `DiffView`, `EditView`. "Data" view is the obvious
  candidate surface for query results.

## What does NOT exist

- Any query AST or query persistence layer.
- Any boolean / chip-based filter composition (the SearchFilterPanel
  has flat chips, no AND/OR groups).
- Any saved queries / smart folders.
- Any observed-field concept — sidecar keys not in the schema are
  silently retained on disk but never rendered in the sidebar.
- Migration-preview UI on type / options / key changes.
- Project-type-declared schema fields.
- Field-level "applies to resource type" scoping (only group `folderId`
  exists).
- Metadata-derived backlink contribution (`resource-ref` values don't
  feed the backlink index).

## Implications for the design

Each implication maps to specific changes the rest of the decision
docs need to absorb:

1. **AST predicate vocabulary must match real field types**: `text`,
   `number`, `date`, `boolean`, `select`, `multiselect`, `resource-ref`,
   `multi-resource-ref`. No invented `string`, `enum`, `ref<T>`,
   `list<T>`.
2. **Group scoping is `folderId` (single folder)**, not `appliesTo`
   (set of resource types). Resource-type-scoped queries reduce to
   folder-scoped queries plus the intrinsic `type` field.
3. **Intrinsic queryable fields are net-new at the query layer**.
   They are not in `metadataSchema` — they'd be merged in at query
   evaluation time. Candidates: `wordCount`, `type`, `folderId`,
   `createdAt`, `updatedAt`, `statuses`, `tags`, `linkedFrom`,
   `linksTo`.
4. **Tags are not a schema field**. The query engine treats them as a
   synthetic `multi-resource-ref` predicate against
   `config.tagAssignments` during evaluation.
5. **Observed fields are a net-new layer**, not an existing one. Open
   question: do we want them? See `05-schema-layer.md`.
6. **`SchemaManager` already implements ~70% of the "Fields Panel"**.
   Augmentations needed: migration preview, deprecation distinction,
   query-breakage detection, optional observed-field section.
7. **`MetadataSidebar`'s `+ Add field` already exists** but declares
   into the schema. If we keep observed-fields out of scope, the
   existing behavior is roughly right but wants augmentation
   (autocomplete on key, type inference at entry, placeholder for unset
   declared fields).
8. **`resource-ref` field values should optionally feed the backlink
   index** if we want metadata-driven `linksTo` / `linkedFrom`
   predicates. That's a backlinks-extractor change, not a query-engine
   change.
