# Tasks: Entity-scoped compile

Source spec: `specs/features/entity-scoped-compile.md`. Granularity: story points (1/2/3/5/8).

### Task 1: Add the tree-position ordering bridge to `compileSelection.ts`
**What:** Adds a new exported function to `frontend/components/common/compileSelection.ts` — e.g. `orderResourceIdsByTreePosition(resources: AnyResource[], resourceIds: string[]): string[]` — that builds the full project resource tree via the existing `buildCompileTree`, computes the full depth-first, `orderIndex`-sibling-ordered leaf sequence via the existing `getDescendantLeafIds(ROOT_ITEM_ID, tree)`, and filters that sequence down to only the ids present in the input `resourceIds` set, preserving tree order and dropping duplicates/unknown ids.
**Files:** frontend/components/common/compileSelection.ts, frontend/tests/unit/compileSelection.test.ts
**Done when:** a test using the fixture tree already in `compileSelection.test.ts` (folder `f1` with `r1`,`r2`; nested `f2` with `r3`; top-level `r4`) confirms that passing an unordered/shuffled `resourceIds` subset (e.g. `["r4", "r1", "r3"]`) returns them in tree order (`["r1", "r3", "r4"]`); an id not present in the tree is silently dropped rather than throwing or appearing in the output; an empty `resourceIds` input returns `[]`; `pnpm --filter getwrite-frontend exec vitest run compileSelection` is green.
**Depends on:** none
**Estimate:** 3
**Notes:** This is FR-3 and FR-4's entire scope. `compileSelection.ts` already has zero DOM/`node:fs` imports (verified: it imports only `buildResourceTree` and `AnyResource`/`Folder` types) and is already exercised by both the web and native compile paths via `CompilePreviewModal.tsx`, so adding the new function here — rather than a new module — satisfies FR-4's transport-agnostic requirement for free, on precedent, without inventing a new file location. Do not implement this by trusting `getEntityMentionedIn`'s array order (FR-3 explicitly forbids that) — the whole point is the independent tree walk.
**Done:** [x]

### Task 2: Build the read-only ordered resource list component
**What:** Adds a new presentational component (e.g. `frontend/components/common/EntityCompileResourceList.tsx`) that renders a read-only, ordered list of resource entries (`{ resourceId, name, resourceType }[]`), displays the total count visibly, and visually marks any entry whose `resourceType` is not `"text"` as excluded from the compiled output (e.g. a muted row style plus an "excluded — not a text resource" label), per FR-11. No selection/toggle affordance — this list is display-only, unlike `CompileResourceTree`.
**Files:** frontend/components/common/EntityCompileResourceList.tsx, frontend/components/common/EntityCompileResourceList.stories.tsx, frontend/tests/component/EntityCompileResourceList.test.tsx
**Done when:** a test confirms the rendered count matches the input list length; a non-`"text"`-typed entry (e.g. `resourceType: "image"`) renders with a visible excluded marker/label while a `"text"`-typed entry does not; an empty input list renders a count of 0 with no error; the Storybook story renders a mixed sample (some text, one non-text entry) and passes the a11y addon check with no new violations.
**Depends on:** none
**Estimate:** 3
**Notes:** Prop shape is an agreed contract with Task 3 (which renders this component) and Task 5 (which assembles the `{resourceId, name, resourceType}` list by mapping Task 1's ordered id array against the project's full `resources` array) — no code dependency on either, so this task can proceed in parallel with Tasks 1 and 4.
**Done:** [x]

### Task 3: Add an entity-mode to `CompilePreviewModal.tsx`
**What:** Adds an optional prop-driven "entity mode" to `CompilePreviewModal.tsx` (e.g. an `entityMode?: { entries: EntityCompileEntry[]; orderedResourceIds: string[] }` prop) that, when present, replaces the `CompileResourceTree` checkbox tree and the Select All/Select None buttons with Task 2's read-only `EntityCompileResourceList`, and makes the Compile button's confirmed id list `entityMode.orderedResourceIds` directly instead of `getDescendantLeafIds(...).filter(checkedIds.has)`. The format `Select`, headers `Checkbox`, and name `input` controls, and the `onConfirmCompile(selectedIds, options)` callback contract, are left completely unchanged — entity mode only swaps the selection UI.
**Files:** frontend/components/common/CompilePreviewModal.tsx, frontend/tests/compilePreviewModal.test.tsx
**Done when:** with `entityMode` unset, all existing `compilePreviewModal.test.tsx` cases (tree rendering, select all/none, folder toggling, checkbox counts) still pass unmodified; a new test confirms that with `entityMode` set, the checkbox tree and Select All/None buttons do not render, `EntityCompileResourceList` renders instead showing `entityMode.entries`, and clicking Compile calls `onConfirmCompile` with exactly `entityMode.orderedResourceIds` (in that order) regardless of any tree/checkbox state; the format/headers/name controls render and behave identically in both modes.
**Depends on:** 2
**Estimate:** 3
**Notes:** This is FR-1's "reuse the output-option controls, replace the selection tree" requirement and FR-6's "same controls" requirement. Whether `entityMode` is implemented as shown here or as a wholly separate component wrapping shared internals is an implementation choice per FR-1 — this task's done condition only constrains observable behavior, not the internal split.
**Done:** [x]

### Task 4: Extract a shared compile-execute-and-download helper
**What:** Extracts `AppShell.tsx`'s inline `onConfirmCompile` format-branching body (the `compilePdf`/`compileDocx`/`compileMarkdown`/`compileText` calls, filename resolution, `triggerDownload`, and the font-fallback/Markdown-loss-warning toasts) into a standalone, reusable function — e.g. `runCompileAndDownload(compileBody: CompileBody, options: { format: CompileFormat; compilationName: string })` in a new module (e.g. `frontend/src/lib/compile/run-compile-and-download.ts`) — then updates `AppShell.tsx`'s `onConfirmCompile` to call it instead of duplicating the logic. `triggerDownload` moves alongside it (exported or kept module-private, implementor's choice) since both call sites need it.
**Files:** frontend/src/lib/compile/run-compile-and-download.ts, frontend/components/Layout/AppShell.tsx, frontend/tests/unit/runCompileAndDownload.test.ts
**Done when:** the new module exports a function that, given a `CompileBody` and format/name options, calls the correct one of the four existing `lib/api/compile.ts` client functions unchanged and triggers a download with the correct extension-normalized filename, verified by a unit test mocking `compilePdf`/`compileDocx`/`compileText`/`compileMarkdown`; `AppShell.tsx`'s compile confirm handler now delegates to this function with no behavioral change (existing AppShell/compile integration tests, if any, still pass); `pnpm --filter getwrite-frontend typecheck` passes.
**Depends on:** none
**Estimate:** 2
**Notes:** This is what lets FR-5's "reuse unchanged" apply to the *download/toast* orchestration too, not just the four compile client functions — without this extraction, Task 5's trigger would otherwise have to duplicate ~80 lines of format branching in `EntityMentionsSection.tsx`.
**Done:** [x]

### Task 5: Add the entity-scoped compile trigger and wiring in `EntityMentionsSection.tsx`
**What:** Adds a compile trigger control (button) to `EntityMentionsSection.tsx` and local component state to open Task 3's entity-mode `CompilePreviewModal`. On open, computes the FR-2 merged resource set from the `rows` this component already fetches via `getEntityMentionedIn` (both `isLinked` and `isMentioned` resources, exactly as returned — no additional filtering), orders it via Task 1's `orderResourceIdsByTreePosition` against the project's full resource list, builds Task 2's entry list (`{resourceId, name, resourceType}`, resourceType read from the matching entry in the full resources array) for display, and on confirm calls Task 4's `runCompileAndDownload` with a `CompileBody` built the same way `AppShell.tsx` already builds one (project directory id, ordered `resourceIds`, full `resources` array mapped to `{id, name, type}`, `includeHeaders`, `projectName`). When the FR-2 merged set is empty, the trigger button is disabled with an accessible reason (e.g. `aria-disabled` plus a visible "no associated resources to compile" message) rather than opening an empty/broken compile flow.
**Files:** frontend/components/Sidebar/EntityMentionsSection.tsx, frontend/tests/component/EntityMentionsSection.test.tsx
**Done when:** with a selected entity that has associated rows, the trigger button is enabled, keyboard-focusable and operable (Enter/Space activates it, verified by a test dispatching a keyboard event, not just a click), and has an accessible name (e.g. "Compile this entity's resources"); clicking it opens the modal pre-populated with the FR-2 merged set in FR-3 tree order; with a selected entity that has zero rows, the trigger is disabled (or absent) and no compile flow can be started, with a visible non-error explanation; confirming the modal calls `runCompileAndDownload` with exactly the ordered merged-set resource ids and no others.
**Depends on:** 1, 3, 4
**Estimate:** 5
**Notes:** Covers FR-1 (trigger location + reused controls), FR-2 (unfiltered merged set), FR-6 (format/headers/name controls, inherited from Task 3 unchanged), FR-7 (empty-set handling), and FR-9 (keyboard operability + accessible name). FR-1's "reachable only when `entities` is enabled" is already satisfied structurally — `MetadataSidebar.tsx` only renders `<EntityMentionsSection />` at all when `isEntitiesEnabled` is true — so no new gating code is needed here, only a test asserting the existing parent gating still applies (no regression).
**Done:** [x]

### Task 6: Integration test — merged-set fidelity, ordering, and no-write guarantee
**What:** Adds an integration test exercising the wired feature end to end against a fixture project with a declared entity, some mentioned resources, some explicitly linked resources, one resource that is both, and at least one non-text (e.g. image) associated resource, plus resources scattered across nested folders at varied `orderIndex` values. Confirms the resource set the UI compiles matches `getEntityMentionedIn`'s merged output exactly (FR-2), confirms the compiled id order matches an independently-computed tree-position order rather than the mention/backlink map's iteration order (FR-3), and confirms no file under the fixture project's `revisions/`, `meta/resource-*.meta.json`, or `meta/index/mentions.json` is modified (mtime/hash unchanged) before and after running a compile (FR-8).
**Files:** frontend/tests/integration/entity-scoped-compile.test.ts
**Done when:** the test asserts all three properties above against the same fixture in one run and passes; deliberately reordering the fixture's mention-index/backlink iteration (e.g. inserting records in a different sequence) does not change the asserted compiled order, demonstrating the ordering is tree-derived and not merged-set-order-derived, per FR-3's explicit prohibition.
**Depends on:** 5
**Estimate:** 3
**Notes:** none
**Done:** [x]

### Task 7: Verify native (Android) parity for entity-scoped compile
**What:** Confirms entity-scoped compile has no native-specific gap: the Task 1 ordering function and the Task 5 trigger component import nothing platform-specific (grep-verified: no `node:*` import, no direct DOM API beyond what any other React component already uses), and the feature relies exclusively on the already-native-parity `lib/api/mentions.ts`/`native-mentions-backend.ts` and `lib/api/compile.ts`/`native-compile-backend.ts` transports with no new route, transport, or native backend introduced.
**Files:** none (build/verification task; no source changes expected)
**Done when:** `pnpm --filter getwrite-frontend build:native` (or the project's documented native build equivalent) completes without error with Task 5's changes present, and does not newly bundle any `node:*`-only module; a check confirms `compileSelection.ts` (Task 1) and `EntityMentionsSection.tsx` (Task 5) contain no `runtime === "native"` branch and no direct `fetch`/HTTP call bypassing `lib/api/mentions.ts`/`lib/api/compile.ts`.
**Depends on:** 1, 5
**Estimate:** 2
**Notes:** This is FR-10's coverage. If a gap is found, file it back against Task 1 or Task 5 rather than patching ad hoc here, matching the equivalent verification task's convention in `specs/features/entity-highlighting/tasks.md` (Task 15).
**Done:** [x]

### Task 8: Manual verification pass in the running app
**What:** Exercises the complete feature by hand in the running desktop/web app (and, if a device is available, Android) to confirm behavior the automated suite cannot fully assert: visual appearance of the read-only list, real download output, and true end-to-end confirmation that the compiled file matches what was previewed.
**Files:** none (manual QA task; no source changes expected)
**Done when:** each of the following is confirmed by hand and recorded in the task's completion note: (1) opening an entity with both linked and mentioned resources shows the trigger, and it opens a modal listing exactly that merged set in resource-tree order, matching FR-2/FR-3; (2) the read-only list visibly marks a non-text associated resource (e.g. an image) as excluded, per FR-11; (3) choosing each of the four formats (PDF/DOCX/Markdown/plain text), toggling headers, and setting a compilation name each affect the downloaded file as expected, per FR-6; (4) compiling an entity with an empty associated set shows the disabled/empty-message behavior rather than downloading a broken file, per FR-7; (5) after running a compile, the entity's sidecar, its revisions, and `meta/index/mentions.json` are unchanged on disk, per FR-8; (6) the trigger is operable via keyboard alone (Tab to it, Enter/Space to activate) and reads a sensible accessible name via a screen reader or the browser's accessibility inspector, per FR-9; (7) with the project's `entities` feature flag off, no entity panel — and therefore no entity-scoped compile trigger — is reachable, per FR-1; (8) if a device is available, the same compile completes correctly with the device's network disabled, per FR-10.
**Depends on:** 3, 5, 6, 7
**Estimate:** 1
**Notes:** This is the manual-exercise task the automated suite cannot fully substitute for — live visual appearance of the excluded-entry marker, real file download contents, and true device-level offline behavior all need a human pass before sign-off, mirroring `specs/features/entity-highlighting/tasks.md`'s Task 16.
**Done:** [x]

## Summary
- Total tasks: 8
- Total estimated effort: 22 points
- Critical path: Tasks 2 → 3 → 5 → 6 → 8
- Risks: Task 5 is the largest and highest-integration-risk task — it is the only point where Tasks 1, 3, and 4 all converge into one file (`EntityMentionsSection.tsx`), so an interface mismatch between Task 1's ordering output, Task 2/3's entry shape, and Task 4's `CompileBody`-building contract would surface here rather than earlier. Task 4 (the shared download-helper extraction) touches `AppShell.tsx`'s existing compile confirm handler, which is exercised by pre-existing (uninventoried in this task list) AppShell/compile tests — a regression there would be an accidental side effect of a refactor meant to be behavior-preserving, so run the full existing compile-related suite, not just the new unit test, before considering Task 4 done. Tasks 1, 2, and 4 have no file overlap with each other or with anything but their own new/target files, so they are safe to run concurrently; Task 6 and Task 7 likewise share no files and can run concurrently once Task 5 lands.

## Open Questions

None. The source feature spec has zero open questions, and this task list introduces no new ones — every task is fully specified against the settled requirements.
