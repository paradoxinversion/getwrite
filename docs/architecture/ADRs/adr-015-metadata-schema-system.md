# ADR-015: Project-Scoped Metadata Schema with Resource-Reference Fields

**Date:** 2026-05-13
**Status:** Accepted

## Context

GetWrite's `MetadataSidebar` has always been hardcoded: synopsis, notes, status, POV, and story
timeline fields exist because a developer added them. The only extension mechanism was the
`metadataSource` folder flag, which instructs the sidebar to generate a multiselect from the
resources in a given folder. That mechanism cannot express new field types, group custom fields
into logical sections, link resources to one another, or be managed without a code change.

Writers with complex story structures — multiple POVs, ensemble casts, intricate timelines,
worldbuilding taxonomies — have no way to model their own domain attributes. More critically,
there is no first-class way to link one resource to another (e.g., "this scene involves these
characters"). Without structured links, cross-resource querying (planned for a future release)
cannot be built on a meaningful foundation.

The storage layer is already flexible: every resource has a `userMetadata: Record<string,
MetadataValue>` field persisted in its sidecar file, and `MetadataValue` is a recursive union
type supporting strings, numbers, booleans, arrays, and nested objects. What is missing is the
schema layer that gives these arbitrary key-value pairs structure, type information, and UI
representation.

The existing `metadataSource` system on folders (used to source multiselect items from folder
contents) predates this ADR and would need to be replaced or unified by any new schema approach.

## Options Considered

### Option 1: Project-scoped metadata schema in `project.json`

A `metadataSchema` key is added to `project.json`'s `config` block. The schema declares named
groups of typed fields. Groups can be global (visible for every resource) or folder-scoped
(visible only for resources in a specific folder). The `MetadataSidebar` reads from this schema
and renders controls dynamically. Existing hardcoded fields migrate into the schema as locked
built-in entries.

**Pros:**

- Single source of truth; schema travels with the project file
- No new file to read; schema is already present when the project loads
- Enables cross-resource queries: all resources share the same field key namespace
- Backward-compatible: projects without a schema display no custom fields; `userMetadata` is
  already persisted and unaffected
- Folder-scoped groups naturally replace and generalise the existing `metadataSource` pattern

**Cons:**

- `project.json` grows in complexity; large schemas with many fields will inflate it
- Schema and resource data are coupled to the project load path (a slow schema parse affects
  project open time)
- Renaming a field key orphans existing `userMetadata` values with the old key

---

### Option 2: Separate `meta/metadata-schema.json` file

The schema lives in a dedicated file inside the project's `meta/` directory rather than in
`project.json`.

**Pros:**

- `project.json` stays lean
- Schema and project identity are independently versioned in git

**Cons:**

- A new read/write path must be added to the API surface
- The project hydration flow must perform an additional async read before the sidebar can render
- Deployment complexity: two files must remain in sync to represent one project configuration

---

### Option 3: Extend the existing `metadataSource` folder flag incrementally

Each folder declares its own metadata schema via `folder.json` fields. No project-level schema
concept is introduced. Folder resources show folder-declared fields; non-folder resources show
nothing custom.

**Pros:**

- Smallest surface area change
- Does not touch project.json

**Cons:**

- Cannot express global fields (fields visible for every resource regardless of folder)
- The schema is distributed across N folder files; cross-resource queries must aggregate N reads
- Built-in fields (synopsis, notes, etc.) would remain hardcoded and not migrate
- Replaces one ad-hoc system with a slightly less ad-hoc one

---

### Option 4: Ad-hoc per-resource fields with no project-level schema

Users add arbitrary key-value fields to individual resources directly in the sidebar. The field
has a name, a value, and an inferred or user-selected type. No project-level definition.

**Pros:**

- Maximum flexibility per resource
- No schema management UI required

**Cons:**

- Fields cannot be queried uniformly across resources (no shared key namespace)
- Users must re-invent the same field on every resource independently
- No resource-reference semantics possible without a project-level registry
- Essentially recreates an untyped JSON object editor, which writers will not find intuitive

## Decision

Adopt a project-scoped metadata schema stored in `project.json` under `config.metadataSchema`
(Option 1). The schema defines typed field groups — some global, some folder-scoped — that drive
`MetadataSidebar` rendering. All existing hardcoded fields migrate into the schema as locked
built-in entries. A new `resource-ref` field type enables direct resource-to-resource links.

Option 1 was chosen because it is the only approach that simultaneously satisfies:
(a) a shared key namespace enabling future cross-resource queries,
(b) a natural home in the already-loaded project document,
(c) a credible migration path for existing fields,
(d) the ability to express the `resource-ref` type which is central to the long-term data
connection vision.

### Schema structure

```typescript
interface ResourceRef {
  id: string | null; // UUID when resolved; null when the referenced resource is deleted
  name: string; // display name — always preserved even when id is null
}

type MetadataFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multiselect"
  | "resource-ref";

interface MetadataFieldDef {
  id: string; // UUID — stable across renames
  key: string; // slug used as userMetadata key
  name: string; // display label
  type: MetadataFieldType;
  options?: string[]; // select / multiselect only
  targetFolders?: string[]; // resource-ref only — folder IDs to source from
  multiple?: boolean; // resource-ref only — allow multiple selections
  locked?: boolean; // built-in migrated fields cannot be deleted from UI
  orderIndex: number;
}

interface MetadataGroup {
  id: string;
  name: string;
  fields: MetadataFieldDef[];
  orderIndex: number;
}

interface MetadataSchema {
  globalGroups: MetadataGroup[];
  folderSchemas?: Array<{ folderId: string; groups: MetadataGroup[] }>;
}
```

Note: `folderSchemas` keys on `folderId` (UUID), not `folderSlug`, so renaming a folder does
not break its schema.

### Resource-reference value format

`resource-ref` field values are stored as `ResourceRef` objects (single) or `ResourceRef[]`
(multiple) in `userMetadata`. The `name` field is always the display string — it is the source
of truth for readability and string-based querying. The `id` field is the live pointer and may
be `null` if the referenced resource has been soft-deleted.

This design ensures that deleting a referenced resource degrades the link gracefully: the
connection remains meaningful ("this scene once involved Alice") rather than silently
disappearing.

### Built-in field migration

The existing hardcoded fields map to locked schema entries as follows:

| Old field     | Schema key    | Type         | Group          |
| ------------- | ------------- | ------------ | -------------- |
| synopsis      | synopsis      | text         | Document       |
| notes         | notes         | text         | Document       |
| status        | status        | select       | Document       |
| pov           | pov           | resource-ref | Document       |
| storyDate     | storyDate     | date         | Story Timeline |
| storyDuration | storyDuration | number       | Story Timeline |
| storyEndDate  | storyEndDate  | date         | Story Timeline |

Migration is lazy: if a project has no `metadataSchema` in its config, the default schema is
injected in Redux on first sidebar load. The existing `userMetadata` values for these keys are
already in the correct format for all types except `pov` (see POV migration below).

**POV migration:** The `pov` field currently stores a character name string. On the first edit
of a resource's POV field after migration, the system attempts to resolve the stored string to
a UUID by name-matching against resources in the folder referenced by `targetFolders`. If a
match is found, the value is rewritten as `{ id: UUID, name }`. If not, it becomes
`{ id: null, name: oldString }`. No destructive batch migration occurs.

### Deletion and referential integrity

When a resource is soft-deleted (`softDeleteResource` in `trash.ts`), the system performs an
asynchronous sweep of all project resource sidecars. For any `resource-ref` field (identified
by reading the project's `metadataSchema`) whose value contains the deleted resource's UUID, the
value is updated from `{ id: UUID, name: "Alice" }` to `{ id: null, name: "Alice" }`.

The name string is never erased. A stale reference with `id: null` is still queryable by the
`name` string and signals to the user that the original connection existed even if the target
file is gone.

### Schema editing surfaces

Full schema management (add/remove/reorder groups, change field types, delete fields) lives in a
new "Metadata" section in Project Settings. A lightweight "Add field" shortcut in the
`MetadataSidebar` footer allows quick field creation; it delegates to the same schema write path
and immediately opens the new field for data entry. The sidebar itself is values-only for
existing fields.

### API surface

- Schema reads and writes are handled by extending the existing project config API route rather
  than introducing a new endpoint.
- Resource value reads and writes are unchanged; they continue to use
  `/api/resource/[id]/sidecar`.
- The referential-integrity sweep on deletion is an internal function invoked from the
  soft-delete flow, not a separately exposed endpoint.

## Consequences

### Positive

- `MetadataSidebar` is no longer hardcoded; adding a new field type or group requires no code
  change after the schema layer is in place.
- All metadata fields share a single key namespace in `userMetadata`, enabling uniform
  cross-resource queries in a future release.
- Resource-to-resource links are first-class values, not approximations via string matching
  against resource names.
- The existing `metadataSource` folder flag pattern is superseded and can be removed in a
  follow-up; one metadata concept replaces two.
- Soft-deletion now preserves the semantic meaning of broken links rather than silently losing
  them.
- Writers can model their own domain — characters, items, locations, themes, arcs — without
  any configuration file editing or developer involvement.

### Negative

- `project.json` grows in size proportionally to the schema. A project with 50 custom fields
  across 10 groups adds meaningful JSON overhead to every project load.
- The sidebar rendering model is more complex: it must determine which groups are visible for a
  given resource based on both global scope and folder scope, and resolve `ResourceRef` UUIDs
  to names at render time.
- The deletion sweep adds latency to the soft-delete operation. For projects with hundreds of
  resources and many `resource-ref` fields, this could be noticeable; it runs asynchronously
  but must complete before the project state is considered consistent.
- Field key renames are a breaking change: existing `userMetadata` values keyed under the old
  slug become invisible to the schema until a migration utility is run. No such utility is
  designed in this ADR.
- The POV lazy migration is lossy for characters who have been renamed since the POV value was
  first written; the string match will fail and the value will remain `{ id: null, name }`.
- Locked built-in fields (synopsis, notes, etc.) cannot be removed from the schema even by
  users who do not use them; they occupy vertical space in the sidebar regardless.

### Neutral

- The `metadataSource` flag on `FolderSchema` and `ProjectTypeFolderSchema` becomes redundant.
  It will remain valid in persisted folder data until explicitly removed in a follow-up cleanup.
- Project-type spec files (`*.project-type.json`) continue to work unchanged; they seed folder
  structure, not metadata schema, so no project-type migration is needed.
- The `backlinks.ts` indexing system is not directly modified by this ADR but is a candidate
  for extension once `resource-ref` fields are live (backlinks could index reference fields
  as well as in-document links).

## Revisit Conditions

Revisit this decision if:

- Project load times for large projects (200+ resources, 50+ schema fields) increase by more
  than 300ms due to `project.json` parse overhead, in which case a separate schema file
  (Option 2) or lazy schema load becomes warranted.
- A use case emerges where the same field must appear under different keys in different contexts
  (e.g., the same "Location" reference field has different valid targets in different folders),
  which the current flat `key` namespace does not support cleanly.
- Writers need schema portability across projects (a shared "novel schema" they apply to
  multiple projects), which would require a schema export/import or template mechanism that
  does not exist today.
- The deletion sweep proves too slow for large projects and a dedicated backlink index
  (`backlinks.ts`) cannot be adapted to serve it, requiring a different referential-integrity
  strategy.
