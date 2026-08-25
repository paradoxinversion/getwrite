# Follow-up Work: Remove Locked Metadata

Deferred, non-blocking items discovered while implementing the feature. Each
notes why it was deferred and what a future implementer needs.

---

## 2026-06-14 — FIXED: feature toggles did not persist across a project reopen

**Symptom:** Toggling a feature on (Metadata Fields menu) updated the sidebar
in-session, but reopening the project showed it off again.

**Cause:** The write path was fine (`updateFeatureConfig` persists
`config.features` to `project.json`). The bug was in the **load/open flow**:
`app/page.tsx`'s `handleOpen`/`handleCreate` built the `StoredProject` payload
for `setProject` by hand and **omitted `features`/`organizerCardBody`**. So even
though `GET /api/projects` (`setProjects`) hydrated them, opening a project
re-dispatched `setProject` with `features: undefined`, clobbering the persisted
state.

**Fix:** Extracted a single `buildStoredProject(project, folders, resources)`
mapper in `projectsSlice.ts` (carries `features`/`organizerCardBody`/`statuses`/
`metadataSchema` and reduces resources to `ResourceMeta`), and used it at both
`page.tsx` call sites so the mapping can't drift again. Covered by
`buildStoredProject` unit tests in `projects-slice-features.test.ts`.

---

## 2026-06-14 — DECISION: split the Timeline _fields_ toggle from the Timeline _view_ toggle + disabled-tab tooltip

**Context:** The single `features.timeline` flag did double duty — it gated both
the story-timeline metadata fields (`storyDate`/`storyDuration`/`storyEndDate`)
_and_ the Timeline view/tab. A user who wanted the date metadata but not the
chronology view had no clean way to express that. Separately, when the Timeline
tab is disabled there was no explanation of why or how to enable it.

**Decision (two parts):**

1. **Split the flag.** `features.timeline` now gates **only the metadata fields**
   (in the Metadata Fields menu, where the field toggles live). A new
   `features.timelineView` flag gates **the Timeline view/tab**, toggled from a
   new "Timeline view" section in **User Preferences**. Fields-on/view-off is the
   primary use case (date metadata without the chronology view). The view
   _depends on_ the fields, so the two toggles are kept consistent in both
   directions: enabling the view (`TimelineViewToggle`) **also enables
   `timeline`** (no-op if already on), and disabling the fields
   (`ProjectFeatureToggles`) **also disables `timelineView`** — so there is never
   a "view on, no data fields" state. Each toggle shows a tooltip hint when its
   action would flip the other (view-toggle while fields off; field-toggle while
   view on). AppShell's tab/view gating moved from `selectTimelineEnabled` →
   `selectTimelineViewEnabled`; the sidebar fields stay on
   `selectTimelineEnabled`.

   _Migration:_ `timelineView` is seeded from story-data presence (same as the
   fields) for fresh projects, **and backfilled to `true` for existing projects
   that already had `timeline: true`** (so current users keep their view) —
   idempotent, never overrides an explicit value. Both toggle UIs now merge onto
   the full feature map (`selectActiveProjectFeatures`) rather than re-enumerate
   keys, so neither clobbers the other (the route replaces the block wholesale).

2. **Disabled-tab tooltip.** `ViewSwitcher` gained a `disabledReasons` prop; a
   disabled tab is wrapped in a hover target (a disabled `<button>` swallows
   pointer events) carrying a `react-tooltip` explaining why it's off and where
   to enable it. AppShell supplies the Timeline reason ("The Timeline view is
   off. Turn it on in User Preferences → Timeline view.").

This extends FR2/FR3 (the timeline opt-in is now two independent opt-ins). All
gating/migration plumbing otherwise unchanged.

---

## 2026-06-14 — DECISION: feature toggles relocated to the Metadata Fields menu (spec deviation)

**Context:** FR10 said the Timeline/POV/Synopsis/Notes toggles live in "project
settings"; Task 5 implemented them as a "Project Features" section in the User
Preferences page. In practice this split one concept across two menus — the
**Metadata Fields** menu (SchemaManager) shows the now-unlocked built-in fields,
while the on/off toggles lived in a _separate_ Preferences page. Result:
opening the metadata menu and seeing notes/synopsis unlocked with no toggle in
sight was confusing (reported in real use).

**Decision:** Relocate the `ProjectFeatureToggles` section to the **top of the
Metadata Fields menu** ("Built-in features"), co-located with the field
definitions it governs, and remove it from User Preferences. This is a
deliberate, agreed deviation from FR10's "project settings" wording (the menu is
still opened from the project settings/gear menu, so the intent — editable
post-creation, stored in `ProjectConfig` — is preserved). All plumbing
(`config.features`, gating selectors, the `updateProjectFeatures` thunk,
migration) is unchanged; only the toggle UI moved. `OrganizerCardBodySettings`
stays in Preferences (it is a display preference, not a field).

**Possible next step (not done):** the toggle-vs-remove duality still exists — a
built-in field can be toggled off (hidden, values kept) _or_ removed from the
schema (deleted). The fully-elegant model collapses these into one action
(field presence), deriving Timeline/POV from whether their fields exist; that is
a larger rework (default schema, project-type seeding, migration, view-gating)
deferred for now.

---

## 2026-06-13 — `normalizeProjectConfig` drops `config.features` / `config.organizerCardBody`

**✅ Resolved (2026-06-14):** `normalizeProjectConfig` now carries through
`features: config?.features` and `organizerCardBody: config?.organizerCardBody`.
Covered by a new `normalizeProjectConfig` describe in `tests/unit/project.test.ts`
(carries the keys through; leaves them `undefined` when no config is given).
`pnpm typecheck` clean; full suite green.

**Discovered during:** Task 4 (Config transport + slice wiring).

**What:** `frontend/src/lib/models/project.ts` → `normalizeProjectConfig()`
returns a new config object built from an explicit allow-list of keys. It does
**not** copy the two new Task 1 keys (`features`, `organizerCardBody`), so any
config passed through it loses them.

**Why it was deferred (not blocking):** Neither store-feeding load path runs
config through `normalizeProjectConfig`:

- `GET /api/projects` (mount/list) parses `project.json` raw and returns
  `config` verbatim → `setProjects` hydrates `features`/`organizerCardBody`.
- `POST /api/project` (single load) → `migrateProjectOnLoad` → raw read, also
  verbatim.

`normalizeProjectConfig` is only used by `loadProject` / `loadProjectConfig`
(`project-config.ts`) and `createProject`. Nothing currently reads the two new
keys through those paths, and new projects intentionally have no `features`
block (all toggles off by default, per FR1/FR2). So there is no live bug today.

**Risk if left:** A future caller that reads feature config via `loadProject()`
(rather than the store) would silently get `undefined` for both keys.

**Suggested fix:** Add `features: config?.features` and
`organizerCardBody: config?.organizerCardBody` to the object returned by
`normalizeProjectConfig`. Low risk (only adds keys when present); re-run
`tests/unit/project-config.test.ts` and any `normalizeProjectConfig` snapshot
tests afterward.

---

## 2026-06-13 — Stale e2e matcher `/story timeline/i` after the Task 2 group rename

**✅ Resolved (2026-06-14):** The matcher at
`frontend/e2e/metadata-sidebar.e2e.spec.ts` ~L144 is now `/timeline/i`, matching
the rendered "Timeline" header and the sibling assertion at ~L180. Not verified
by an e2e run (Playwright needs Storybook on :6006 and is outside `pnpm test:ci`),
but it is a direct correction to the renamed label; run `pnpm test:e2e` next time
Storybook is up to confirm the sidebar e2e is green end to end.

**Discovered during:** Task 7 (Sidebar conditional rendering).

**What:** `frontend/e2e/metadata-sidebar.e2e.spec.ts` (the
`collapse: clicking story timeline header…` test, ~L144) still targets
`page.getByRole("button", { name: /story timeline/i })`. Task 2 renamed the
`builtin-story-timeline` group **label** from "Story Timeline" to "Timeline", so
this regex no longer matches the rendered header and the click would miss.

**Why it was deferred (not blocking):** Playwright e2e is not part of
`pnpm test:ci` (it requires `pnpm storybook` on :6006 + `pnpm test:e2e`), so it
did not surface in any task's verification. The defect predates Task 7 — it is a
leftover from the Task 2 rename, not caused by the gating change. Task 7 only
touched the same file's _fixtures indirectly_ by enabling `features` in the
`MetadataSidebar` stories so the controls keep rendering for the e2e.

**Risk if left:** That one e2e test fails (or times out on the click) the next
time the Playwright suite is run.

**Suggested fix:** Change the matcher at ~L144 to `/timeline/i` (matching the
sibling assertions at ~L180). While there, run the full `pnpm test:e2e` against
Storybook to confirm the rest of the sidebar e2e is green under the new
feature-gated stories.

---

## 2026-06-14 — Timeline tooltip never renders `metadata.notes` (the computed value is dead data)

**✅ Resolved (2026-06-14):** Two parts, both now done. (1) The **source
mismatch** was fixed earlier — `TimelineView.tsx` reads `r.userMetadata?.notes`
(the gated Notes metadata field the sidebar reads/writes) instead of the legacy
resource-level `r.notes`, gated on `selectNotesEnabled`. (2) `TimelineTooltip.tsx`
now renders a `NOTES` `TooltipRow` when `item.metadata?.notes` is present, so the
computed value is finally displayed. Covered by `tests/timelineTooltip.test.tsx`
(row shown with value when notes present; omitted when absent).

**Discovered during:** Task 9 (Timeline POV/Notes-optional hardening).

**What:** `TimelineView.tsx` computes `metadata.notes` for each item (gated on
`selectNotesEnabled`), but `TimelineTooltip.tsx` renders **no** notes row — so
`metadata.notes` is currently dead data (the field's JSDoc even says "Structured
metadata for tooltip display"). _(Resolved sub-issue: the value was previously
read from resource-level `r.notes` rather than the gated `userMetadata.notes`;
those are different fields and the source is now corrected.)_

**Why it was deferred (not blocking):** Task 9's "done when" only requires the
tooltip to omit the notes line without error, which holds trivially because no
notes line exists. Adding a notes row would be a Timeline **visual** change,
which the spec lists under Out of scope ("Redesigning the … Timeline … visuals").
Gating the existing (unused) `metadata.notes` on the Notes toggle was the
in-scope, low-risk completion.

**Risk if left:** Notes that writers enter in the sidebar never surface on the
Timeline, even with the Notes feature on — a minor missing affordance, not a
correctness/data issue. `TimelineView` already computes the correct
(`userMetadata.notes`, gated) value; it is simply not displayed.

**Suggested fix (remaining):** Add a `NOTES` `TooltipRow` to
`TimelineTooltip.tsx`, rendered only when `item.metadata?.notes` is present, plus
a tooltip test. The data plumbing is already in place — this is purely the
Timeline-visual half that was deliberately deferred as a spec non-goal.

---

## 2026-06-14 — Organizer `text-excerpt` card body has no live data pipeline

**✅ Resolved (2026-06-14):** Added a scoped excerpt pipeline. New model helper
`readResourceExcerpts(projectPath, ids, maxChars)` reads each resource's
`content.txt` (capped to `maxChars + 1` so the resolver can still add an
ellipsis); new route `POST /api/project-resources/excerpts` and transport
`fetchResourceExcerpts` expose it. `OrganizerView` fetches excerpts **only for
the visible folder's text children, and only when the card-body source is
`text-excerpt`** (bounded + on-demand, off the project load path), and passes
them to the resolver via a new `textExcerpt` option (preferred over the store
resource's absent `plainText`). Covered by model, resolver, and OrganizerView
(fetch-path) tests. Note: `previews.ts` remains unused — a future caching
optimization, not required now.

**Discovered during:** Task 10 (Organizer card-body consumption).

**What:** The Task 10 consumption layer is complete and tested: `OrganizerCard`
now takes a resolved `body` prop, `OrganizerView` computes it via
`resolveOrganizerCardBody(child, config, { notesEnabled })`, and the
`text-excerpt` branch reads `resource.plainText` (the same field `previews.ts`
slices) and truncates it to `excerptLength`. **However, store resources do not
carry `plainText`.** The load path `getLocalResources()`
(`resource-persistence.ts`, behind `GET /api/projects`) reads only the sidecar
metadata and computes `wordCount` — it never attaches text content. And
`previews.ts` (`generatePreview` / `loadPreview` / `previewPath`) has **zero
callers**: no API route, no save-path generation, no store hydration. So in the
live app, `text-excerpt` mode currently renders **nothing** (an empty body),
even though the resolver, the card, and all three modes are unit/component
tested with text present.

**Why it was deferred (not blocking):** Task 10's "Done when" is satisfied by
the consumption layer — body reflects the config (field / excerpt / none), no
card reads `notes` directly, `showBody` still works, and component tests cover
all three modes. The Task 10 note explicitly anticipated this gap ("text-excerpt
mode needs resource text content, which the card does not currently receive;
plumb a preview/excerpt (reuse `previews.ts`)"). Wiring the actual pipeline
spans three layers — generate previews on the resource save path, a new
read API + transport (or an excerpt field added to the project-list payload),
and store hydration — and the project-list endpoint is a hot path, so an
unconditional per-resource `content.txt` read there is exactly what the note
warns against. That is its own task, larger than card consumption.

**Risk if left:** A user who selects "Text excerpt" in project settings (Task 6
UI) sees blank card bodies — the setting looks broken. `field` and `none` modes
(and the Notes back-compat default) work fully.

**Suggested fix:** Wire `previews.ts`: (1) call `generatePreview` on the text
save path so `meta/previews/<id>.json` carries an `excerpt`; (2) surface that
excerpt to the store — either fold a short `excerpt` into the `GET /api/projects`
resource payload or add a small batch preview-fetch transport that
`OrganizerView` calls for visible text resources; (3) source the
`text-excerpt` branch from that excerpt instead of (or in addition to)
`resource.plainText`. Keep the per-resource read on the **batch load**, never
per card render. Then add an integration test that exercises `text-excerpt` end
to end from disk.

---

## 2026-06-14 — System-wide flat-vs-nested sidecar representation inconsistency in the schema-value-migration subsystem

**✅ Resolved (2026-06-14):** All four disk-reading value-migration helpers in
`metadata-schema.ts` (`clearFieldFromSidecars`, `migrateFieldKeyInSidecars`,
and the change-type / update-options sidecar migrations) now operate through a
shared `userMetadataOf(sidecar)` accessor on the **canonical nested**
`userMetadata` map (matching `saveResource` / `getLocalResources` / the Task 3
migration). `field-values.ts` was deliberately left as-is: the query
`evaluate` route flattens `userMetadata` to a top-level map before calling the
evaluator, so it operates on the flattened view by contract. The
`metadata-schema-migration.test.ts` fixtures were rewritten from the unrealistic
flat shape to the nested shape (via `writeMeta`/`readMeta` helpers), and a
`clearField`-on-nested test was added to `metadata-schema.test.ts` (it fails
against the old top-level code, proving the bug). Full suite green.

**Discovered during:** Task 11 (regression coverage — FR6), and confirmed while
attempting the localized fix during the follow-up pass.

**What:** There are two competing on-disk sidecar representations for user
metadata values:

- **Nested (canonical writer):** `saveResource` in `resource-persistence.ts`
  writes `{ id, name, type, …, userMetadata: { <fieldKey>: <value> } }`. The
  load path (`getLocalResources`, `loadProjectFromDisk`) and the Task 3
  migration both read `sidecar.userMetadata[key]`.
- **Flat (schema-value-migration + field-values):** every value-migrating helper
  in `metadata-schema.ts` operates on the **top level** of the sidecar —
  `fieldKey in sidecar` / `sidecar[fieldKey]`. This includes
  `clearFieldFromSidecars` (clear-field), `migrateFieldKeyInSidecars`
  (rename-key), `changeFieldTypeWithMigration`, and
  `updateFieldOptionsWithMigration`. `field-values.ts` `enumerateFieldValues`
  likewise reads top-level keys (though it takes sidecars as a parameter, so the
  query route can hand it a flattened view).

If real on-disk sidecars are nested (as the canonical writer produces), then the
**entire flat subsystem operates on the wrong level** — clear-field never
clears, rename-key never migrates stored values, change-type never converts
them, etc. — and this is masked because the whole `metadata-schema-migration`
test suite writes **flat** fixtures (`writeSidecar(dir, id, { tone: "…" })`)
rather than the nested shape `saveResource` actually persists.

**Status of the attempted fix (reverted):** A localized patch to
`clearFieldFromSidecars` (delete from `sidecar.userMetadata` instead of the top
level) was implemented and then **reverted**, because (a) it broke the existing
flat-fixture tests in `metadata-schema-migration.test.ts`, and (b) it would
leave `clearField` inconsistent with its sibling migrators, which all still
operate flat. Fixing one function in isolation is wrong; this needs to be
reconciled across the whole subsystem at once.

**Why it was deferred (not blocking for this feature):** The spec lists
"Reinterpreting user data beyond preserving existing values" as a non-goal, and
the bug is _preservation-safe_ (it over-preserves — values are never silently
deleted), so it does **not** violate FR6. FR6 is covered: `removeField` (the
non-destructive remove) leaves sidecars byte-for-byte untouched (test in
`metadata-schema.test.ts`).

**Risk if left:** Destructive/transform schema-editor actions (clear values,
rename key, change type, edit options) may silently no-op against
canonically-written (nested) sidecars — values the user expects cleared remain
on disk; renamed/retyped fields keep their old stored values under the old key.
A privacy/expectation gap for "clear values" specifically.

**Suggested fix (its own task, not a quick patch):** First establish the ground
truth — confirm what the live metadata-edit path actually writes to disk (nested
vs flat) by inspecting an on-disk sidecar from a real project, since the sidebar
edit path may differ from `saveResource`. Then reconcile **all** value-migrating
helpers (`clearFieldFromSidecars`, `migrateFieldKeyInSidecars`,
`changeFieldTypeWithMigration`, `updateFieldOptionsWithMigration`) and
`field-values` to a single representation, and rewrite the
`metadata-schema-migration` fixtures to the canonical shape. Treat as a focused
data-layer correctness task with full migration-suite re-verification.
