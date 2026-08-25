# Chip Internals

The field/operator/value triad inside each chip. Operator vocabulary and
value-input shape are both derived from the field's type — using the
existing `MetadataFieldType` enum from `schemas.ts`, not invented type
names.

Read `09-current-state.md` first. Field types listed below are the only
ones that exist; anything else would be a new field-type addition,
which is out of scope for the query layer.

## Decisions

### Anatomy

Each chip is three slots: field, operator, value.

```
[ wordCount   is less than   500  ]
  └─ field ──┘└─ operator ─┘└val─┘
```

Choosing the field first determines available operators and the value-
input type. Polarity (`is` / `is not`, `does` / `does not`) lives inside
the operator label, not as a separate toggle.

### Operator vocabularies, by field type

Vocabularies are pinned to the existing `MetadataFieldType` enum.
Every type's menu ends with `is empty` / `has any value`, separated by
a divider — this unlocks the "missing metadata" predicate (catalog #9)
without cluttering the natural-language list.

```
text                     number                  date
─────────────────        ─────────────────       ─────────────────
is                       equals                  is on
is not                   does not equal          is before
contains                 is less than            is after
does not contain         is at most              is between
starts with              is greater than         in the last
matches regex            is at least             ─────
─────                    is between              is empty
is empty                 ─────                   has any value
has any value            is empty
                         has any value

boolean                  select                  multiselect
─────────────────        ─────────────────       ─────────────────
is true                  is                      includes
is false                 is not                  does not include
─────                    is any of               includes all of
is empty                 is none of              includes any of
has any value            ─────                   includes none of
                         is empty                ─────
                         has any value           is empty
                                                 has any value

resource-ref             multi-resource-ref
─────────────────        ─────────────────
is                       includes
is not                   does not include
is any of                includes all of
is none of               includes any of
─────                    includes none of
is empty                 ─────
has any value            is empty
                         has any value
```

Two consistent rules:

- **Use words, not symbols.** `is less than 500` not `< 500`. Queries
  are read far more often than written.
- **`in the last` is critical for dates.** Writers think in "this week"
  and "last 30 days" more than absolute dates. The value input is a
  small inline `[ N ] [ days / weeks / months ]` pair.

### Intrinsic fields — merged in at query time

These aren't in `metadataSchema` but they are queryable. Map each to
the existing type's operator vocabulary:

| Intrinsic    | Type                                           | Notes                             |
| ------------ | ---------------------------------------------- | --------------------------------- |
| `type`       | `select` (closed: text/image/audio/folder)     | The actual resource type          |
| `folderId`   | `resource-ref` (target = folder)               | Path/parent predicate             |
| `wordCount`  | `number`                                       | TextResource only                 |
| `createdAt`  | `date`                                         | ISO string                        |
| `updatedAt`  | `date`                                         | ISO string                        |
| `statuses`   | `multiselect` (options = `config.statuses`)    | Resource-level status array       |
| `tags`       | `multi-resource-ref` (target = tag, synthetic) | Backed by `config.tagAssignments` |
| `linkedFrom` | `multi-resource-ref` (target = resource)       | From the backlink index           |
| `linksTo`    | `multi-resource-ref` (target = resource)       | From the backlink index           |

`tags`, `linkedFrom`, and `linksTo` are _synthetic_ — their data lives
outside `metadataSchema` but they present as field types the chip UI
already knows how to render.

### Value pickers, by type

Reuse the existing controls in `components/Sidebar/controls/` wherever
possible. They already handle each `MetadataFieldType` correctly with
typed input semantics.

- **text**: text input (`Input`)
- **number**: numeric input + steppers (`NumberInput`); `between`
  shows two inputs side by side
- **date**: date picker (`DateTimeInput`) for absolute operators;
  `[N] [days/weeks/months]` pair for `in the last`
- **boolean**: no value input (operator carries it)
- **select**: dropdown (`SelectInput`); multi-select for `is any of`.
  For the `status` field, pull options from `config.statuses` (matching
  existing sidebar behaviour for the locked `status` field)
- **multiselect**: chip strip with options from `field.options`
- **resource-ref**: typeahead with hover preview of the target resource.
  Use `ResourceRefInput` as the basis; extend with hover-preview
  affordance. Respect `field.refFolder` + `field.includeSubfolders`
  for candidate scoping
- **multi-resource-ref**: same as resource-ref but multi-select,
  respecting `field.maxSelections` if set. Use `MultiResourceRefInput`
  as the basis

The ref hover-preview is the chip-UI differentiator over plain
`ResourceRefInput`. It's a new affordance — the existing controls
don't have it because the sidebar doesn't need it.

No inline creation of refs. If the target isn't in the list, the user
has a data problem to solve elsewhere.

### Mid-chip mutations

When the user changes part of a chip after committing:

- **Operator change, type-compatible** (e.g. `is` → `is any of`):
  preserve the value, promote single to list.
- **Operator change, type-incompatible** (e.g. `is` → `is empty`):
  hide the value input but retain it internally so flipping back
  restores it.
- **Field change**: reset operator and value. Don't try to coerce.

These rules prevent the chip builder from silently throwing away the
user's work as they iterate.

### Validation

- **Invalid value** (bad regex, malformed date, ref with `id: null`
  meaning target was deleted): chip shows inline error state. Rest of
  the query still runs.
- **Ambiguous typeahead** (`Mara` matches both Marabel and Marabella):
  disambiguation popover, no auto-pick.
- **Out-of-domain select value** (option removed from `field.options`):
  shown as `<unknown value>` muted; click to fix.

### Deliberately excluded

- **Joins across refs** (e.g. `pov.tags includes "antagonist"`). Joins
  in filter UIs explode the surface area. Users who want this should
  build a saved query.
- **Arithmetic in chips** (e.g. `wordCount - wordCountGoal < 0`).
  Project-level `wordCountGoal` is global today; per-resource word
  goals would need a new field on the schema.
- **Regex on non-text fields.** Power users can drop to text/AST mode.

### Keyboard / power-user behavior

- `Tab`: cycle field → operator → value.
- `Enter`: commit chip and create the next one.
- `⌘D`: duplicate focused chip.
- `⌘C`: copy chip as text (the same syntax the text/AST mode uses);
  paste parses it back.

## Cross-refs

- Field discovery and types this layer depends on: `05-schema-layer.md`
- Where chips render: `03-chip-ui.md`
- AST nodes corresponding to operators: `02-query-substrate.md`
- The chip UI's "Add a new field…" entry into the SchemaManager:
  `08-creation-paths.md`
- The truth about existing controls and types: `09-current-state.md`
