# Concept: GetWrite

> **Reconstructed document.** Written 2026-08-24 by backfilling the
> `saboteur-ship` ladder onto a repository that predates it. The problem
> statement, audience, success criteria, and roadmap posture below were
> supplied by the project owner in an ideation interview on that date. The
> capabilities and milestone placements were *inferred from the existing
> codebase* and its February 2026 product-intent document, then reconciled
> against those answers. Nothing here is a record of a decision made at the
> time the code was written. Where this document states a rationale, treat it
> as reconstruction unless it is marked as owner-supplied.
>
> **Shipped claims verified against code 2026-08-24.** Every "shipped" status in
> this document was checked against implementation code, not against the
> documents it was reconstructed from. That audit found several February 2026
> requirements had been recorded as shipped when they were never built — most
> notably a protected Workspace folder invariant, which was deliberately removed
> from the model. Those have been corrected here and in the product spec. What
> the audit did *not* verify is whether the shipped features work correctly,
> only that implementing code exists.

## Problem & Value

Writers working on long-form, structured projects — novels, serials, scripts —
are served badly at both ends of the tool spectrum. Note-taking systems handle
fragments but have no concept of a manuscript's shape. Word processors handle a
document but not a project made of hundreds of scenes across chapters. The tools
built specifically for this shape trap the work in proprietary formats, and none
of them offer a queryable layer over the writing itself: which scenes is this
character in, what happens in this location, which POV carries the second act.
GetWrite's value is that a long-form project can be structured, annotated, and
interrogated while remaining a plain directory of files the writer owns outright.

*(Owner-supplied: the three driving problems were weak long-form structure, the
absence of a metadata layer, and format lock-in. Revision handling was
explicitly **not** among them — see Caveats.)*

## Target Audience

**Primary — two overlapping groups** (owner-supplied):

- **Scrivener-frustrated novelists.** Writers who want Scrivener's project
  structure, corkboard, and compile without its proprietary `.scriv` container
  and aging interface. They already accept that a writing project is a
  structured thing, not a document.
- **Plain-file-ownership writers.** Writers drawn from Obsidian/markdown
  workflows who insist on inspectable, scriptable, backup-friendly files, but
  who have outgrown a note graph and need chapters, scenes, ordering, and
  compile.

**Secondary:** working writers on deadline, for whom compile and revision
history are daily instruments rather than reassurance.

## Core Concept

GetWrite is a writing workspace in which the filesystem *is* the data model.
A project is a directory. A scene is a file. Metadata is a sidecar file beside
the resource it describes. Revisions are numbered directories. There is no
database and, in the desktop build, no server and no account — a writer can open
the project folder in any other tool, back it up with any mechanism they already
trust, and lose nothing if GetWrite disappears.

On top of that substrate sit two things the plain-files approach normally gives
up. The first is *structure*: projects are scaffolded from declarative
project-type specs that define folder layout and starter resources. Any folder
may be declared a *metadata source*, making its contents available as typed
references from other resources — the built-in templates use this for
Characters, Locations, and Items, but the mechanism is generic and no folder
name carries application semantics. The second is *queryability*: every resource
carries typed metadata — status, characters, locations, POV, timeframe, notes —
which is indexed and can be queried, with saved queries surfacing in the resource
tree as smart folders. Resource identity is independent of path, so moving a
scene never breaks an association.

The editor writes into exactly one canonical revision per resource, with prior
versions retained as snapshots. This invariant — one canonical revision, always
present, never deletable — is what lets autosave, diffing, and compile coexist
without ambiguity about which text is "the" text.

## Key Capabilities

- Writers can scaffold a structured project from a project type and see it as
  real folders and files on disk.
- Writers can edit in a rich-text surface that autosaves into a single canonical
  revision, with prior revisions retained and diffable.
- Writers can attach typed metadata — characters, locations, items, POV,
  timeframe, status, notes — to any resource.
- Writers can query that metadata and pin saved queries into the tree as smart
  folders.
- Writers can search full text across resources with filters, and follow
  backlinks between resources.
- Writers can encrypt a project end-to-end on desktop and Android, unlocking a
  workspace per session, with a plaintext export escape hatch.
- Writers can compile a selected subtree into a single PDF, DOCX, Markdown, or text
  manuscript.
- Writers can view the project through several lenses: edit, card organizer,
  project statistics, revision diff, and chronological timeline.
- Writers can install it as an account-free desktop application, and (roadmap)
  reach the same projects from other devices.

## Feature Milestones

Because this is a backfill, these are *product-maturity* phases recording what
was built as much as what is next. They are **not** release numbers: the shipped
release line is already at **2.1.0** (`getwrite-v2.1.0`, released 2026-08-18, per
`.release-please-manifest.json` and the git tags). Do not read "Foundation" or
"Working product" below as pre-1.0 — both are complete and released.

**Foundation — complete.** The smallest thing that delivers the core value.
- Local-first project store with resource tree and project-type scaffolding — *shipped*. Without file-backed structure there is no product.
- Rich-text editor with debounced autosave into a canonical revision — *shipped*. The writing surface is the reason to open the app at all.
- Revision snapshots with the single-canonical invariant — *shipped*. Sequenced first because retrofitting this invariant later would invalidate every stored resource.

**Working product — complete except distribution.** Genuinely useful day-to-day, not merely demonstrable.
- Typed metadata layer with sidecars and a per-project schema — *shipped*. This is the differentiator; without it GetWrite is a folder of files.
- Metadata queries and smart folders — *shipped*. Metadata that cannot be interrogated does not repay the cost of entering it.
- Full-text search with folder/status/tag filters, plus backlinks — *shipped*. Required once a project exceeds what a writer can hold in memory. Note the richer predicates (character, location, word count) live in the saved-query builder, which has no full-text search; joining the two is planned, not shipped.
- Compile and export to PDF/DOCX/Markdown/text — *shipped*. The point at which the work leaves the tool; a writing app without it is a draft holder.
- Signed, installable desktop builds — *in progress, and the main thing standing between the current release and the stated success bar*. An unsigned build the OS warns against is an adoption wall, not a polish item.

**Working product, continued — also complete.**
- End-to-end encryption — *shipped* on desktop and native Android: per-project opt-in, a workspace keyring with a lock/unlock session, sealed file bodies, crash-safe resumable conversion in both directions, and a plaintext export escape hatch. Hosted is deliberately excluded by a fail-closed server-side gate, because encryption whose key the server holds is worse than none.
- Native Android app (in-process) — *shipped as code, not as a product*: the whole data layer collapses in-process on native with no HTTP round-trip, over a real Capacitor filesystem bridge and a real Gradle project. What is missing is packaging and distribution, not the app.

**Current — in flight.** Refinements and the parallel platform track.
- Trash recovery UI — model shipped, UI not started. Lower urgency because deletion already warns and the data is recoverable on disk.
- Organizer view filters (status, character, location, word count) — *not started*. Verified against code 2026-08-24: no Organizer filtering of any kind ships; its only control is a show/hide-bodies toggle. Earlier documents described status and folder filtering as shipped; that was inaccurate.
- Hosted access and multi-device sync for a single writer — foundations shipped (per-user tenancy, better-auth identity, object-store backend, route-level enforcement, a live-infra smoke harness). Owner-confirmed as genuine roadmap and **timeboxed to a fixed calendar horizon in parallel with desktop work**, rather than gated on desktop adoption metrics. Note E2EE is *not* among these foundations — it is a shipped desktop/Android feature that hosted deliberately excludes (see below).
- A conflict model for offline multi-device edits — *not yet designed*. Newly named: sync for one writer across devices still needs merge resolution even though collaboration is out of scope.
- Durable search backend for large projects — under evaluation. Deferred until the JSON index demonstrably bottlenecks.

**Later.**
- Import from Scrivener (`.scriv`) and Word/DOCX — *owner-confirmed as a real planned feature, not near-term*. Placed here rather than dropped because the adoption argument for it is strong (see Caveats), but it is not committed to current work.

## What This Is Not

- **Not a note-taking or PKM system.** It assumes a manuscript, not a graph of atomic notes.
- **Not a real-time collaborative editor.** The data model is single-writer; concurrent editing of one project is out of scope.
- **Not a layout or typesetting tool.** Compile produces a manuscript, not a designed book interior.
- **Not a publishing or distribution platform.** It ends at export.
- **Not an AI writing assistant.** No generation or rewriting features are contemplated.

## Competitive Landscape

*My knowledge of current feature sets and pricing for these products may be out of date; treat specifics as needing verification.*

**Scrivener** — the incumbent for structured long-form writing; widely used by novelists. Overlaps almost completely on structure, corkboard, and compile. Differs in that GetWrite stores plain inspectable files rather than a proprietary container, and offers a queryable typed metadata layer where Scrivener offers freeform keywords. Worth adopting: the depth and configurability of its compile pipeline, which is far ahead of anything here.

**Obsidian** — markdown note vault with a large plugin ecosystem; used by writers who value file ownership. Overlaps on plain files, backlinks, and search. Differs in that GetWrite is built around a manuscript with ordering, revisions, and compile rather than a note graph, and ships those as first-class rather than as community plugins. Worth adopting: its plugin extensibility, and the way local-first ownership is made legible to non-technical users.

**Ulysses** — polished markdown-based writing app with a sheet/group model and export. Overlaps on structured writing and export. Differs in that GetWrite's metadata is typed and queryable, and its storage is an open directory rather than a managed library. Worth adopting: the discipline of its writing surface — very few tools, very little chrome.

**Google Docs / Microsoft Word** — the default. Overlaps only on the editing surface. Differs on every structural axis. Worth adopting: their frictionless start — no concepts to learn before typing.

**Novelcrafter and similar recent entrants** — browser-based novel tools combining structure with a codex of characters/locations, increasingly with AI features. Overlaps substantially on the metadata/codex idea. Differs in local-first storage and no AI. Worth adopting: their treatment of the codex as a primary navigational surface rather than a sidebar.

**Clearest differentiator:** GetWrite is the only one of these that offers Scrivener-grade project structure *and* a typed, queryable metadata layer *on top of files the writer can read without the app*. The combination is the claim. What would make it noticeably better for the target audience is making that ownership tangible — a project folder a writer can open, understand, and trust at a glance — rather than merely technically true.

## Caveats & Pitfalls

- **Adoption: the switching cost is the whole battle.** Scrivener users have years of work in `.scriv` containers and no import path exists. Ownership arguments do not move people who would have to retype a novel. The absence of an importer may matter more than any feature on the roadmap. As of 2026-08-24 an importer is planned but deliberately not near-term, so this risk is carried knowingly.
- **Execution: compile is deceptively hard.** Output a writer will actually send to an agent or publisher is a long tail of formatting edge cases. Compile currently exists and is export-only; treating it as "done" is the most likely way to lose users at the last step.
- **Assumption: writers may not enter metadata.** The metadata layer is the differentiator, but it demands sustained manual annotation. If writers skip it, GetWrite degrades to a folder of files with a nice editor. Nothing in the design earns the annotation back automatically, and as of 2026-08-24 the owner has settled on manual-only deliberately — so this is an *accepted* risk, not an unexamined one. It is still the assumption most likely to be wrong, and nothing currently measures whether writers sustain the annotation.
- **Effort/pain mismatch (observed, not owner-stated).** Revision handling is the most heavily engineered subsystem in the codebase — invariants, guards, pruning, diff view, a dedicated slice — yet the owner did not list it among the driving problems. This is a measurement about where effort went, not a diagnosis of why; it is worth checking whether the roadmap is being set by what is interesting to build.
- **Roadmap tension — resolved in form, live in substance.** Success is defined as real users on desktop, while hosted multi-tenancy and Android are confirmed genuine direction (E2EE already ships on desktop and Android). The owner resolved the sequencing on 2026-08-24 by timeboxing the platform track in parallel rather than gating it on desktop traction. That settles *how* the decision gets made; it does not remove the contention for attention, and signed desktop builds — the one thing blocking the stated success bar — remain in progress while the parallel track runs.
- **Scale: the search index is known-provisional.** A JSON inverted index is expected to bottleneck on large projects, with no committed replacement.

## Technical Considerations

- **An import path from Scrivener and DOCX** is worth exploring early, because it is plausibly the single largest determinant of adoption and it constrains the data model.
- **A conflict model for the multi-device roadmap.** The current data model is single-writer with no merge story; hosted plus desktop plus Android implies concurrent edits to the same project. Worth resolving before the hosted path is committed, not after.
- **Making file ownership legible.** The on-disk layout uses UUID-named directories, which is defensible technically but undercuts the "open your folder and it's just files" promise. Worth exploring whether human-readable paths can coexist with path-independent identity.

## Open Questions

**Resolved 2026-08-24** (owner decisions, taken during the onboarding triage;
recorded here because every future run inherits them):

- **Migration from Scrivener/Word** — an importer is wanted, but as a *future*
  feature, not near-term. Placed in the Later milestone above.
- **Hosted/Android sequencing** — timeboxed to a fixed calendar horizon in
  parallel with desktop work, *not* gated on desktop adoption metrics.
- **Hosted multi-user model** — sync yes, collaboration no. One writer may reach
  their projects from multiple devices; two people never edit one project. This
  closes the multi-user question and opens a new design gap: an offline
  conflict/merge model for a single writer across devices.
- **Metadata annotation** — manual annotation is the settled design. Automatic
  inference/extraction stays out of scope. This is no longer treated as an open
  assumption, though it remains a risk the owner has knowingly accepted (see
  Caveats).

**Still open:**

- What is the licensing and distribution posture — open source, paid, freemium?
  Verified: no `LICENSE` file exists anywhere in the repository, and the root
  `package.json`'s `"license": "ISC"` is `npm init` scaffolding rather than a
  decision (the other three workspace packages declare no license at all).

## Next Steps

The concept is ready to be specced. Expand it with write-product-spec, using a
milestone that distinguishes already-shipped requirements from planned ones —
most of MVP and v1 above already exists, and a spec describing only future work
would silently un-specify the product. The open questions on migration and on
the hosted/desktop sequencing should be resolved during that pass.
