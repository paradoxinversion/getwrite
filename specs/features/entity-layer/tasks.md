# Task List: Entity Layer

Source spec: `specs/features/entity-layer.md` (final, `sab.feature-spec/1`-conformant,
15 functional requirements, no open questions remaining). This list does not
revisit any resolved decision in that spec — in particular: detection reads
only persisted content via `loadResourceContent`, dispatched from the save
path through `indexer-queue`; aliases are never rejected at write time and
FR-15's warning is non-blocking with a fixed, non-extendable word list and a
"fewer than three characters" threshold; no task's done condition states a
numeric performance target for FR-7, FR-8, or FR-13; `ResourceTypeSchema`
stays `["text", "image", "audio"]`; `InvertedIndex` stays
`Record<term, Record<resourceId, count>>`.

Granularity: story points (1/2/3/5/8).

---

### Task 1: Entity sidecar fields — `entityKind` and `aliases`

**What:** Adds structural validation for a resource sidecar's `entityKind`
(entity marker) and `aliases` (ordered, non-empty strings) so both are a
declared, validated part of the data model rather than untyped
`MetadataValue` grabbed ad hoc.

**Files:** `frontend/src/lib/models/schemas.ts`,
`frontend/src/lib/models/types.ts`,
`frontend/tests/unit/entity-sidecar-schema.test.ts`

**Done when:** `schemas.ts` exports a validator (e.g. `EntitySidecarFieldsSchema`)
that: accepts an absent `entityKind` (a resource is not an entity by default);
when present, validates `entityKind` as `z.string().min(1)` and MUST NOT
constrain it to an enum of any kind — `entityKind` is an open, user-definable
value, settled at the gate: it matches FR-1's deliberately illustrative "e.g.
character, place, object" wording and GetWrite's user-definable-metadata
philosophy (Feature 18 already commits the product to writer-defined fields;
a game-documentation project may legitimately want `faction` or `mechanic`
where a novel never would). This is a closed decision, not a design option —
do not add a `z.enum(...)` here even as a convenience default. The accepted,
stated costs of this choice: no validation catches a typo (`charcter` becomes
a distinct kind silently, indistinguishable from an intentional new kind);
any downstream UI or query logic that groups or filters by kind must handle
arbitrary string values, never a fixed set (see Tasks 13, 14, 15, which must
not assume otherwise). Separately, requires `aliases`, when present, to be
an array preserving insertion order, each element a non-empty string; and
rejects an alias list with an empty string but never rejects on length or
common-word grounds (that is FR-15's job, not this validator's — see Task 12).
`ResourceTypeSchema` is unchanged (still `["text", "image", "audio"]`).
Tests cover: valid entity sidecar with an arbitrary/unlisted `entityKind`
value (e.g. `faction`) accepted equally to `character`/`place`/`object`;
sidecar with no `entityKind` (plain resource, still valid); `aliases` with an
empty string (rejected); `aliases` order preserved through parse.

**Depends on:** none

**Estimate:** 3

**Done:** [ ]

---

### Task 2: Alias detection engine (word-boundary, possessive, plural)

**What:** A pure function that scans plain text for occurrences of a given
name/alias, matching case-insensitively at word boundaries plus the
possessive (`Aria's`, `Jones'`) and simple plural (`Arias`) forms, and
returns each match's character offset — without ever matching an alias
occurring inside a larger word.

**Files:** `frontend/src/lib/models/entity-detection.ts` (new),
`frontend/tests/unit/entity-detection.test.ts`

**Done when:** `entity-detection.ts` exports a function such as
`findMentionOffsets(text: string, alias: string): number[]` returning every
match's start offset. Tests cover, at minimum: (1) exact case-insensitive
match ("aria" matches "Aria"); (2) possessive forms ("Aria's", "Jones'");
(3) simple plural ("Arias" for alias "Aria"); (4) **FR-4's negative case**:
alias `Ari` does NOT match `Aristocrat` or `Arias-Vela` — both asserted as
zero matches, not just "no crash"; (5) alias appearing at start/end of text
(boundary edge cases); (6) alias that is itself a substring of another
matched alias in the same text (e.g. "Ari" and "Aria" both declared) produces
independent, correct offsets for each. No network or model calls anywhere in
this module (offline-only, per the spec's non-goals).

**Depends on:** none

**Estimate:** 5

**Notes:** This is the highest-risk correctness surface named in the spec
(FR-3/FR-4). Keep the function pure and dependency-free so it stays trivially
unit-testable; do not fold filesystem or index concerns into it.

**Done:** [ ]

---

### Task 3: Alias table and cross-entity ambiguity detection

**What:** Builds a per-project alias table (entity id -> its name + aliases)
from all resources with `entityKind` set, and detects when two or more
entities claim the same alias so a mention can be attributed to every
claimant and the collision surfaced rather than silently resolved to one.

**Files:** `frontend/src/lib/models/entity-alias-table.ts` (new),
`frontend/tests/unit/entity-alias-table.test.ts`

**Done when:** Exports a function such as `buildEntityAliasTable(projectRoot)`
returning, per entity id, its matchable terms (name + aliases) and a
`claimedBy: Record<normalizedAlias, entityId[]>` map identifying every alias
claimed by more than one entity. Reuses `readSidecar` (`./sidecar.ts`) and
`listResourceIds` (`./backlinks.ts`) rather than re-implementing sidecar
iteration. Tests cover: single entity with unique aliases (no ambiguity);
two entities sharing one alias (both appear in `claimedBy` for that alias);
an entity with no aliases (matches on name only, still included).

**Depends on:** Task 1

**Estimate:** 3

**Done:** [ ]

---

### Task 4: Mention index — schema and persistence

**What:** Defines the mention index's on-disk shape and load/save functions,
persisted under `meta/index/` separately from `backlinks.json` and from
`inverted.json`, so an explicit reference and a detected mention are never
conflated at the data layer (FR-5), and so a snippet can be rendered from
stored offsets without re-tokenizing (FR-6).

**Files:** `frontend/src/lib/models/mention-index.ts` (new),
`frontend/tests/unit/mention-index.test.ts`

**Done when:** `mention-index.ts` exports: a `MentionRecord` type carrying
`entityId`, `resourceId`, `count`, and `offsets: number[]` (per FR-6,
verbatim); a `MentionIndex` type keyed by `resourceId` so a resource's own
mentions are a direct lookup (supports FR-9); `loadMentionIndex(projectRoot)`
/ `persistMentionIndex(projectRoot, index)` writing to
`meta/index/mentions.json` via the same `atomicWriteFile` +
`withMetaLock(projectRoot, ...)` pattern as `inverted-index.ts` and
`backlinks.ts`; and an `invertMentionIndex(index)` helper producing
`Record<entityId, MentionRecord[]>` for entity-scoped lookups (supports
FR-10/FR-11). `InvertedIndex`'s own type (`inverted-index.ts`) is untouched —
no offsets added there. Tests cover: persist then load round-trips a
`MentionRecord[]`; `invertMentionIndex` groups records by entity across
multiple resources; load of a missing file returns an empty index (mirrors
`loadBacklinks`'s empty-on-missing behavior) rather than throwing.

**Depends on:** none

**Estimate:** 3

**Done:** [ ]

---

### Task 5: Wire detection into the indexer-queue save path

**What:** On resource save, re-scans that resource's persisted content
against the current alias table and updates only that resource's entries in
the mention index, alongside the existing inverted-index and backlinks
updates already dispatched from `indexer-queue.ts`'s `runTask`.

**Files:** `frontend/src/lib/models/indexer-queue.ts`,
`frontend/tests/unit/indexer-queue.test.ts` (extend existing coverage if
present, else add)

**Done when:** `runTask` in `indexer-queue.ts`, after its existing
`indexResource` and `computeBacklinks`/`persistBacklinks` calls, builds the
alias table (Task 3), runs detection (Task 2) against the same `plain` text
already loaded via `loadResourceContent`/`tiptapToPlainText` for that task —
not a second, separate content read — replaces that resource's prior entries
in the mention index (Task 4) with the freshly computed ones, and persists
the result. A resource with no entity mentions clears any stale prior entries
for it (mirrors `purgeTermsForResource`'s clear-then-rebuild pattern in
`inverted-index.ts`). Detection failures are caught and logged the same way
the existing backlinks-update `try`/`catch` in `runTask` is, so one
resource's detection failure does not stop the queue. Test: enqueuing a
resource whose saved content names a declared entity results in a persisted
mention index entry for it; a resource with no entity content produces no
entry (or clears a prior stale one on re-save).

**Depends on:** Task 2, Task 3, Task 4

**Estimate:** 3

**Notes:** This task explicitly does NOT read unsaved editor state — it only
touches the same `loadResourceContent`-sourced text `indexer-queue` already
reads for the inverted index. No numeric performance ceiling is asserted in
the done condition (FR-7 states none).

**Done:** [ ]

---

### Task 6: Targeted rescan when an entity's name or aliases change

**What:** Editing an entity's `name` or `aliases` re-scans the project for
that entity alone — not a full mention-index rebuild.

**Files:** `frontend/src/lib/models/indexer-queue.ts` (new exported function,
e.g. `enqueueEntityRescan`), `frontend/src/lib/models/sidecar.ts` (dispatch
point), `frontend/tests/unit/entity-rescan.test.ts`

**Done when:** A new function scans every resource's already-persisted
content (again via `loadResourceContent`, no unsaved state) for mentions of
one specific entity's current name/aliases and updates only that entity's
records across the mention index (using `invertMentionIndex`/targeted removal
+ re-add, not `removeResourceFromIndex`-style whole-resource wipes). `writeSidecar`
in `sidecar.ts` calls this instead of (or in addition to, scoped correctly)
the per-resource `enqueueIndex` when the write changes `entityKind`, `name`,
or `aliases` on a resource that is (or was) an entity. Test: renaming an
entity's alias causes previously-attributed mentions under the old alias to
be dropped and new mentions under the new alias to appear, without touching
mention records for unrelated entities; asserts the whole index was not
rebuilt (e.g. by asserting an unrelated entity's untouched record is
unchanged/identical object-equal-by-value across the call).

**Depends on:** Task 3, Task 5

**Estimate:** 3

**Done:** [ ]

---

### Task 7: `getwrite-cli reindex` rebuilds the mention index

**What:** Extends the `reindex` CLI command to rebuild the mention index from
scratch alongside the inverted index and backlinks it already rebuilds.

**Files:** `cli/src/commands/reindex.ts`,
`cli/tests/` (mirror the existing reindex test's location and naming)

**Done when:** `registerReindex`'s action, after its existing per-resource
`indexResource` loop and `computeBacklinks`/`persistBacklinks` calls, builds
the alias table and, for every resource, computes and persists that
resource's mentions the same way `indexer-queue.ts`'s `runTask` does post-Task
5 (shared logic, not reimplemented) — then persists the mention index once.
Console output reports resources indexed as it already does. No numeric
corpus-size or wall-clock ceiling is asserted (FR-13 states none); the task
inherits, not introduces, the existing whole-file JSON `meta/index/`
persistence scheme. Test: running `reindex` against a fixture project with a
declared entity and a resource mentioning it by alias produces a populated
`meta/index/mentions.json`.

**Depends on:** Task 4, Task 5

**Estimate:** 2

**Done:** [ ]

---

### Task 8: Integration test — save-through-persistence for detection

**What:** A model-level integration test exercising the full save path (not
just unit-level pieces in isolation): saving a resource that mentions a
declared entity by alias results in a correctly persisted mention index
entry, and saving a resource with no entity mentions does not.

**Files:** `frontend/tests/integration/entity-mention-detection.test.ts` (new)

**Done when:** Using the in-memory `memoryAdapter.ts` (the existing test
adapter pattern other model integration tests use), the test: creates a
project fixture with one entity resource (`entityKind: "character"`, an
alias) and one prose resource whose content names that alias in possessive
form; drives the save path through `enqueueIndex`/`flushIndexer` (the real
`indexer-queue.ts` entry points, not a hand-rolled call to the detection
function); asserts `loadMentionIndex` returns a record attributing the
prose resource's mention to the entity with the correct offset; asserts a
second save with the alias removed from the prose resource's content clears
the stale mention. This is the wiring check that Tasks 2/4/5's unit tests
individually cannot catch.

**Depends on:** Task 5

**Estimate:** 3

**Done:** [ ]

---

### Task 9: `mentions` query intrinsic

**What:** Adds a `mentions` field to `INTRINSIC_FIELDS` so `query-evaluator`
and smart folders can filter resources by whether they mention a given
entity.

**Files:** `frontend/src/lib/models/query-intrinsics.ts`,
`frontend/src/lib/models/query-evaluate-core.ts`,
`frontend/tests/unit/query-intrinsics.test.ts`,
`frontend/tests/unit/query-evaluator.test.ts` (extend)

**Done when:** `QueryContext` (in `query-intrinsics.ts`) gains a `mentions:
Record<entityId, string[]>` field (resourceIds mentioning that entity — the
`invertMentionIndex` shape from Task 4, reduced to ids) alongside its existing
`config`/`backlinks`; a new `IntrinsicField` entry with `key: "mentions"`,
type `multi-resource-ref` (matching how `linksTo`/`linkedFrom` are modeled),
`source: "backlinks"`-equivalent (extend `IntrinsicFieldSource` with a
`"mentions"` variant), reading which entity ids a resource is mentioned-by;
`query-evaluate-core.ts`'s context-building step (where it currently does
`loadBacklinks(projectRoot)` alongside `config`) additionally loads and
inverts the mention index and includes it in the returned `context`. Because
`query-evaluate-core.ts` is already the shared transport-agnostic core reused
by both the HTTP route and the native query backend (ADR-021 Phase 1), no
separate native-side change is needed for this task. Test: a saved query
filtering on `mentions` for a given entity id returns exactly the resources
with a persisted mention record for that entity.

**Depends on:** Task 4

**Estimate:** 3

**Done:** [ ]

---

### Task 10: Mentions data-access core and API routes

**What:** A transport-agnostic core plus HTTP routes exposing two reads the
UI needs and the mention index alone doesn't hand back pre-shaped: "which
entities does this resource mention" (for FR-9) and "which resources mention
this entity, with a rendered snippet per occurrence" (for FR-10).

**Files:** `frontend/src/lib/models/mentions-core.ts` (new),
`frontend/app/api/resource/[resource-id]/mentions/route.ts` (new — entities
mentioned in this resource), `frontend/app/api/resource/[resource-id]/mentioned-in/route.ts`
(new — resources mentioning this entity, one snippet per occurrence),
`frontend/tests/unit/mentions-core.test.ts`,
`frontend/tests/unit/mentions-routes.test.ts` (or the project's existing
per-route test convention if different — check `resource/[resource-id]/delete/route.ts`'s
test for the pattern before adding a new one)

**Done when:** `mentions-core.ts` exports `getResourceMentions(projectRoot,
resourceId)` returning `{ entityId, name }[]` for every entity with a mention
record naming that resource, resolving each entity id's display name via
`readSidecar`; and `getEntityMentionedIn(projectRoot, entityId)` returning
`{ resourceId, name, snippets: string[] }[]`, one snippet per occurrence
built by slicing the resource's plain text around each stored offset and
running it through the existing `extractSnippet` (or an offset-based
equivalent — `extractSnippet` is query-string-based; if reused, pass the
matched alias text as the query) rather than a new snippet algorithm. Both
routes resolve their project root via `validateProjectId`/project-path
conventions like existing `resource/[resource-id]/*` routes (never a
client-supplied path). Tests cover both core functions against a fixture
mention index, and both routes' happy-path JSON shape.

**Depends on:** Task 4

**Estimate:** 5

**Notes:** The spec fixes the data model (FR-5, FR-6) and the UI requirement
(FR-9, FR-10) but not the route/contract shape — this task's route naming and
response shape are an implementation judgment call, not something the spec
settles. Flagged as a risk: a different, equally valid shape (e.g. one route
with a direction parameter) would also satisfy the FRs, so this should be
treated as provisional until reviewed.

**Done:** [ ]

---

### Task 11: Native transport for the mentions core (ADR-021 parity)

**What:** Gives the two new reads from Task 10 an in-process native backend,
matching every other client-facing read in `lib/api/*` per ADR-021 Phase 2's
transport-collapse pattern (e.g. `resource-excerpts.ts` /
`native-resource-excerpts-backend.ts`), so the native (Android) build never
needs an HTTP round trip for entity data any more than any other read does.

**Files:** `frontend/src/lib/api/mentions.ts` (new),
`frontend/src/store/transport/native-mentions-backend.ts` (new),
`frontend/src/store/transport/native-mentions-backend.web-stub.ts` (new),
`frontend/tests/unit/mentions-transport.test.ts`

**Done when:** `lib/api/mentions.ts` defines a `MentionsTransport` interface
with the two Task 10 operations, an `httpMentionsTransport` implementation
calling the two new routes, and resolves HTTP-vs-native through
`createTransport` exactly like `resource-excerpts.ts` does; the native
backend calls `mentions-core.ts` directly (no HTTP) the same way
`native-resource-excerpts-backend.ts` calls `resource-excerpts-core.ts`;
`next.config.mjs`'s `turbopack.resolveAlias` gets an entry for the new native
backend's specifier resolving to its `.web-stub.ts`, mirroring every existing
entry in that list. Test: the transport module resolves to the HTTP
implementation in a web/desktop-runtime test context (existing tests for
`resource-excerpts` transport show the pattern to mirror).

**Depends on:** Task 10

**Estimate:** 3

**Done:** [ ]

---

### Task 12: Alias warning logic (short / common-word aliases)

**What:** A pure function flagging an alias as noise-prone — fewer than
three characters, or matching a small, fixed, built-in list of common
English words/given names ("May", "Will", "Art", etc.) — without ever
rejecting the alias (FR-15 is a non-blocking warning; validation staying
non-rejecting was already settled in Task 1 and FR-2).

**Files:** `frontend/src/lib/models/entity-alias-warnings.ts` (new),
`frontend/tests/unit/entity-alias-warnings.test.ts`

**Done when:** Exports a fixed, non-exported (module-private) common-word
list and a function such as `getAliasWarning(alias: string): string | null`
returning a human-readable reason (naming why: "will match frequently and add
noise") or `null` when the alias is clean. Tests cover: an alias under three
characters ("Al") warns; an alias in the fixed word list ("May") warns
case-insensitively; an ordinary alias ("Duchess") does not warn; the function
never throws or mutates its input regardless of alias content. The word list
is explicitly not parameterized/exported for extension, per the spec's Out of
scope.

**Depends on:** Task 1

**Estimate:** 2

**Done:** [ ]

---

### Task 13: Entity metadata UI — `entityKind` and alias editor

**What:** UI for declaring a resource as an entity and editing its ordered
alias list, surfacing Task 12's warning inline and non-blockingly.

**Files:** `frontend/components/Sidebar/EntitySection.tsx` (new, following
the existing `TagsSection.tsx` pattern in the same directory),
`frontend/components/Sidebar/MetadataSidebar.tsx` (wire the new section in,
alongside the existing `TagsSection`/`CollapsibleSection` composition),
`frontend/tests/component/EntitySection.test.tsx`

**Done when:** A new collapsible section (matching `CollapsibleSection`
usage elsewhere in `MetadataSidebar.tsx`) lets a writer set/clear
`entityKind` via a free-text input — never a fixed `<select>`/closed dropdown,
since `entityKind` is an open, user-definable string per Task 1's settled
decision. `character`/`place`/`object` MAY be offered as non-binding
suggestions (e.g. a datalist or autocomplete affordance the writer can type
past), but the stored value MUST accept and preserve any non-empty string
the writer enters, including one not in that suggestion list. The same
section lets the writer add, reorder, and remove aliases; each alias input
shows Task 12's warning text inline when non-null, without disabling
save/add; edits persist via the existing sidecar write path (`writeSidecar`,
dispatched the same way other `MetadataSidebar` controls already persist
edits — check an existing control like `POVAutocomplete.tsx` for the
save-on-change convention before wiring a new one). Component test covers:
setting `entityKind` to a value outside the suggested three (e.g. `faction`)
and confirming it persists unmodified; adding an alias under three characters
shows the warning and still allows adding it; reordering aliases preserves
order in the persisted value; clearing `entityKind` removes the section's
edit affordances without deleting existing `aliases` data (schema allows
aliases on a non-entity resource, per Task 1 — dormant until `entityKind` is
set again).

**Depends on:** Task 1, Task 12

**Estimate:** 5

**Notes:** No existing generic `MetadataField` type supports an ordered,
free-text string list (see `MetadataFieldType` in `types.ts`) — `aliases` is
modeled as a bespoke sidecar key with its own UI, the same way `tags` is
handled outside the generic metadata-field system rather than by extending
`MetadataFieldType`. This is a reasonable read of FR-2 but is this task's own
design choice, not one the spec makes explicit — flagged as a risk.

**Done:** [ ]

---

### Task 14: Resource view — entities mentioned in this resource

**What:** A resource's view lists the entities detected in it, each
navigable to the entity resource (FR-9).

**Files:** `frontend/components/Sidebar/MetadataSidebar.tsx` or a new
`frontend/components/Sidebar/EntitiesMentionedSection.tsx` (new, read-only
counterpart to Task 13's editable section), `frontend/tests/component/EntitiesMentionedSection.test.tsx`

**Done when:** For any resource (not just entities), a read-only list
section renders every entity from `getResourceMentions` (Task 10, via the
Task 11 transport) as a navigable link/row to that entity's resource; an
empty result renders an empty/hidden state rather than an error; the section
does not render for a resource that is itself missing mentions data (loading
and empty states are visually distinct, matching the project's existing
loading/empty conventions — check `StubResourcesSection.tsx` for the pattern).
Component test covers: rendering a non-empty list with working navigation,
and rendering nothing/an empty-state message when there are no detected
entities.

**Depends on:** Task 11

**Estimate:** 3

**Done:** [ ]

---

### Task 15: Entity view — mentioned-in list with snippets, explicit/detected distinction, and ambiguity flags

**What:** An entity's view lists every resource mentioning it with one
snippet per occurrence (FR-10); wherever this list and the entity's explicit
backlinks (`linkedFrom`) appear together, each row is visually labeled as
"linked" or "mentioned" (FR-12); a mention whose alias is ambiguously claimed
by more than one entity (Task 3's `claimedBy`) is flagged in this list rather
than silently shown as unambiguous (FR-14's UI half).

**Files:** `frontend/components/Sidebar/EntityMentionsSection.tsx` (new),
wired into `MetadataSidebar.tsx` alongside Task 14's section,
`frontend/tests/component/EntityMentionsSection.test.tsx`

**Done when:** For a resource with `entityKind` set, a section renders
`getEntityMentionedIn` (Task 10, via Task 11) results, one row per resource
with one snippet per occurrence, each row navigable to that resource; the
same list additionally reads the entity's `linkedFrom` intrinsic value
(already available via `query-intrinsics.ts`) and merges explicit-link rows
into the same list, each row carrying a label/badge distinguishing "Linked"
(explicit) from "Mentioned" (detected) — a resource that is both is shown
once with both labels, not duplicated; a row whose underlying alias appears
in the ambiguity table (Task 3) carries a visible "ambiguous — also matches
{other entity names}" indicator. Component test covers: an explicit-only
row, a detected-only row, a resource that is both (single row, both labels),
and an ambiguous mention showing the ambiguity indicator naming the other
claimant.

**Depends on:** Task 11, Task 3

**Estimate:** 5

**Notes:** This is the most UI-complex task in the list — merging two
differently-shaped data sources (backlinks' `linkedFrom` and the mentions
core's per-occurrence snippets) into one deduplicated, labeled list is not
spelled out mechanically by the spec; the merge/dedup strategy above is this
task's own design choice built to satisfy FR-10/FR-12/FR-14 together, and
should be reviewed rather than assumed correct on first pass.

**Done:** [ ]

---

## Summary

- Total tasks: 15
- Total estimated effort: 51 points (3+5+3+3+3+3+2+3+3+5+3+2+5+3+5)
- Critical path: Tasks 1 → 2 → 3 → 4 → 10 → 15
- Settled at the gate: `entityKind` (Task 1) is an open, unconstrained
  non-empty string, never a closed enum — see Task 1's Done when for the
  rationale and the accepted costs (no typo detection; every downstream
  consumer of `entityKind` must handle arbitrary values). This was flagged as
  a risk in an earlier draft of this list and has since been resolved by the
  spec owner; it is recorded here, not left open.
- Risks:
  - Task 2: the alias-detection regex (word boundaries + possessive + plural,
    with the negative substring case from FR-4) is the single highest-risk
    correctness surface in this feature; it has the most test cases of any
    task for that reason.
  - Task 10: route naming and response shape for the two new mention reads
    are this task's own design choice, not fixed by the spec — a materially
    different shape would be equally valid.
  - Task 13: modeling `aliases` as a bespoke sidecar key outside the generic
    `MetadataField`/`MetadataFieldType` system (rather than extending that
    type system with a new field type) is a design judgment call.
  - Task 15: merging explicit backlinks and detected mentions into one
    deduplicated, labeled, ambiguity-aware list has no mechanical
    specification in the FRs — the dedup/labeling strategy here is this
    task's invention and should be reviewed, not assumed correct.
  - No task in this list states a numeric performance ceiling for FR-7,
    FR-8, or FR-13, per the spec's explicit statement that none exists as
    written; none should be added by an implementer without a real-corpus
    measurement first.

## Open Questions

None. The source spec resolved all design questions before this task list was
written; no new ones were introduced during decomposition. The items under
Summary → Risks above are implementation judgment calls flagged for review,
not unresolved spec questions.
