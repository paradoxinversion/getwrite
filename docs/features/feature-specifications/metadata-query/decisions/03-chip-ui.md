# Chip UI

Visual filter builder for queries. Targets the 90-95% of writer queries
that fit two levels of boolean nesting; deeper queries fall back to the
text/AST mode.

New surface — nothing like it exists today. `components/common/UI/Chip`
provides the chip primitive, and `components/SearchBar/SearchFilterPanel`
has a flat-filter precedent (folder dropdown, status chips, tag chips),
but neither supports boolean composition. Read `09-current-state.md`
for context.

## Decisions

### Two-level model

Cap visual nesting at exactly two levels.

- **Top level**: ordered list of _filter groups_, joined by one combinator
  (AND or OR).
- **Inside each group**: ordered list of _chips_, joined by one combinator
  (AND or OR).

User picks AND/OR per level. Two levels express:

- `A AND B AND C` — one AND-group
- `A OR B OR C` — one OR-group
- `(A AND B) OR (C AND D)` — two AND-groups, OR'd
- `(A OR B) AND (C OR D)` — two OR-groups, AND'd

With 3+ groups, all between-group joins share the same combinator — no
`g1 AND g2 OR g3` ambiguity.

### NOT is polarity, not a combinator

`pov is not Mara` — `is` / `is not` is a segmented control inside the chip's
operator slot. Splitting them into a separate negation toggle adds a click
without making anything clearer to read. This collapses most cases that
would otherwise need a third nesting level just to wrap a negation.

### Saved-query references are chips

`@act-2-scenes` appears inside groups like any other condition, visually
distinct (different shape/color, `@`-prefix). The named-query chip occupies
one slot — no field/operator/value triad, since it's self-contained.

This is also the primary lever that keeps the two-level cap from feeling
restrictive: when a query gets unwieldy, factor part of it into a saved
query and reference it.

### Escape hatch

Genuine 3+ deep trees (`A AND (B OR (C AND D))`) are rare and almost always
rewritable. When neither rewriting nor factoring into a saved query works,
the user crosses into text/AST mode. The query is tagged `advanced`, and
the chip UI degrades to read-only with an "edit in advanced mode"
affordance.

Do not grow the chip UI to handle these cases. It would wreck the 95%.

### Layout

Field names below are illustrative; the actual chip UI uses real
`metadataSchema` field keys plus intrinsics (see `04-chip-internals.md`).

```
┌─ All of ─────────────────────────────────────────┐
│ [ type        is        text        ]       ⋮    │
│ [ folderId    in folder Scenes      ]       ⋮    │
│ [ pov         is        Mara        ]       ⋮    │
│ [ status      is not    done        ]       ⋮    │
│ [ wordCount   is less than   500    ]       ⋮    │
│ + Add condition                                  │
└──────────────────────────────────────────────────┘
                    ⌄ OR ⌄
┌─ All of ─────────────────────────────────────────┐
│ [ @scenes-already-revised           ]       ⋮    │
│ [ updatedAt   in last   7 days      ]       ⋮    │
│ + Add condition                                  │
└──────────────────────────────────────────────────┘

+ Add group                              [ 42 matches ]
```

- "All of" / "Any of" is the group's local combinator (dropdown).
- The pill between groups is the global combinator (dropdown).
- Live match count at the bottom; each group can show its own subtotal on
  hover.
- The `⋮` per-chip menu handles duplicate / delete / move to other group.

### Reordering and editing

- Drag handles on each chip and each group border.
- Across-group drag works.
- Same handle metaphor at both levels.

### Mobile / narrow viewport

- Groups stack vertically.
- Between-group pill becomes a full-width row.
- Chip internals wrap to multiple lines if needed.

### Field-picker scoping

The picker shows every field the project knows about, organized:

- **Built-in** (locked fields from `DEFAULT_METADATA_SCHEMA`):
  synopsis, notes, status, pov, storyDate, storyDuration, storyEndDate.
- **Project** (user-added fields in `project.config.metadataSchema`).
- **System** (intrinsics merged at query time): type, folderId,
  wordCount, createdAt, updatedAt, statuses, tags, linkedFrom,
  linksTo.

Each field's row shows its source-layer badge and, for `metadataSchema`
fields, the `folderId` of its containing group when set (e.g. "Scenes
only"). Group `folderId` is the only scoping mechanism — the picker
doesn't filter by it automatically, since a single query can mix
predicates from any group. The annotation just tells the user
"this field is empty on most resources because it's scoped to a
folder."

## Cross-refs

- AST representation behind these chips: `02-query-substrate.md`
- What goes inside each chip: `04-chip-internals.md`
- Field discoverability in the chip's field picker: `05-schema-layer.md`
- How the chip UI's "Add a new field…" entry interacts with the
  sidebar and SchemaManager creation flows: `08-creation-paths.md`
- Reusable chip primitive and existing filter precedent:
  `09-current-state.md`
