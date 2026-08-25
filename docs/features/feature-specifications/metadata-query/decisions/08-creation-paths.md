# Field Creation Paths

Where users can create a schema field, and how the entry points
converge.

Read `09-current-state.md` first. Today there are two creation paths;
the query feature adds a third.

## Decisions

### The paths

| Path                          | What it creates                                                      | Status  |
| ----------------------------- | -------------------------------------------------------------------- | ------- |
| MetadataSidebar `+ Add field` | Declared field (in first group, type `text`, generic key)            | Exists  |
| SchemaManager `+ Add field`   | Declared field with full control (group, type, label, options, etc.) | Exists  |
| Chip UI "Add a new field…"    | Declared field with prefilled name and inferred default group/type   | **New** |

All three produce **declared fields** in `metadataSchema`. There is
no observed-field tier (see `05-schema-layer.md` for the open question
and `07-metadata-sidebar.md` for the rationale).

Commitment is roughly correlated with form weight:

- **Sidebar** is the lightest. Quick declaration of a field on the
  fly. Today it's too light (generic key, fixed group, fixed type);
  the augmentations in `07-metadata-sidebar.md` add autocomplete,
  type inference, and group selection.
- **SchemaManager** is the heaviest. Full configuration surface for
  schema-level decisions.
- **Chip UI** is intermediate. The writer's intent is "filter by
  something," which implies the field should exist multi-resource —
  so the chip UI hands off to a SchemaManager-style form rather than
  the sidebar-style mini-form.

### Convergence model

The chip UI's "Add a new field…" reuses the SchemaManager form (or a
compact embedded version of it), prefilled from chip context:

```
Chip UI field picker — typed "tension"
─────────────────────────────────────
  No matches.
  + Create a new field "tension"
                                    ↓
  Opens (modal or sheet) with:
    name = "tension"
    label = "Tension"      (auto-derived)
    type = text            (default, editable)
    group = first project-extension group, else "Plot" if exists,
            else first group overall
    folderId = inherited from group choice
                                  [Cancel] [Create]
```

After creation:

- Chip UI returns to the picker with the new field selected; the
  half-built chip gets the new field's identity.
- A small toast confirms creation and reminds the user where to fill
  values: "Created `tension` in group Plot. Add a value from any
  text resource's metadata panel."

Effectively three entry points but two creation UIs: the sidebar's
inline mini-form and the SchemaManager full form (also opened by the
chip UI).

### Deduplication safeguards

The same three safeguards apply on **every** creation path:

1. **Autocomplete against existing field keys** (across all groups,
   including locked builtins). Typing `to` surfaces `tone`. Selecting
   joins / focuses the existing field, doesn't create a new one.
2. **Exact-name match collapses to existing.** Pressing Enter on
   literal `tone` when `tone` already exists routes to the existing
   field rather than creating a duplicate. The schema CRUD's existing
   uniqueness check (`allFieldKeys(schema).includes(field.key)` in
   `metadata-schema.ts`) backs this up at the API layer, but the UI
   should match before submitting.
3. **Fuzzy-match warning.** Typing `Tone` (capitalized) when `tone`
   exists shows "Did you mean `tone`?" with a one-click switch.
   Critical because the slug regex `[a-z0-9-]+` _would_ reject
   `Tone` outright, but a warning is more helpful than a validation
   error.

### Labeling consistency

All three paths use the verb **"Add field"** (sidebar) or the action
**"Create a new field"** (chip UI's affordance when no match exists).
Avoid different vocabulary per path — "add" / "declare" / "create"
all mean the same operation from the writer's perspective; surfacing
the distinction leaks implementation.

What differs is form weight, which is visual: sidebar is a few inputs,
SchemaManager is a full form.

### Group placement — the "where does this go?" problem

The sidebar today always lands new fields in the first group. The
chip UI defaults to "first project-extension group, else first
group." Both are workable defaults but neither is ideal.

Better heuristic for both paths:

- If the user is inside the sidebar of a resource in folder `F`, and
  a group exists with `folderId === F`, default to that group.
- If the chip UI's current query has a folder predicate, default to
  the group with that `folderId`.
- Otherwise default to the most-recently-used project-extension
  group.
- Always show the group dropdown so the user can override.

This makes group placement match the writer's current context without
forcing them to think about it.

### Group `folderId` is single-folder — no inline expansion

The original design proposed expanding `appliesTo` inline when a user
adds a field to a resource type outside the field's scope. That doesn't
map to the existing system, where:

- Each field belongs to exactly one group.
- Each group has at most one `folderId`.

If a user is in folder `B` and wants to add a value to a field that
lives in a group scoped to folder `A`, the field isn't even visible in
the sidebar. The escape hatches:

- Move the field to a different group whose `folderId === B` (or unset
  `folderId`). This is a schema-level edit, properly done in
  SchemaManager.
- Remove `folderId` from the group entirely, making it apply
  everywhere.
- Create a parallel field in a folder-`B`-scoped group.

None of these are inline-friendly. The simplest behavior: if a writer
attempts to add a field whose name matches an existing field that
isn't visible here, surface a message:

```
A field named `tone` already exists in group "Plot" (Scenes only).

Options:
  • Use `tone` here too  (removes Plot group's folder scope)
  • Create a separate field in this group's scope
  • Cancel
```

The first option is the schema-level edit; the second creates a
parallel field (bad — undermines uniqueness); the third is the safe
out. Default selection: the first, with a confirmation.

This is more conservative than the design's "Extend appliesTo" pattern
because the existing `folderId` is binary, not a set.

### Reverse navigability — every surface knows about the others

- **From the sidebar**: hovering or right-clicking a field name
  surfaces "Edit in Schema Manager", "Show resources with this field
  set", "Show resources with this field empty" (the last two require
  the query feature).
- **From SchemaManager**: each field row gets a "Used on N resources"
  count and link (requires distinct-value indexing — see
  `06-fields-panel.md`).
- **From the chip UI field picker**: each field shows a source-layer
  badge (`builtin` / `project`) and hovering reveals
  "Edit in Schema Manager".

These cross-references let the user navigate the trio without
learning a mental model of the schema architecture.

### Failure modes mitigated

- **Sidebar's generic key (`field-1234567890`)**: replace with key
  derived from the user-entered name (slugified). Existing slug regex
  validation already applies.
- **Chip UI's default `folderId`**: pre-populate from the current
  query's folder filter (if any). If none, the field's group inherits
  the chosen group's `folderId` — which may be unset, meaning the
  field applies everywhere.
- **User creates field, can't figure out where to add a value**:
  the post-creation toast tells them which group + folder scope the
  field lives in. From the SchemaManager-form path, the toast also
  offers "Open a [resource] to set a value."
- **Cross-path race conditions**: existing `acquireLock` serializes
  schema writes; sidebar / SchemaManager / chip-UI paths all dispatch
  through the same Redux thunks against `/api/project/metadata-schema`,
  so there's a single source of truth.

## Cross-refs

- Sidebar's `+ Add field` flow: `07-metadata-sidebar.md`
- Chip UI's field picker and "Add a new field…" affordance:
  `03-chip-ui.md`, `04-chip-internals.md`
- SchemaManager form reused by the chip UI: `06-fields-panel.md`
- Schema layer the paths write into: `05-schema-layer.md`
- What's there today: `09-current-state.md`
