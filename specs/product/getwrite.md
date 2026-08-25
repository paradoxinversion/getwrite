# Product Spec: GetWrite

**Milestone scope:** All milestones — Shipped / In Progress / Next / Later
**Status:** Draft
**Source concept:** GetWrite (reconstructed concept, backfilled 2026-08-24)

> **Reconstructed spec.** This document backfills the `saboteur-ship` ladder
> onto an existing codebase. Requirements under "Shipped Requirements" are a
> record of what the product already does, derived from the codebase, the
> Feb 2026 product-intent document (this file's own predecessor content — it
> was moved from `docs/app-spec.md` to this path on 2026-08-24 and rewritten
> in place, so its content lives in this path's git history rather than at
> the old, now-nonexistent path), `specs/product/getwrite.features.md`, and
> `docs/roadmap.md` — not a record of decisions made at build time. Later
> milestones reflect owner-supplied direction from a 2026-08-24 ideation
> interview.

## Overview

GetWrite is a local-first, filesystem-backed writing workspace for long-form,
structured projects — novels, serials, scripts. Writers working in this shape
are served badly by note-taking tools (which handle fragments but not a
manuscript's shape) and by dedicated structured-writing tools (which trap the
work in proprietary containers and offer no queryable layer over the writing
itself). GetWrite's value is that a long-form project can be structured,
annotated, and interrogated — via a typed, queryable metadata layer — while
remaining a plain directory of files the writer owns outright, with no
database and, on desktop, no server and no account.

The product is released and versioned: the current release is **2.1.0**
(tag `getwrite-v2.1.0`, released 2026-08-18, per
`.release-please-manifest.json` and `CHANGELOG.md`). This release-version
axis is separate from the milestone buckets below (Shipped / In Progress /
Next / Later), which track product maturity, not release numbers — the two
are not to be conflated. The desktop product is live and in use, not a
speculative or pre-1.0 effort; the Later-milestone items in this spec are
planned expansions of an already-shipped product, not the product's first
version.

## Goals

- A writer can scaffold a structured, multi-resource project from a
  declarative project type and see it as real folders and files on disk.
- A writer can author in a rich-text surface that autosaves into a single,
  always-present canonical revision, with prior revisions retained and
  diffable.
- A writer can attach typed metadata to any resource — an always-on Status
  field, five further built-in fields switched on per project, and any field
  they define themselves, including reference fields scoped to a folder of
  their choosing — and query across all of it.
- A writer can search full text across a project, filter by metadata, and
  follow backlinks between resources.
- A writer can compile a selected subtree into a single manuscript file
  (PDF, DOCX, or text) with predictable, rule-based ordering.
- The product achieves real desktop adoption by writers currently using
  Scrivener or plain-file/Obsidian-style workflows, not merely a working demo.

## Non-goals

- **Not a note-taking or PKM system.** GetWrite assumes a manuscript, not a
  graph of atomic notes.
- **Not a real-time collaborative editor.** Two people never edit the same
  project: collaboration and shared-project multi-user access are permanent
  non-goals, not a future maybe. Multi-device access for a single writer
  (the same writer reaching the same projects from more than one device) is
  a different, planned capability — see FR-30 and FR-32 — and is not
  collaboration.
- **Not a layout or typesetting tool.** Compile produces a manuscript, not a
  designed book interior.
- **Not a publishing or distribution platform.** The product's surface ends
  at export.
- **Not an AI writing assistant.** No generation or rewriting features are
  in scope at any milestone in this spec.
- Hosted multi-tenant access and Android are addressed only as later
  milestones (see Functional Requirements); this spec does not treat them as
  shipped even though technical foundations exist. They are pursued on a
  fixed calendar horizon in parallel with desktop work, not gated on desktop
  adoption metrics.
- **Shared-project multi-user access is out of scope.** Resolved: hosted
  GetWrite is sync for one writer across devices, never collaboration
  between two people on one project (see FR-32 for the multi-device sync
  conflict model this implies).

## Users

**Scrivener-frustrated novelists**
Writers who want Scrivener-grade project structure, corkboard, and compile
without a proprietary `.scriv` container or its aging interface.
**Key need:** Structured, multi-scene project management without format lock-in.
**Success looks like:** They can rebuild their existing workflow's structure
and compile step in GetWrite and stop needing Scrivener day to day.

**Plain-file-ownership writers**
Writers from Obsidian/markdown workflows who insist on inspectable,
scriptable, backup-friendly files but have outgrown a flat note graph.
**Key need:** Chapters, scenes, ordering, and compile on top of files they
still fully own.
**Success looks like:** They can open the project folder in any other tool
and lose nothing if GetWrite disappears, while getting compile and structure
a note vault can't offer.

**Working writers on deadline** (secondary)
Writers for whom compile and revision history are daily instruments, not
reassurance.
**Success looks like:** Compile output is clean enough to send to an agent
or publisher without manual cleanup, and revision history reliably recovers
lost work.

## User Stories

**Scrivener-frustrated novelists**
- US-1: As a novelist, I want to scaffold a new project from a declarative
  project type so that I get a working folder structure immediately. [Shipped]
- US-2: As a novelist, I want to compile a selected subtree of my project
  into a single manuscript file so that I can produce a deliverable draft. [Shipped]
- US-3: As a novelist, I want to link my scenes to the contents of a folder
  I choose, so that I can track who and what appears where — whether that
  folder holds characters, locations, factions, or anything else my project
  needs. [Shipped]
- US-4: As a novelist migrating from Scrivener or Word, I want to import my
  existing project into GetWrite so that I don't have to manually
  re-create its structure. [Later]

**Plain-file-ownership writers**
- US-5: As a plain-file writer, I want to have every resource stored as an
  inspectable file with a sidecar metadata file so that I can read or script
  my project outside GetWrite. [Shipped]
- US-6: As a plain-file writer, I want to move a resource without breaking
  its metadata associations so that reorganizing costs nothing. [Shipped]
- US-7: As a plain-file writer, I want to search full text with metadata
  filters and follow backlinks so that I can navigate a project too large to
  hold in memory. [Shipped]
- US-8: As a plain-file writer, I want to install a signed desktop build
  so that I can trust and use the app day to day. [In Progress]

**Working writers on deadline**
- US-9: As a writer on deadline, I want to autosave into a single canonical
  revision while retaining history so that I never lose work and can always
  see what changed. [Shipped]
- US-10: As a writer on deadline, I want to view a diff between revisions so
  that I can evaluate an edit before keeping it. [Shipped]
- US-11: As a writer on deadline, I want to browse and restore soft-deleted
  resources so that an accidental delete is recoverable without a filesystem
  detour. [Next]
- US-12: As a writer on deadline, I want to reach the same project from
  another device so that a project isn't bound to one machine. [Later]
- US-13: As a writer on deadline, I want to save and reuse resource
  templates so that I can create new resources with consistent structure
  without rebuilding it each time. [Shipped]
- US-14: As a writer on deadline, I want to define metadata fields beyond
  the built-in schema so that I can track attributes specific to my
  project. [Shipped]
- US-15: As a writer on deadline, I want to create, open, rename, delete,
  and package projects from a start page so that I can manage my whole
  project lifecycle without leaving the app. [Shipped]
- US-16: As a writer on deadline, I want to encrypt my project at rest on
  desktop or Android so that my files remain private if my device is lost
  or accessed by someone else. [Shipped]

## Functional Requirements

### Shipped Requirements

- FR-1: The product MUST persist all projects, resources, and metadata as
  files/directories on the local filesystem, with no database. [US-5]
- FR-2: Users MUST be able to create a project from a declarative project
  type that defines the initial folder layout and starter resources. [US-1]
- FR-3: Resource identity MUST be independent of file path; moving a
  resource MUST NOT break its metadata associations. [US-6]
- FR-4: The editor MUST autosave text edits, debounced, into the resource's
  canonical revision without creating a new revision on every save. [US-9]
- FR-5: Every resource MUST have exactly one canonical revision at all
  times, and a resource MUST NOT be left without at least one revision. [US-9]
- FR-6: The current canonical revision MUST NOT be deletable; other
  revisions MAY be deleted, subject to the max-revisions-per-resource
  pruning configuration. [US-9]
- FR-7: Users MUST be able to view a word-based diff between the current
  canonical revision and any other retained revision of a text resource. [US-10]
- FR-8: A multi-reference metadata field MUST be scopeable to a folder by
  folder **id**, never by folder name, chosen per field in the schema manager
  from every folder in the project plus an "Any folder" option, optionally
  including descendants. Single-reference fields are unscoped and draw on all
  resources. No folder name carries application semantics. A project type MAY
  additionally record an `isMetadataSource` flag and a `metadataInputType`
  against a folder. This is a **superseded** mechanism: until the
  schema-driven sidebar rewrite (`cc04767`, 2026-05-17) the sidebar selected
  folders by that flag and generated a reference row per folder, choosing the
  control from `metadataInputType`. The rewrite replaced folder-driven
  rendering with the per-field `refFolder` model above. The authoring control
  and the persistence remain; no consumer does. It therefore confers no
  privilege today.
  Deleting a resource that is referenced elsewhere MUST NOT remove the
  reference entry; it MUST nullify the reference (retaining `{id: null, name}`
  in place) rather than delete the entry, including within multi-reference
  arrays. [US-3]
- FR-9: Text resources MUST support the built-in metadata schema. Exactly one
  field is unconditional: Status, a locked, project-scoped select whose
  options come from the project type and are user-editable and reorderable.
  Five further built-in fields — Synopsis, Notes, Point of View (a single
  resource reference that also accepts free text, preserved as a name with a
  null id when no resource is linked or when a linked resource is later
  deleted), and the Timeline group's Story Date, Duration and Story End Date
  (stored with no ordering validation between start and end) — are each
  governed by a per-project feature toggle and are **hidden unless that
  toggle is on**; an absent flag reads as disabled. Toggling a field off hides
  its control without discarding stored values. Reference fields for entities
  such as characters, locations, or items are NOT built-ins — they are
  user-defined schema fields (FR-20), optionally folder-scoped (FR-8). [US-3]
- FR-10: Users MUST be able to save a metadata query and have it appear in
  the resource tree as a smart folder. [US-7]
- FR-11: Users MUST be able to search full text across all resources in a
  project and filter results by folder, Status, and Tags. [US-7]
- FR-12: The product MUST maintain a backlinks index between resources that
  reference one another. [US-7]
- FR-13: The work area MUST provide five views — Edit, Organizer, Data,
  Diff, and Timeline — each rendering the selected resource or folder per
  its type (text/image/audio/mixed). Timeline is gated behind a per-project
  `timelineView` feature flag and is disabled unless that flag is on;
  enabling it force-enables the timeline date fields, an invariant enforced
  at the feature-config write seam so the view can never be on without the
  data it reads. [US-9][US-10][US-7]
- FR-14: Compile MUST produce a single PDF, DOCX, Markdown, or text manuscript from a
  user-selected subtree of the resource tree, walking it depth-first with
  siblings ordered by their resource-tree position (plain resource-tree
  order, as arranged by the user); compile MUST NOT emit metadata and MUST
  NOT mutate revisions or project state. [US-2]
- FR-15: The product MUST ship as an account-free desktop application
  (Electron) that runs against the local filesystem with no server
  dependency. [US-5]
- FR-16: The product MUST support dark and light mode with a per-project
  color-mode preference. [US-5]
- FR-17: Users MUST be able to add image and audio resources through the UI
  via a type selector and file input in the create-resource flow, plus
  editor drag-and-drop; both feed a dedicated media viewer. [US-3]
- FR-18: The product MUST support project-scoped tags that can be created,
  assigned to and removed from resources, and deleted, with management UI
  in the sidebar and a tag manager modal; tags cannot be renamed at any
  layer (model or UI) — renaming a tag requires deleting and recreating it,
  which drops its existing resource assignments. [US-7]
- FR-19: Users MUST be able to save, create from, duplicate, and list
  resource templates via the CLI, producing reusable scaffolds for new
  resources; this capability is CLI-and-model-only — there is no UI and no
  HTTP route. A separate, richer template CLI (export/import to `.zip`,
  scaffold, validate, preview, version, changeset) exists in the source tree
  but is not wired into the shipped `getwrite-cli` binary and is reachable
  only from tests; it MUST NOT be treated as a shipped capability. [US-13]
- FR-20: Users MUST be able to define and manage custom metadata field
  definitions per project through a schema manager UI, beyond the built-in
  fields: add, edit, and delete field definitions; rename a field's label;
  rename a field's key with a migration preview; change a field's type with
  migration; reorder fields; and choose between deprecating and clearing a
  field as distinct removal semantics, with a preview of select-option
  removal before it is applied. Only the built-in `status` field is
  locked: it cannot be renamed, retyped, reordered, or removed, though its
  options are project-supplied and user-editable. Every other built-in field
  is unlocked at load time and is editable exactly like a user-defined field —
  `locked` protects a field definition, not its option list. [US-14]
- FR-21: Users MUST be able to reorder resources and folders via
  drag-and-drop, with order persisted to disk, and MUST have context-menu
  actions to create, rename, copy/duplicate (a single behavior offered
  under both labels), delete, convert to smart folder, and export tree
  nodes. [US-6]
- FR-22: The editor MUST provide TipTap-based WYSIWYG rich-text editing with
  a config-driven toolbar, heading/body styling, tables, and paste
  normalization. [US-9]
- FR-23: Users MUST be able to create, open, rename, delete, and package
  projects from a start page; package compiles selected project resources
  to PDF, DOCX, Markdown, or text — it is not a project-level zip export.
  [US-15]
- FR-24: The product MUST render a lightweight hover preview — the
  referenced resource's stored name plus the first 8 characters of its id,
  or "Deleted" if the reference is broken — when a resource reference is
  selected in the QueryBuilder value picker. This preview does not load the
  referenced resource's content and shows no excerpt or thumbnail, and
  resource-ref fields in the Metadata Sidebar have no hover preview at all.
  [US-7]
- FR-25: The product MUST support per-project, opt-in end-to-end encryption
  on desktop and native Android: a workspace keyring with an unlock/lock
  session lifecycle, sealed (AES-256-GCM, Argon2id-derived) file bodies for
  project content, crash-safe and resumable conversion between plaintext
  and encrypted storage in both directions, and a plaintext export escape
  hatch. This capability is scoped to desktop and native Android only; the
  hosted deployment excludes it behind a fail-closed, server-side gate (see
  Constraints). [US-16]

### In Progress Requirements

- FR-26: Organizer view MUST support filtering cards by Status, by word
  count, and by the resource-reference fields a project defines (the
  characters and locations folders the fiction templates provide being the
  common case); no card filtering of any kind exists today. Organizer's only
  in-view control is a show/hide-bodies toggle — though what a card body
  renders (nothing, a text excerpt of configurable length, or any metadata
  field) is a separate per-project setting that already ships. [US-7]
- FR-27: Desktop builds MUST be signed and installable without an OS
  security warning on macOS and Windows. [US-8]

### Next Requirements

- FR-28: Users MUST be able to browse, restore, and permanently purge
  soft-deleted resources through a dedicated Trash UI (the underlying
  restore/purge model already exists). [US-11]
- FR-29: Search MUST become able to find matches across all retained
  revisions of a resource, not only its canonical revision (today only the
  canonical revision is indexed and searched — see Constraints); when a
  user opens the diff view from such a result, the diff MUST consistently
  select the most recent matching revision. [US-7]

### Later Requirements

- FR-30: The product SHOULD ship hosted, multi-device access to the same
  project data as a user-facing product. The foundations already ship —
  per-user tenant resolution, a production better-auth identity source, full
  auth UI (login/verify-email/reset-password), a pluggable object-store
  backend, route-level tenant enforcement tests, and a live-infra smoke
  harness — but no user-facing multi-device product exists yet. This is
  pursued on a fixed calendar horizon in parallel with desktop work, not
  gated on desktop adoption metrics. [US-12]
- FR-31: The product SHOULD replace the JSON inverted index with a durable
  search backend once it demonstrably bottlenecks on large projects. [US-7]
- FR-32: The product SHOULD define a conflict-resolution model for a single
  writer's offline edits made from multiple devices to the same project (a
  sync, not collaboration, conflict model), as part of the hosted
  multi-device work in FR-30. [US-12]
- FR-33: The product SHOULD offer an importer for existing Scrivener
  (`.scriv`) or Word/DOCX projects, converting them into a GetWrite project
  structure. This is a real, planned feature belonging here in Later, not
  in Out of Scope. [US-4]
- FR-34: The product SHOULD extend full-text search filtering to the saved
  query builder's predicates — its intrinsics (word count, character count,
  created/updated dates, tags, inbound and outbound links) and any
  user-defined schema field, including reference fields sourced from
  metadata-source folders — joining the two currently-separate filter
  surfaces. Full-text search has no predicate over those fields today, and
  the saved-query builder has no full-text-over-content predicate. [US-7]

## Constraints

- Folder names carry no application semantics: any folder layout is valid,
  and no folder is protected from rename, delete, move, or reordering. A
  Workspace-folder invariant was considered earlier in the product's
  history and was deliberately removed; it is not planned to return as a
  special-named-folder mechanism.
- The single-canonical-revision invariant must hold at all times; no
  feature may leave a resource with zero or more than one canonical
  revision.
- Resource identity must remain independent of on-disk path for the life of
  the project; no feature may rely on path as identity.
- The desktop build must remain fully functional with no network access and
  no account.
- No import path currently exists from Scrivener (`.scriv`) or Word/DOCX
  projects; this is a known adoption risk not met by any shipped, in
  progress, or next requirement — an importer is a planned Later
  requirement (FR-33).
- Compile is export-only and must never mutate revisions or project state.
- Full-text search indexes and searches only each resource's canonical
  revision today; retained revisions remain browsable and diffable but are
  not searchable until FR-29 ships.
- `frontend/src/lib/models/previews.ts` (image/audio/text preview
  generation) has zero production consumers; no requirement in this spec
  relies on it, and it must not be described as a shipped capability.
- End-to-end encryption (FR-25) is offered only on desktop and native
  Android; the hosted deployment excludes it behind a fail-closed,
  server-side gate (`crypto/encryption-availability.ts`). Offering it on
  hosted before the model layer runs client-side would be a padlock whose
  key the server holds, so the gate is deliberate rather than a gap to
  close.
- The on-disk layout uses UUID-named directories for path-independent
  identity; this is a known tension with the "open your folder and see your
  files" ownership claim and is not resolved by this spec.
- Any hosted/multi-device work must not compromise the local-first, no-account
  desktop experience that is the stated basis for adoption. Hosted and
  Android work is not gated on desktop adoption metrics: both are timeboxed
  to a fixed calendar horizon and pursued as parallel-track investment
  alongside desktop work.
- Observability: the product collects no telemetry and must continue to collect
  none — there is no analytics or crash-reporting dependency in the tree, and the
  only outbound call on the desktop path is the opt-in GitHub release check.
  Diagnostics are a local log file (`app.getPath("logs")/getwrite.log`). A hosted
  deployment may add server-side health checks and structured logs, but nothing
  that reports a local user's activity off their machine.
- Performance: no performance budget is currently measured anywhere — there are
  no latency targets, benchmarks, or performance gates in CI. The one identified
  scaling limit is the whole-file JSON inverted index, which is expected to
  bottleneck on large projects (FR-31). This constraint records the absence
  deliberately: a target nobody measures is not a commitment, and any future
  budget should arrive with the measurement that enforces it.
- Hosted GetWrite's data model must support multi-device sync for a single
  writer without supporting multi-user collaboration on a shared project;
  see FR-32.

## Open Questions

**OQ-1: What is the licensing and distribution posture — open source, paid,
freemium?**
**Impact:** Affects positioning and any future feature gating; not
addressed by any requirement in this spec.
**Owner:** Product owner / business.
**Evidence:** Verified: no `LICENSE` file exists in the repository. The
root `package.json` declares `"license": "ISC"`, but this is `npm init`
scaffolding rather than a deliberate licensing decision — the other three
workspace packages (`frontend`, `electron`, `cli`) declare no `license`
field at all, which is inconsistent with a real, intentional choice having
been made.

## Out of Scope (Deferred)

- [Later] Hosted multi-tenant access and cross-device sync as a shipped,
  user-facing product (foundations exist per ADR-017–ADR-022; not shipped).
- [Later] Native Android packaging, signing, and distribution as a shipped
  release channel. The in-process app itself is complete — 15 native
  transport backends collapse every client→server call in-process, a real
  Capacitor filesystem bridge, native bootstrap, and a `build:native`
  static-export pipeline, running inside a real Gradle project
  (`android/android/{build,settings}.gradle`, `app/build.gradle`) — but
  `pnpm --filter getwrite-android build` is a placeholder log statement and
  CI exercises only that placeholder, not a real packaged build.
- Multi-user real-time collaborative editing, and multiple users on a
  shared project generally — a permanent non-goal, not a future milestone
  (resolved: see Non-goals and Constraints).
- [Exploring] Mobile/tablet-optimized responsive layout as a complete
  experience (partial implementation exists).
- [Exploring] Expanded resource-template CLI command set (export/import to
  `.zip`, scaffold, `--vars`, inspect, validate, preview, version,
  changeset) — this exists in the source tree (`cli/src/templates.ts`) but
  is not wired into the shipped `getwrite-cli` binary and is reachable only
  from tests (see FR-19).
