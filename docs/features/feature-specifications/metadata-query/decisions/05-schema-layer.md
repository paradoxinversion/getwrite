# Schema Layer

The data model behind every field that can be queried. Reconciles the
existing `metadataSchema` system with the query layer's needs.

Read `09-current-state.md` first. The existing schema CRUD is complete
and authoritative; this document covers how the query layer reads from
it, what intrinsic fields get merged in at query time, and the open
question of whether to introduce an observed-field layer.

## Decisions

### Existing field declaration (do not change)

`metadataSchema` already defines the canonical shape:

```
MetadataField {
  key: string             // slug [a-z0-9-]+
  label: string
  type: MetadataFieldType
  locked?: boolean
  options?: string[]      // select / multiselect
  refFolder?: string      // resource-ref / multi-resource-ref scope
  includeSubfolders?: boolean
  maxSelections?: number  // multi-resource-ref
  multiple?: boolean      // deprecated; legacy resource-ref
}

MetadataGroup {
  id: string
  label: string
  folderId?: string       // scope: group renders only for resources
                          // whose folderId === this
  fields: MetadataField[]
}
```

The query engine should treat this as read-only input. Schema mutation
goes through `metadata-schema.ts` and the `/api/project/metadata-schema`
HTTP API. Do not invent new declaration mechanisms.

### Field types — the closed enum

```
text                 — plain text; multiline determined by control choice
number               — numeric
date                 — ISO string
boolean              — yes/no
select               — single string from field.options (or
                       config.statuses for the locked `status` field)
multiselect          — string[] subset of field.options
resource-ref         — single ResourceRef = { id, name }
multi-resource-ref   — ResourceRef[]
```

No `enum`, no `ref<T>`, no `list<X>`. Use the names above everywhere.

### Group scoping is `folderId`, not `appliesTo`

A group has at most one `folderId`. When set, the group renders only
for resources in that folder (see `MetadataSidebar`). When unset, the
group renders for every text resource.

Resource-type scoping (e.g., "scenes only") reduces to a combination
of:

- The group's `folderId` (the "Characters" folder hosts character
  resources, etc.).
- The intrinsic `type` field at query time (`type is text`).

There is no array-of-types `appliesTo`. The query layer can support
"resources in folder X or descendant folders" via folder-tree traversal
at evaluation time, paralleling how `multi-resource-ref` already uses
`includeSubfolders` for candidate scoping.

### What's in the schema today

Two layers contribute to the field universe a project sees:

1. **Default schema** (`DEFAULT_METADATA_SCHEMA` in
   `default-metadata-schema.ts`) — hardcoded TS constant. Provides the
   `builtin-document` and `builtin-story-timeline` groups with locked
   fields (`synopsis`, `notes`, `status`, `pov`, `storyDate`,
   `storyDuration`, `storyEndDate`).
2. **Project extension** — anything added to
   `project.config.metadataSchema.groups` by the user via SchemaManager
   or the sidebar's `+ Add field`. May add new groups or new fields to
   existing groups.

`metadata-schema.ts` writes the merged result back to `project.json`,
so on disk the "default + extension" distinction is only meaningful
because of `locked: true` flags carried through from the default
constant. There is no separate "template-level" or "observed" layer
today.

### Intrinsic queryable fields — merged at query time

The query engine needs to filter on fields that are not in
`metadataSchema`. These live on the resource record or in
project-config sidecars, and the engine treats them as if they were
declared fields. They are not added to `metadataSchema` — they're
synthetic, computed during query evaluation.

| Intrinsic field | Type                                 | Source                                |
| --------------- | ------------------------------------ | ------------------------------------- |
| `type`          | `select` (text/image/audio/folder)   | `ResourceBase.type`                   |
| `folderId`      | `resource-ref` (target=folder)       | `ResourceBase.folderId`               |
| `wordCount`     | `number`                             | `TextResource.wordCount`              |
| `charCount`     | `number`                             | `TextResource.charCount`              |
| `createdAt`     | `date`                               | `ResourceBase.createdAt`              |
| `updatedAt`     | `date`                               | `ResourceBase.updatedAt`              |
| `statuses`      | `multiselect` (opts=config.statuses) | `ResourceBase.statuses`               |
| `tags`          | `multi-resource-ref`                 | `config.tagAssignments[resourceId]`   |
| `linkedFrom`    | `multi-resource-ref`                 | `BacklinkIndex[resourceId]` (sources) |
| `linksTo`       | `multi-resource-ref`                 | `BacklinkIndex` inverted lookup       |

The chip UI and AST treat these like any other field. The query
evaluator knows where to fetch each one.

### Tags are not a schema field — but they look like one through queries

Tags live in `config.tags` (list) and `config.tagAssignments` (map of
resourceId → tagId[]). `TagsSection.tsx` in the sidebar already renders
tag chips outside `metadataSchema`.

The query layer presents tags as the synthetic intrinsic field
`tags: multi-resource-ref<tag>`. This keeps the chip UI uniform without
forcing `metadataSchema` to absorb tags as a regular schema field
(which would break existing tag CRUD).

### Backlinks are derived from prose today

`backlinks.ts` resolves `[[wiki-link]]` syntax in prose and builds
`BacklinkIndex`. **It does not currently include `resource-ref` field
values.**

Two options for `linkedFrom` / `linksTo` to be useful as query
predicates:

a) **Extend `backlinks.ts`** to scan sidecars for `resource-ref` and
`multi-resource-ref` values and contribute them to the index. This
makes "scenes whose POV is Mara" queryable as
`linkedFrom includes mara-id` from Mara's perspective.

b) **Don't extend; query directly on `resource-ref` field values.**
`pov is mara` already works as a direct field predicate. The
`linkedFrom`/`linksTo` intrinsics would only surface prose-derived
links.

Recommendation: **option (a)**. Without it, the user has to know
whether a link was made in prose vs. metadata to ask the right
question — that's leaky abstraction. The change is local to the
backlinks extractor.

### Observed fields — open question, default NO

Today, every sidebar-renderable field must be declared in
`metadataSchema`. The system _will_ accept arbitrary keys in a sidecar
JSON (`Record<string, MetadataValue>`), but they're invisible in the
UI — never rendered, never queried.

The original design proposed an "observed" layer where ad-hoc keys
in sidecars auto-promote to a queryable but-not-yet-declared field.
This is a new concept. Weigh:

**Arguments for adding observed:**

- Lets writers jot ad-hoc metadata in flow without context-switching
  to SchemaManager.
- Provides a discovery path ("you've been writing `tone` on a lot of
  scenes — want to promote it?").
- Lowers the floor for query feature uptake.

**Arguments against:**

- The sidebar's existing `+ Add field` already creates a declared
  field in one click. The friction it eliminates may be small.
- Introduces a new layer (with inference, promotion UX, type-conflict
  handling) that doesn't exist today. Substantial scope.
- Risks duplicates (`tone`, `Tone`, `mood`) that the current
  declared-first model prevents by construction.

**Default position for the spec: out of scope for the initial query
feature.** The sidebar's `+ Add field` keeps declaring directly, with
augmentations from `07-metadata-sidebar.md` (autocomplete against
existing keys, type pre-selection from value, type inference at entry).
Revisit observed as a v2 feature if writers ask for it.

### Schema evolution — the existing CRUD already handles most cases

The schema CRUD operations in `metadata-schema.ts` already cover:

- **Adding a field** → `addField` (key uniqueness check, slug regex).
- **Removing a field** → `removeField` (refuses if locked). Currently
  hard-delete; doesn't touch sidecar values.
- **Renaming a label** → `renameField`.
- **Renaming a key** → `renameFieldKey` (migrates sidecars project-wide).
- **Changing type** → `changeFieldType` (does NOT migrate values; old
  values stay on disk in their old shape).
- **Updating options** → `updateFieldOptions` (does NOT validate
  existing values against new options).

Gaps the query feature work needs to fill:

- **Migration preview** before type changes / option removals — the
  Fields-panel work (`06-fields-panel.md`).
- **Deprecate-vs-clear distinction** on `removeField` — the same
  panel.
- **Query-breakage detection** — only relevant once queries exist.
- **Stale ref-target detection** — `ResourceRef.id === null` is the
  existing signal; the panel needs to surface counts.

### Validation integration — existing Zod is the truth

`MetadataFieldSchema` and `MetadataValue` in `schemas.ts` already
validate sidecars and project config at the boundary. Field-type-
specific value validation (`number` is a number, `date` parses, etc.)
runs through this layer.

The query engine should not introduce parallel validation. If it needs
a typed value for a predicate, it gets it from the existing parsed
sidecar.

The original design's "declarations generate Zod" idea was a guess.
The actual structure is: `MetadataValue` Zod is static and permissive
(any value of any allowed shape); field-type-specific narrowing happens
in the chip UI's value picker and at query evaluation. Don't
overengineer this.

## Open questions

- **Add observed fields, yes or no?** Default no above; revisit if
  writers' usage justifies.
- **`linksTo` / `linkedFrom` from `resource-ref` field values?**
  Recommended yes (option (a) above); requires backlinks extractor
  change.
- **Per-resource word goals vs. project-level `wordCountGoal`.**
  The goal-vs-actual feature (catalog #3) needs per-resource numbers,
  which means a new schema field on the relevant groups — not new
  infrastructure.

## Cross-refs

- Chip UI surface for this data model: `03-chip-ui.md`,
  `04-chip-internals.md`
- Augmentations to existing SchemaManager: `06-fields-panel.md`
- In-flow value editing against the existing sidebar:
  `07-metadata-sidebar.md`
- Creation paths and how the chip UI hands off to SchemaManager:
  `08-creation-paths.md`
- The truth: `09-current-state.md`
