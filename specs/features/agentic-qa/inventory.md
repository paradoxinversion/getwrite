# Agentic QA — Feature Inventory (MVP)

Hand-authored per FR-7: this list is written by reading real GetWrite
behavior, not derived from specs, Storybook stories, or e2e test names. It
is deliberately small (four items) and scoped per FR-12 to projects,
resources, and revisions only — no other feature area is included.

Each item below records the three fields FR-8 requires at minimum: a
stable `id`, a human-readable `description`, and a `status` drawn from
exactly `pass | fail | unverified`. Statuses reflect the most recent run against a real, disposable workspace
(2026-08-18; see `run-report.md`). Three items passed. `rev-create-snapshot`
is `unverified`: the explicit-revision Save button was present and enabled but
not clickable — the canonical revision card overlapped its centre, so
`document.elementFromPoint` at the button resolved to the card. Per the
procedure that is an `unreachable` control, but the CLI has no way to record
`unreachable` or `unverified` (see the FR-11 gap noted in `run-report.md`'s
absence of this item), so it is recorded here by hand.

This file is meant to be read and updated programmatically-by-hand by the
QA agent procedure (Task 8) during a live run (Task 13) — keep the
`id: / description: / status:` shape stable so later edits are simple,
line-scoped changes rather than restructuring.

## Inventory items

### proj-create-manifest

- id: `proj-create-manifest`
- description: Create a new project via the app's New Project flow (name +
  project type) and confirm the app reports success and that
  `projects/<projectId>/project.json` exists on disk and validates against
  the project schema (`frontend/src/lib/models/schemas.ts`).
- status: pass

### res-create-content-files

- id: `res-create-content-files`
- description: Create a new resource (e.g. a document) inside an existing
  project via the resource tree's create flow and confirm the app reports
  success and that both
  `projects/<projectId>/resources/<resourceId>/content.txt` and
  `projects/<projectId>/resources/<resourceId>/content.tiptap.json` exist
  on disk for the new resource.
- status: pass

### res-save-content-roundtrip

- id: `res-save-content-roundtrip`
- description: Type distinctive text into the TipTap editor for an
  existing resource, trigger a save (autosave or explicit), and confirm
  the app reports the save succeeded and that the typed text is present in
  the on-disk `content.txt` for that resource
  (`projects/<projectId>/resources/<resourceId>/content.txt`), along with
  an updated sidecar at
  `projects/<projectId>/meta/resource-<resourceId>.meta.json`.
- status: pass

### rev-create-snapshot

- id: `rev-create-snapshot`
- description: Trigger creation of a new revision for a resource (via the
  editor's revision/version action) and confirm the app reports success
  and that a new snapshot directory exists at
  `projects/<projectId>/revisions/<resourceId>/v-<N>/` on disk, distinct
  from the resource's prior revisions.
- status: unverified
