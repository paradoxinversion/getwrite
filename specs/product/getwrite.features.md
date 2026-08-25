# Feature Breakdown: GetWrite

**Source:** `specs/product/getwrite.md` (`sab.product-spec/1`)
**Status key used throughout:** every feature title and Notes field states one
of **Shipped**, **Partial** (started, real work remains), or **Not started**.
GetWrite is at release 2.1.0; most of this list already exists in the
product. Only the **Not started** entries are real candidates for a future
`/saboteur-ship` feature-selection gate — the **Shipped** entries are
inventory, not backlog, and the **Partial** entries are the closest thing to
a small next slice.

This breakdown regenerates the prior version against a spec that went through
a second accuracy correction. Corrections carried into this document — do not
reintroduce the claims below:

- **Search across revisions is Not started, not Shipped.** Search reads only
  each resource's canonical revision today. FR-29 (Next milestone) now merges
  "search across all retained revisions" with "the diff view opened from such
  a result selects the most recent matching revision" into a single
  requirement; this breakdown reflects that merge as one feature rather than
  two.
- **Tags cannot be renamed at any layer.** There is no rename path in the
  model or the UI; renaming means delete-and-recreate, which drops existing
  assignments.
- **The Start page has no copy action**, and package does not produce a zip —
  it compiles selected resources to PDF, DOCX, Markdown, or plain text.
- **Reference previews were overstated.** What ships is a hover tooltip in
  the QueryBuilder value picker only — a referenced resource's name plus a
  short id, or "Deleted." It never loads the referenced resource's content.
  `models/previews.ts` has zero production consumers and backs no shipped
  claim.
- **Tree context menu** ships `rename` and `convert to smart folder` in
  addition to create/copy-duplicate/delete/export; `copy` and `duplicate` are
  one behavior under two labels, not two behaviors.
- **Resource templates are CLI-and-model-only.** No UI, no HTTP route. The
  richer `cli/src/templates.ts` (export/import/scaffold/validate) is not
  wired into the shipped binary and must not be described as shipped.
- **End-to-end encryption (FR-25) is newly added** to this breakdown — a
  substantial shipped subsystem the prior version omitted entirely.

There is no Workspace folder invariant and no named special folders (Front
Matter/Back Matter/Workspace) anywhere in this document; a reference field is
scoped to whichever folder its schema definition names, by folder id.

---

### Feature 1: Local-first, database-free project persistence — Shipped
**Value:** A writer's projects, resources, and metadata are always plain
files/directories they own, never rows in a database they can't inspect.
**Vertical slice:** Filesystem storage layout, `StorageAdapter`/`io.ts`
boundary, project directory conventions, all persisted-state schemas.
**Requirements covered:** FR-1
**User stories:** US-5
**Depends on:** none
**Branch suggestion:** feat/local-first-persistence
**Notes:** Shipped. Foundational — every other feature in this list writes
through this layer. Verified against `frontend/src/lib/models/io.ts` and the
`projects/` on-disk layout described in CLAUDE.md.

### Feature 2: Project scaffolding from a declarative project type — Shipped
**Value:** A novelist gets a working, structured folder layout the moment
they create a project, instead of starting from an empty tree.
**Vertical slice:** `project-creator.ts`, project-type JSON specs under
`getwrite-config/templates/project-types/`, Start page create-project flow.
**Requirements covered:** FR-2
**User stories:** US-1
**Depends on:** Feature 1
**Branch suggestion:** feat/project-type-scaffolding
**Notes:** Shipped.

### Feature 3: Path-independent resource identity — Shipped
**Value:** A plain-file writer can reorganize their project tree without
breaking any metadata association tied to a resource.
**Vertical slice:** UUID-keyed resource identity, sidecar metadata storage
keyed by ID rather than path, move/rename handling across the tree.
**Requirements covered:** FR-3
**User stories:** US-6
**Depends on:** Feature 1
**Branch suggestion:** feat/path-independent-identity
**Notes:** Shipped.

### Feature 4: Autosave into a single canonical revision — Shipped
**Value:** A writer on deadline never loses work and never has to think
about saving — edits land in one authoritative revision automatically, and
the current revision can never be deleted out from under them.
**Vertical slice:** Debounced autosave, canonical-revision invariant
enforcement (exactly one canonical revision at all times), delete guard
against removing the current canonical revision, revision-pruning
configuration.
**Requirements covered:** FR-4, FR-5, FR-6
**User stories:** US-9
**Depends on:** Feature 1
**Branch suggestion:** feat/canonical-autosave
**Notes:** Shipped.

### Feature 5: Revision diff view — Shipped
**Value:** A writer on deadline can see exactly what changed before
deciding whether to keep an edit.
**Vertical slice:** Word-based diff algorithm, Diff view UI, revision
selection for comparison.
**Requirements covered:** FR-7
**User stories:** US-10
**Depends on:** Feature 4
**Branch suggestion:** feat/revision-diff-view
**Notes:** Shipped.

### Feature 6: Folder-scoped references and reference integrity — Shipped
**Value:** A novelist can point a multi-reference field at any folder — by
folder id, never by name — and a deleted-but-referenced resource never
silently vanishes from where it's cited.
**Vertical slice:** Per-field `refFolder` scoping chosen in the schema
manager, offering every folder plus an "Any folder" option and an
include-descendants toggle; single-reference fields are unscoped. The
`isMetadataSource` folder flag is a superseded mechanism: the sidebar
generated a reference row per flagged folder until the schema-driven rewrite
(`cc04767`) replaced that with per-field `refFolder`. It is still authored in
the project-type editor and written onto the folder, but nothing consumes it. Reference-nullification on delete (`{id: null, name}`
retained, including within multi-reference arrays) rather than removal.
**Requirements covered:** FR-8
**User stories:** US-3
**Depends on:** Feature 2
**Branch suggestion:** feat/metadata-source-folders
**Notes:** Shipped. No folder name carries application semantics — this
replaces any earlier notion of named special folders (Characters/Locations/
Items/Front Matter/Back Matter/Workspace), none of which exist in the
codebase as protected or name-recognized folders today.

### Feature 7: Typed resource metadata — Shipped
**Value:** A novelist can attach structured, queryable facts to any resource
instead of relying on prose or ad hoc tags.
**Vertical slice:** The built-in metadata schema. Status is the only
unconditional field — a locked, project-scoped select whose options come from
the project type and are user-editable and reorderable. Synopsis, Notes,
Point of View (single resource reference accepting free text, preserved as a
name with a null id), and the Timeline group's Story Date, Duration and Story
End Date (unvalidated start/end ordering) are each behind a per-project
feature toggle and hidden while it is off, with stored values retained.
Entity reference fields such as characters or locations are not built-ins —
see Feature 18 (user-defined fields) and Feature 6 (folder scoping). Sidecar
persistence; Metadata sidebar UI.
**Requirements covered:** FR-9
**User stories:** US-3
**Depends on:** Feature 6
**Branch suggestion:** feat/typed-resource-metadata
**Notes:** Shipped.

### Feature 8: Saved queries as smart folders — Shipped
**Value:** A plain-file writer can save a metadata query once and reuse it
as a live, always-current folder in the tree.
**Vertical slice:** Query AST/evaluator, `saved-queries.ts`, QueryBuilder
UI, smart-folder rendering in the resource tree.
**Requirements covered:** FR-10
**User stories:** US-7
**Depends on:** Feature 7
**Branch suggestion:** feat/smart-folders
**Notes:** Shipped.

### Feature 9: Full-text search with metadata filters — Shipped
**Value:** A plain-file writer can find anything in a project too large to
hold in memory, by text and by Status/folder/Tags together.
**Vertical slice:** Inverted index, indexer queue, SearchBar UI, filter
panel (folder, Status, Tags).
**Requirements covered:** FR-11
**User stories:** US-7
**Depends on:** Feature 7
**Branch suggestion:** feat/full-text-search
**Notes:** Shipped. Indexes and searches only each resource's canonical
revision — retained revisions are not searchable until FR-29 (Feature 27)
ships. Full-text search's own filters are folder/Status/Tags only; it has no
predicate over the query builder's fields today (see Feature 32).

### Feature 10: Backlinks index — Shipped
**Value:** A plain-file writer can navigate a project by following actual
references between resources rather than remembering where things are.
**Vertical slice:** Wiki-link parsing, `backlinks.ts` maintained index,
backlink surfacing in the UI.
**Requirements covered:** FR-12
**User stories:** US-7
**Depends on:** Feature 1
**Branch suggestion:** feat/backlinks-index
**Notes:** Shipped.

### Feature 11: Five-view work area (Edit/Organizer/Data/Diff/Timeline) — Shipped
**Value:** A writer sees the resource or folder they've selected rendered
the way that's useful for the task at hand, not one fixed layout.
**Vertical slice:** Work area shell, per-view components, type-aware
rendering dispatch (text/image/audio/mixed).
**Requirements covered:** FR-13
**User stories:** US-9, US-10, US-7
**Depends on:** Feature 4, Feature 5, Feature 9
**Branch suggestion:** feat/work-area-views
**Notes:** Shipped as a base slice. Timeline is gated behind a per-project
`timelineView` feature flag and is disabled unless it is on; turning it on
force-enables the timeline date fields at the feature-config write seam, so
the view can never be on without its data. Organizer's only in-view control
is a show/hide-bodies toggle — though what a card body renders (nothing, a
text excerpt, or any metadata field) is a per-project setting that ships.
Card *filtering* by Status, word count, or reference fields is entirely
unbuilt and is broken out separately as Feature 24 (Not started), not folded
into this entry's Shipped status.

### Feature 12: Compile to a single manuscript — Shipped
**Value:** A novelist produces one ordered, deliverable manuscript file
from a chosen subtree without manual assembly.
**Vertical slice:** Depth-first compile walking a user-selected subtree in
plain resource-tree order, PDF/DOCX/Markdown/text output, non-mutating compile
pipeline, Compile preview modal.
**Requirements covered:** FR-14
**User stories:** US-2
**Depends on:** Feature 1
**Branch suggestion:** feat/compile-manuscript
**Notes:** Shipped. Compile has no notion of Workspace/Front Matter/Back
Matter ordering — it walks whatever subtree the user selects, in tree order,
and never emits metadata or mutates revisions/project state.

### Feature 13: Account-free Electron desktop app — Shipped
**Value:** A writer runs GetWrite entirely offline, with no server and no
account, against their own filesystem.
**Vertical slice:** Electron shell, standalone Next.js server spawn,
`GETWRITE_PROJECTS_DIR` resolution, packaged-build project directory.
**Requirements covered:** FR-15
**User stories:** US-5
**Depends on:** Feature 1
**Branch suggestion:** feat/electron-desktop-app
**Notes:** Shipped.

### Feature 14: Dark/light mode with per-project preference — Shipped
**Value:** A writer sets a color mode per project that persists rather than
resetting to a global default.
**Vertical slice:** CSS token themes, per-project `colorMode` preference
storage, theme switch UI.
**Requirements covered:** FR-16
**User stories:** US-5
**Depends on:** Feature 1
**Branch suggestion:** feat/color-mode-preference
**Notes:** Shipped.

### Feature 15: Add image and audio resources via the UI — Shipped
**Value:** A novelist adds an image or audio resource directly from the
app instead of placing files on disk out of band.
**Vertical slice:** Type selector and file input in the create-resource
flow, upload route, editor drag-and-drop, dedicated media viewer.
**Requirements covered:** FR-17
**User stories:** US-3
**Depends on:** Feature 7
**Branch suggestion:** feat/media-resource-creation
**Notes:** Shipped end-to-end — create-flow, upload route, editor drag-drop,
and media viewer all exist.

### Feature 16: Project-scoped tags — Shipped
**Value:** A plain-file writer organizes resources with lightweight,
project-scoped labels, independent of the metadata schema.
**Vertical slice:** Tag creation/assignment/removal/deletion model layer,
sidebar tag management UI, tag manager modal.
**Requirements covered:** FR-18
**User stories:** US-7
**Depends on:** Feature 1
**Branch suggestion:** feat/project-tags
**Notes:** Shipped. Tags cannot be renamed at any layer — model or UI.
Renaming a tag means deleting and recreating it, which drops its existing
resource assignments; this is a real gap, not a UI-only omission, and any
future rename capability would be new scope, not a fix to this feature.

### Feature 17: Resource templates via CLI — Shipped
**Value:** A writer on deadline creates new resources with consistent
structure without rebuilding it each time, via the CLI.
**Vertical slice:** `getwrite-cli templates save|create|duplicate|list`,
template scaffolds under `meta/templates/`.
**Requirements covered:** FR-19
**User stories:** US-13
**Depends on:** Feature 1
**Branch suggestion:** feat/resource-templates-cli
**Notes:** Shipped, CLI-and-model-only — no UI, no HTTP route. The richer
`cli/src/templates.ts` (export/import to `.zip`, scaffold, validate,
preview, version, changeset) exists in the source tree but is not wired
into the shipped `getwrite-cli` binary and is reachable only from tests; it
is not shipped and must not be claimed as such.

### Feature 18: User-definable metadata schema — Shipped
**Value:** A writer on deadline tracks attributes specific to their project
beyond the built-in metadata fields, and can safely evolve that schema as
the project grows.
**Vertical slice:** Custom field-definition model, per-project schema
storage, Schema Manager UI covering add/edit/delete field definitions,
label rename, key rename with a migration preview, type-change migration,
field reordering, and deprecate-vs-clear removal semantics with a
select-option-removal preview.
**Requirements covered:** FR-20
**User stories:** US-14
**Depends on:** Feature 7
**Branch suggestion:** feat/custom-metadata-schema
**Notes:** Shipped. Only `status` is locked — it cannot be renamed,
retyped, reordered, or removed, though its options are project-supplied and
user-editable. Every other built-in is unlocked at load time and is editable
exactly like a user-defined field.

### Feature 19: Resource-tree drag-and-drop and context menu — Shipped
**Value:** A plain-file writer reorders and manages resources/folders
directly in the tree, with order surviving to disk.
**Vertical slice:** Drag-and-drop reorder persisted to disk, context-menu
create/rename/copy-duplicate/delete/convert-to-smart-folder/export actions.
**Requirements covered:** FR-21
**User stories:** US-6
**Depends on:** Feature 3
**Branch suggestion:** feat/tree-dnd-context-menu
**Notes:** Shipped. `copy` and `duplicate` are one behavior offered under
two menu labels, not two distinct behaviors.

### Feature 20: TipTap rich-text editing — Shipped
**Value:** A writer on deadline authors in a full WYSIWYG surface with
tables, heading/body styling, and clean paste behavior.
**Vertical slice:** TipTap-based editor, config-driven toolbar, paste
normalization.
**Requirements covered:** FR-22
**User stories:** US-9
**Depends on:** Feature 4
**Branch suggestion:** feat/tiptap-editor
**Notes:** Shipped.

### Feature 21: Start-page project management — Shipped
**Value:** A writer on deadline creates, opens, renames, deletes, and
compiles a package from their whole project lifecycle without leaving the
app.
**Vertical slice:** Start page UI, project create/open/rename/delete
actions, package action that compiles selected resources.
**Requirements covered:** FR-23
**User stories:** US-15
**Depends on:** Feature 2
**Branch suggestion:** feat/start-page-project-management
**Notes:** Shipped. There is no copy action on the Start page. Package
compiles selected project resources to PDF, DOCX, Markdown, or text — it is
not a project-level zip export.

### Feature 22: Reference hover preview in the QueryBuilder value picker — Shipped
**Value:** A plain-file writer selecting a resource reference in a saved
query sees enough to confirm it's the right one, without navigating away.
**Vertical slice:** Hover tooltip rendering in the QueryBuilder value
picker, showing a referenced resource's stored name plus the first 8
characters of its id, or "Deleted" if the reference is broken.
**Requirements covered:** FR-24
**User stories:** US-7
**Depends on:** Feature 8
**Branch suggestion:** feat/reference-hover-preview
**Notes:** Shipped, but narrowly scoped — this is a hover tooltip in one
surface only (the QueryBuilder value picker). It never loads the referenced
resource's content and shows no excerpt or thumbnail. Resource-ref fields in
the Metadata Sidebar have no hover preview at all.
`frontend/src/lib/models/previews.ts` has zero production consumers and
backs no part of this feature or any other shipped capability.

### Feature 23: Per-project end-to-end encryption — Shipped
**Value:** A writer on desktop or native Android keeps their project
private at rest — if the device is lost or accessed by someone else, the
files are unreadable without unlocking the workspace.
**Vertical slice:** Workspace keyring with an unlock/lock session
lifecycle, sealed (AES-256-GCM, Argon2id-derived) file bodies via an
`encryptingAdapter.ts` `StorageAdapter` decorator, crash-safe and resumable
bidirectional conversion between plaintext and encrypted storage
(`convert-project.ts`), a plaintext export escape hatch, and opt-in
enable/resume orchestration.
**Requirements covered:** FR-25
**User stories:** US-16
**Depends on:** Feature 1
**Branch suggestion:** feat/e2e-encryption
**Notes:** Shipped, and substantial — this was omitted from the prior
feature list entirely. Scoped to desktop and native Android only; hosted
excludes it behind a fail-closed, server-side gate
(`crypto/encryption-availability.ts`) because the model layer does not yet
run client-side there.

### Feature 24: Organizer view — card filtering — Not started
**Value:** A plain-file writer filters the Organizer's card view by the
facets that matter to them, instead of only being able to hide/show bodies.
**Vertical slice:** Filter-state model in Organizer view, filter UI
controls, query wiring for Status, word count, and the project's
resource-reference fields.
**Requirements covered:** FR-26
**User stories:** US-7
**Depends on:** Feature 11
**Branch suggestion:** feat/organizer-filters
**Notes:** Not started. Organizer ships no card filtering of any kind
today; its only in-view control is a show/hide-bodies toggle. (Configuring
what a card body renders is a separate setting that already ships — see
Feature 11.) Real candidate for the next `/saboteur-ship` selection gate.

### Feature 25: Signed, warning-free desktop installers — Partial
**Value:** A plain-file writer installs the desktop build on macOS or
Windows without an OS security warning undermining trust in the app.
**Vertical slice:** Code-signing and notarization pipeline (macOS),
Windows code-signing, electron-builder packaging config changes.
**Requirements covered:** FR-27
**User stories:** US-8
**Depends on:** Feature 13
**Branch suggestion:** feat/signed-desktop-builds
**Notes:** Partial — build and packaging already ship; signing/notarization
is outstanding (tracked separately in the user's Electron Distribution TODO).

### Feature 26: Trash UI — browse, restore, purge — Not started
**Value:** A writer on deadline recovers an accidentally deleted resource
from within the app, with no filesystem detour.
**Vertical slice:** Trash UI surface (list, restore action, purge action),
wiring to the existing restore/purge model functions.
**Requirements covered:** FR-28
**User stories:** US-11
**Depends on:** Feature 1
**Branch suggestion:** feat/trash-ui
**Notes:** Not started as a shipped, user-facing feature. The underlying
soft-delete model (`trash.ts`, `.trash/` directory, restore/purge functions)
already exists and is not itself gated by this feature — only the UI is
missing.

### Feature 27: Search across all retained revisions — Not started
**Value:** A plain-file writer finds a match that exists in an older
revision, not only the current canonical text, and lands on the right
revision when they open its diff.
**Vertical slice:** Revision-aware indexing, search-result surfacing across
retained revisions of a resource, and diff-view wiring that consistently
selects the most recent matching revision when a diff is opened from such a
result.
**Requirements covered:** FR-29
**User stories:** US-7
**Depends on:** Feature 5, Feature 9
**Branch suggestion:** feat/search-across-revisions
**Notes:** Not started. Today search indexes and reads only each resource's
canonical revision; retained revisions remain browsable and diffable but are
not searchable. This requirement merges what a prior version of this
breakdown treated as two separate features (search-across-revisions, and
correct revision-selection on diff-open) into one, matching the parent
spec's FR-29.

### Feature 28: Hosted multi-device access to the same project — Partial
**Value:** A plain-file writer reaches the same project from more than one
device instead of being bound to a single machine.
**Vertical slice:** Hosted tenancy/auth wiring for end-user access, sync
transport for project data, desktop/hosted parity for the writing surface.
**Requirements covered:** FR-30
**User stories:** US-12
**Depends on:** none
**Branch suggestion:** feat/hosted-multi-device-access
**Notes:** Partial. Per-user tenant resolution, a production better-auth
identity source, full auth UI (login/verify-email/reset-password), a
pluggable object-store backend, route-level tenant enforcement tests, and a
live-infra smoke harness all ship. What's missing is the user-facing
multi-device product itself. Pursued on a fixed calendar horizon in
parallel with desktop work, per the parent spec's constraints — not gated
on desktop adoption metrics.

### Feature 29: Durable search backend for large projects — Not started
**Value:** A plain-file writer with a very large project keeps fast search
even after the JSON inverted index would otherwise bottleneck.
**Vertical slice:** Replacement search backend, migration path from the
existing inverted index, no user-facing behavior change beyond performance.
**Requirements covered:** FR-31
**User stories:** US-7
**Depends on:** Feature 9
**Branch suggestion:** feat/durable-search-backend
**Notes:** Not started. Contingent on demonstrated bottlenecking, per the
parent spec's phrasing ("once it demonstrably bottlenecks") — not scheduled
against a fixed date the way Feature 28 is.

### Feature 30: Multi-device conflict-resolution model — Not started
**Value:** A plain-file writer whose device was offline gets their edits
merged predictably when it reconnects, instead of silently losing or
duplicating work — without any notion of another person editing the
project.
**Vertical slice:** Conflict-detection logic for offline edits from
multiple devices of the same writer, a defined resolution policy (to be
designed), and the sync transport hook that applies it.
**Requirements covered:** FR-32
**User stories:** US-12
**Depends on:** Feature 28
**Branch suggestion:** feat/multi-device-conflict-resolution
**Notes:** Not started, and undesigned — a single-writer sync conflict
model only; multi-user/collaboration conflict handling is a permanent
non-goal per the parent spec's Non-goals. Broken out as its own feature so
it is not silently absorbed into Feature 28's scope.

### Feature 31: Scrivener/Word project importer — Not started
**Value:** A novelist migrating from Scrivener or Word imports their
existing project structure into GetWrite instead of manually re-creating it.
**Vertical slice:** `.scriv` and DOCX parsers, mapping from source project
structure to GetWrite's project-type/resource-tree model, an import flow in
the UI or CLI that runs the conversion.
**Requirements covered:** FR-33
**User stories:** US-4
**Depends on:** Feature 2
**Branch suggestion:** feat/scrivener-docx-importer
**Notes:** Not started. Planned, not near-term — no committed milestone
slot yet. No import path exists today from either format, which is a known
adoption risk called out in the parent spec's Constraints.

### Feature 32: Join full-text search with saved-query predicates — Not started
**Value:** A plain-file writer filters by full-text content and by
the query builder's fields in the same search, instead of using two
disconnected surfaces.
**Vertical slice:** Shared predicate model spanning full-text search and
the saved-query builder, UI wiring so either surface can apply the other's
predicates.
**Requirements covered:** FR-34
**User stories:** US-7
**Depends on:** Feature 9, Feature 8
**Branch suggestion:** feat/join-search-and-query-predicates
**Notes:** Not started. Both surfaces ship independently today (Feature 9's
full-text search; Feature 8's saved-query builder) but have never been
joined — full-text search has no predicate over the query builder's fields,
and the saved-query builder has no full-text-over-content predicate.

### Feature 33: Entity layer — automatic prose-mention detection — Not started
**Value:** A novelist who declares a resource as a character, place, or
object gets every prose mention of it across the whole project — by name or
alias — attributed automatically, instead of losing the connection the
moment they forget to bracket a manual link.
**Vertical slice:** A sidecar `entityKind` + ordered `aliases` schema
addition; case-insensitive, word-boundary-safe alias matching (with
possessive/plural forms) dispatched through the existing `indexer-queue` on
save; a new mention index persisted under `meta/index/`, separate from
`backlinks.json`; a `mentions` intrinsic field so saved queries and smart
folders can filter by entity mention; and two UI surfaces — a resource view
listing the entities detected in it, and an entity view listing every
mentioning resource with a snippet per occurrence, visually distinguished
from explicit links.
**Requirements covered:** FR-35
**User stories:** US-3
**Depends on:** Feature 7, Feature 9, Feature 10
**Branch suggestion:** feat/entity-layer
**Notes:** Not started. This entry closes a ladder gap: a complete rung-4
feature spec (`specs/features/entity-layer.md`) already exists for this
capability but had no rung-3 parent entry until now; the parent product
spec has since been amended with FR-35 to cover it. Detection runs fully
offline and reuses existing machinery (`indexer-queue`, `backlinks.ts`'s
resolver maps, `extractSnippet`) rather than introducing a new pipeline; it
does not change how explicit backlinks are computed or persisted.

---

## Coverage check

- Requirements covered:
  - FR-1: Feature 1
  - FR-2: Feature 2
  - FR-3: Feature 3
  - FR-4: Feature 4
  - FR-5: Feature 4
  - FR-6: Feature 4
  - FR-7: Feature 5
  - FR-8: Feature 6
  - FR-9: Feature 7
  - FR-10: Feature 8
  - FR-11: Feature 9
  - FR-12: Feature 10
  - FR-13: Feature 11
  - FR-14: Feature 12
  - FR-15: Feature 13
  - FR-16: Feature 14
  - FR-17: Feature 15
  - FR-18: Feature 16
  - FR-19: Feature 17
  - FR-20: Feature 18
  - FR-21: Feature 19
  - FR-22: Feature 20
  - FR-23: Feature 21
  - FR-24: Feature 22
  - FR-25: Feature 23
  - FR-26: Feature 24
  - FR-27: Feature 25
  - FR-28: Feature 26
  - FR-29: Feature 27
  - FR-30: Feature 28
  - FR-31: Feature 29
  - FR-32: Feature 30
  - FR-33: Feature 31
  - FR-34: Feature 32
  - FR-35: Feature 33
- Unassigned requirements: none

## Summary

- Total features: 33
- Suggested build order: Features 1 through 23 are already shipped
  (foundational chain: 1 → 2 → 6 → 7 → {8, 9, 18} → {9 → 11, 10} → 11 → {4 →
  5 → 11, 20}; 3, 13, 14, 15, 16, 17, 19, 21, 22, 23 hang off earlier shipped
  features independently). Of the remaining work: 24 (Organizer filters), 25
  (signed installers), 26 (Trash UI), and 27 (search across revisions) are
  independently startable now. 28 (hosted multi-device access) must land
  before 30 (its conflict-resolution model, which depends on it). 29
  (durable search backend) is contingent on demonstrated need rather than
  sequenced by dependency. 31 (Scrivener/Word importer) only depends on the
  already-shipped Feature 2. 32 (joining search and query predicates)
  depends on the already-shipped Features 8 and 9. 33 (entity layer) depends
  only on already-shipped Features 7, 9, and 10, so it is independently
  startable now too.
- Independently shippable: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33 (30 is
  the sole feature with a hard dependency, on 28)
- Risks: Feature 30 is undesigned — its Vertical slice describes a
  resolution policy still to be chosen, so its task breakdown will need a
  design decision before implementation tasks can be written. Feature 28 is
  the largest slice in this list (hosted tenancy + sync transport) and is
  likely to need its own further feature breakdown rather than a single
  task list, though substantial foundations already ship. Feature 31
  carries external-format-parsing risk (Scrivener's `.scriv` container
  format is undocumented by Scrivener itself) that may affect estimate
  confidence more than the other Not-started features. Feature 27 merges two
  previously separate concerns (revision-aware indexing and diff-open
  revision selection) per the parent spec's FR-29 correction; its task
  breakdown should confirm the merge doesn't hide two different sizes of
  work. Feature 33's own feature spec carries three unresolved open
  questions (alias-length/stop-word guarding, whether detection reads
  unsaved editor state, and performance targets) that should be settled
  before its task breakdown is written.

## Open Questions

None. (OQ-1, on licensing/distribution posture, is tracked in the parent
product spec and does not affect this feature partition. A previously
logged question here — Feature 33 having no rung-2 functional requirement —
was resolved when the parent product spec was amended with FR-35; see
Feature 33's Requirements covered field.)
