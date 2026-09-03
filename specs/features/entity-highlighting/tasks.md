# Tasks: Entity highlighting in the editor

Source spec: `specs/features/entity-highlighting.md` (committed `db08c7ee`). Granularity: story points (1/2/3/5/8).

### Task 1: Add the `entityHighlighting` project feature flag
**What:** Adds a new optional boolean `entityHighlighting` to `ProjectFeatureFlagsSchema`, alongside `entities`, following the exact pattern commit `df2e5554` used to add `entities` — the schema field, the hand-maintained `ProjectFeatureFlags` interface, the `FEATURE_FIELD_KEYS` record, and a `selectEntityHighlightingEnabled` selector in `projectsSlice.ts` built on `selectIsFeatureEnabled`.
**Files:** frontend/src/lib/models/schemas.ts, frontend/src/lib/models/types.ts, frontend/src/store/projectsSlice.ts
**Done when:** `ProjectFeatureFlagsSchema` parses `{ entityHighlighting: true }` and `{}` (absent reads as disabled); `FEATURE_FIELD_KEYS` includes the new key; `selectEntityHighlightingEnabled` returns `false` for a project with no `features` block and `true` only when the flag is explicitly `true`; `pnpm typecheck` passes.
**Depends on:** none
**Estimate:** 2
**Notes:** This is FR-1 and OQ-3's resolution — the flag lives on `ProjectFeatureFlagsSchema`, never in `editorConfigSlice`.
**Done:** [ ]

### Task 2: Add the highlighting toggle to project feature settings, gated on `entities`
**What:** Adds an "Entity highlighting" toggle to `ProjectFeatureToggles.tsx` that reads/writes the Task 1 flag via the existing `updateFeatureConfig` write path, and is hidden (not merely disabled) whenever the project's `entities` flag is off, per FR-8.
**Files:** frontend/components/preferences/ProjectFeatureToggles.tsx, frontend/tests/projectFeatureToggles.test.tsx
**Done when:** with `entities` off, no "Entity highlighting" control renders in the panel (assert via a test asserting `queryByLabelText`/`queryByText` returns null); with `entities` on, the toggle renders, and flipping it persists `entityHighlighting` through `updateFeatureConfig`; existing `projectFeatureToggles.test.tsx` cases still pass.
**Depends on:** 1
**Estimate:** 2
**Notes:** none
**Done:** [ ]

### Task 3: Add a project-scoped HTTP route exposing the entity alias table
**What:** Adds `GET /api/project/[project-id]/entity-alias-table`, following the `[project-id]/search` route's path-param convention and the `resource/[resource-id]/mentions` route's shape (resolve project root, call the model function, return JSON, wrapped in `withStorageContext`), calling the existing server-side `buildEntityAliasTable` (`entity-alias-table.ts`) — no new business logic, only a transport wrapper.
**Files:** frontend/app/api/project/[project-id]/entity-alias-table/route.ts, frontend/tests (new or existing API route test file)
**Done when:** a GET request against a project with declared entities returns `{ entities, claimedBy }` matching `buildEntityAliasTable`'s output shape; a request against an invalid/missing `project-id` returns the same fail-closed 4xx response `resolveProjectPath`/`validateProjectId` already produces for other project-scoped routes; a route test covers both cases.
**Depends on:** none
**Estimate:** 2
**Notes:** This route exists only for the web/desktop transport (Task 4); the native transport (Task 5) calls `buildEntityAliasTable` in-process and never hits this route.
**Done:** [ ]

### Task 4: Add the client transport module for the alias table
**What:** Adds `frontend/src/lib/api/entity-alias-table.ts` defining an `EntityAliasTableTransport` interface with a single `getEntityAliasTable(projectId)` method, an `httpEntityAliasTableTransport` implementation that fetches the Task 3 route and degrades to `{ entities: {}, claimedBy: {} }` on any failure (matching `lib/api/mentions.ts`'s degrade-gracefully contract), and `resolveEntityAliasTableTransport` built on `createTransport`.
**Files:** frontend/src/lib/api/entity-alias-table.ts, frontend/tests (unit test for the HTTP path, mocking `fetch`)
**Done when:** `getEntityAliasTable` returns the parsed alias table on a 200 response and the empty-table fallback on a network error or non-2xx response, verified by a unit test; the module's native dynamic-import specifier is a literal string (required for Task 5's `next.config.mjs` substitution).
**Depends on:** 3
**Estimate:** 2
**Notes:** Model directly on `lib/api/mentions.ts` — the closest existing worked example of a read-only, degrade-gracefully, transport-collapsed client module.
**Done:** [ ]

### Task 5: Add native transport parity for the alias table
**What:** Adds `frontend/src/store/transport/native-entity-alias-table-backend.ts` (in-process, calling `buildEntityAliasTable` via `resolveProjectRoot`, mirroring `native-mentions-backend.ts`'s structure and its degrade-to-empty-table parity) and its `.web-stub.ts` counterpart, and registers the substitution in `frontend/next.config.mjs`'s `turbopack.resolveAlias` so the native backend's `node:*`-carrying code never enters the web/desktop bundle.
**Files:** frontend/src/store/transport/native-entity-alias-table-backend.ts, frontend/src/store/transport/native-entity-alias-table-backend.web-stub.ts, frontend/next.config.mjs
**Done when:** `createNativeEntityAliasTableTransport` resolves the same shape as the HTTP transport for a fixture project, tested via `createNativeRunner`'s injectable `deps.fs` (mirroring `native-mentions-backend`'s test pattern); `next.config.mjs` substitutes the web-stub for the exact import specifier used in Task 4; `pnpm --filter getwrite-frontend build` (web target) contains no `node:*`-only module from the native backend (spot-checked via existing native-backend build verification approach used for other Phase 2 backends).
**Depends on:** 4
**Estimate:** 3
**Notes:** This is the FR-6 native-parity requirement — a web-only alias-table endpoint would be a regression per the task brief.
**Done:** [ ]

### Task 6: Add client-side alias-table caching with the three FR-12 refetch triggers
**What:** Adds a small client-side cache for the current project's alias table (a Redux slice following the existing `<feature>Slice.ts` + selector pattern, e.g. `entityAliasTableSlice.ts`) that refetches via Task 4's transport on project load, on resource load, and whenever `updateSidecar` resolves for a resource carrying `entityKind`/`aliases` (currently only `EntitySection.tsx`'s save path) in the same client session — with no `metadataRevision`-based push signal, per FR-12/OQ-4.
**Files:** frontend/src/store/entityAliasTableSlice.ts, frontend/src/store/projectsSlice.ts (or its load thunk), frontend/src/store/resourcesSlice.ts (or its load thunk), frontend/components/Sidebar/EntitySection.tsx, frontend/tests (slice unit tests)
**Done when:** a unit test confirms the slice's alias table updates after each of the three trigger points (project-load thunk, resource-load thunk, and a resolved `updateSidecar` call from `EntitySection.tsx`) and does NOT update on any other action; no `metadataRevision` field or counter is read or written by this slice.
**Depends on:** 4, 5
**Estimate:** 3
**Notes:** Concurrent-tab staleness (a second tab's edit not propagating to a first tab's open highlights) is an accepted limitation per OQ-4 — do not add cross-tab sync (e.g. `storage` events) to compensate; that would exceed spec.
**Done:** [ ]

### Task 7: Benchmark highlight-rescan latency and select mitigation(s) (OQ-1)
**What:** Builds a standalone, repeatable benchmark harness that generates synthetic ProseMirror documents at 500, 2,500, and 5,000 words and synthetic alias tables at 50, 200, and 500 declared aliases (9 combinations), measures full-document rescan time using `findMentionOffsets` for each declared term against each document, and profiles the same corpora under three mitigations: (a) a single combined alternation regex across all terms, (b) step-map-scoped rescanning of only the changed range on each transaction, and (c) debouncing the rescan. Produces a written measurement (numbers, not a diagnosis) that fixes FR-9's latency threshold and states which mitigation(s), if any, are needed to stay under it.
**Files:** frontend/tests (or a scripts/benchmark harness under frontend/), a short measurement note appended to this feature's working notes (not the committed feature spec, which is final)
**Done when:** the benchmark runs deterministically (e.g. via `pnpm --filter getwrite-frontend exec vitest run <bench file>` or an equivalent script) and reports elapsed time per combination and per mitigation; a specific millisecond threshold for "no user-visible input lag on every keystroke" is recorded, along with which of the three mitigations (zero, one, or more) the measurement shows are necessary to meet it at the 500-alias/5,000-word ceiling.
**Depends on:** none
**Estimate:** 5
**Notes:** This is the measurement task the resolved OQ-1 entry requires before FR-9 can be marked verified. Do not assume a mitigation going in — Task 8 implements only what this task's numbers show are needed, not all three unconditionally.
**Done:** [ ]

### Task 8: Build the entity-match decoration core (matching + two visual states)
**What:** Implements the pure, framework-agnostic core that, given a ProseMirror document, an `EntityAliasTable`, and the `entity-alias-warnings.ts`/`claimedBy` inputs, computes decoration ranges reusing `findMentionOffsets` per declared term (name + aliases, case-insensitive, word-boundary, possessive, simple-plural — no reimplementation of matching), classifying each match into exactly one of two states per FR-10: plain-match, or "needs attention" when the matched term is alias-warning-flagged or is a `claimedBy`-ambiguous term. Applies whichever mitigation(s) Task 7 found necessary.
**Files:** frontend/components/Editor/Extensions/entityHighlightDecoration.ts (or similar; core logic file, not yet the TipTap extension wrapper), frontend/tests/entityHighlightDecoration.test.ts
**Done when:** unit tests cover: an unambiguous name match renders plain; an alias flagged by `getAliasWarning` renders "needs attention"; a term present in `claimedBy` renders "needs attention"; a term matching both conditions still renders as exactly one "needs attention" state (no third style); possessive/plural/case-insensitive matches are found via the same rules as `findMentionOffsets`; no match crosses a hyphenated compound or occurs inside a larger word; performance stays within Task 7's threshold on the benchmark's largest fixture.
**Depends on:** 7
**Estimate:** 5
**Notes:** Keep this file free of TipTap/ProseMirror view imports where possible so it stays independently testable, mirroring how `buildWikiLinkDecorations` in `WikiLinkDecoration.ts` is a plain function called from the plugin's `state.init`/`apply`.
**Done:** [ ]

### Task 9: Wire the decoration extension into the editor, gated by both flags
**What:** Adds a TipTap `Extension` (e.g. `EntityHighlightDecoration`) following `WikiLinkDecoration.ts`'s `Plugin`/`PluginKey`/`DecorationSet` structure, registers it via the runtime-configured `.configure(...)` pattern in `TipTapEditor.tsx` (alongside `MediaDropExtension`/`GetWriteImage`, using a ref for the live alias table so the editor isn't re-created on every alias-table refetch), and gates its effect on both `selectEntityHighlightingEnabled` (Task 1) AND `selectEntitiesEnabled` (existing) being true — producing zero decorations and zero matching work when either is false, per FR-1/FR-8.
**Files:** frontend/components/Editor/Extensions/EntityHighlightDecoration.ts, frontend/components/TipTapEditor.tsx
**Done when:** with either flag off, the editor renders no highlight decorations and `EntityHighlightDecoration`'s plugin does no matching work (verified by a test asserting no DOM highlight nodes and no `findMentionOffsets` calls); with both flags on, matches from Task 8's core render as decorations at the correct ProseMirror positions in the live, unsaved document (not from `meta/index/mentions.json`), per FR-2/FR-3/FR-4.
**Depends on:** 1, 6, 8
**Estimate:** 3
**Notes:** Decoration-only — must not touch `content.txt`, `content.tiptap.json`, the sidecar, or any index file; a test should assert no write call occurs when toggling highlighting on/off or scrolling/editing under it.
**Done:** [ ]

### Task 10: Style the two highlight states and add a Storybook story
**What:** Adds CSS/brand-token-based styling for the plain-match and "needs attention" states (two states only, per FR-10), using tokens other than the reserved `red`/`#D44040`, and without reducing the editor's 1.8 line-height floor, then adds a Storybook story exercising both states in a sample document.
**Files:** frontend/components/Editor/Extensions/EntityHighlightDecoration.ts (or a co-located CSS module), frontend/styles/ (token usage), frontend/components/Editor/Extensions/EntityHighlightDecoration.stories.tsx
**Done when:** the two decoration classes resolve to visually distinct, non-`red` colors in both light and light/dark tokens; a computed-style or snapshot test/story confirms neither highlight style sets `line-height` below 1.8; the Storybook story renders both states with sample text and passes the a11y addon check with no new violations.
**Depends on:** 9
**Estimate:** 2
**Notes:** none
**Done:** [ ]

### Task 11: Add hover/title disclosure for the "needs attention" state
**What:** Implements FR-11: a "needs attention" decoration exposes, via `title` attribute (covering both pointer-hover and non-pointer access), which condition applies — short/common-word alias, ambiguous claim, or both.
**Files:** frontend/components/Editor/Extensions/EntityHighlightDecoration.ts
**Done when:** a unit test asserts the decoration's `title` text names "alias" wording when only `getAliasWarning` flags the term, "ambiguous"/"claimed by" wording when only `claimedBy` flags it, and text naming both when both conditions apply to the same term; the plain-match state has no such attribute (or an empty one).
**Depends on:** 9, 10
**Estimate:** 2
**Notes:** none
**Done:** [ ]

### Task 12: Live-update decorations on document edits and alias-table changes
**What:** Ensures FR-5: the plugin's decoration state recomputes on every `docChanged` transaction (as `WikiLinkDecoration` already does) AND whenever the Task 6 slice's alias table changes for the active project/resource, without a manual refresh or resource reload — e.g. by dispatching a no-op transaction with plugin metadata when the alias table updates, read by the plugin's `apply`.
**Files:** frontend/components/Editor/Extensions/EntityHighlightDecoration.ts, frontend/components/TipTapEditor.tsx
**Done when:** a test that (a) edits the document text and (b) updates the injected alias table (e.g. a new alias added) each independently causes the decoration set to change on the next render tick, with no full resource reload in between.
**Depends on:** 9
**Estimate:** 3
**Notes:** none
**Done:** [ ]

### Task 13: Unit tests for the decoration core's edge cases
**What:** Extends test coverage beyond Task 8's baseline to the matching edge cases the spec calls out explicitly: case-insensitivity, word-boundary exclusion (no match inside a larger word), no match across a hyphenated compound, possessive and simple-plural forms, and an entity with zero declared aliases matching on `name` alone.
**Files:** frontend/tests/entityHighlightDecoration.test.ts
**Done when:** each edge case above has a dedicated passing test case; `pnpm --filter getwrite-frontend exec vitest run entityHighlightDecoration` is green.
**Depends on:** 8
**Estimate:** 3
**Notes:** This task exists separately from Task 8 so the core's happy-path tests (Task 8) aren't blocked on exhaustively enumerating every matching edge case up front.
**Done:** [ ]

### Task 14: Integration tests for the toggle, transport, and flag-gating end to end
**What:** Adds integration-level tests covering: the feature-toggle write round trip (Task 2) end to end through `updateFeatureConfig`; the HTTP transport (Task 4) against a real fixture project via the Task 3 route; and the native transport (Task 5) returning the same shape as the HTTP transport for the same fixture project (parity assertion).
**Files:** frontend/tests (new or existing integration test files for feature toggles, entity-alias-table transport, and native/web parity)
**Done when:** all three integration paths above are covered by passing tests; the native/web parity test asserts byte-for-byte-equivalent (or structurally-equivalent) alias-table output for the same fixture, per FR-6.
**Depends on:** 2, 4, 5, 6
**Estimate:** 3
**Notes:** none
**Done:** [ ]

### Task 15: Verify the native (Android) build carries no highlighting-specific gap
**What:** Runs `frontend`'s native build (`pnpm build:native`) with the new transport wired in and confirms the shadow build tree contains no `node:*`-only code from `native-entity-alias-table-backend.ts` (the web-stub substitution from Task 5 took effect) and that the highlighting extension itself has no native-specific branch or omission.
**Files:** none (build/verification task; no source changes expected)
**Done when:** `pnpm --filter getwrite-frontend build:native` (or the project's documented equivalent) completes without error and without bundling the native backend's server-side imports; a manual or scripted check confirms `EntityHighlightDecoration`'s extension code path is runtime-agnostic (no `runtime === "native"` branch inside it).
**Depends on:** 5, 9
**Estimate:** 2
**Notes:** This is a build/verification task, not new feature code — if it uncovers a gap, file it back against Task 5 or Task 9 rather than patching ad hoc here.
**Done:** [ ]

### Task 16: Manual verification pass in the running app
**What:** Exercises the complete feature by hand in the running desktop/web app (and, if a device is available, Android) to confirm behavior the automated suite cannot fully assert: visual appearance, hover disclosure timing, and true offline operation.
**Files:** none (manual QA task; no source changes expected)
**Done when:** each of the following is confirmed by hand and recorded in the task's completion note: (1) toggling highlighting on/off in Preferences immediately changes editor behavior with no reload; (2) typing a new entity name/alias occurrence highlights it live without saving; (3) editing an entity's aliases in `EntitySection.tsx` updates open-editor highlights within the same tab without a manual refresh; (4) hovering a "needs attention" highlight shows the correct disclosure text for each of the three cases (alias-warning only, ambiguous only, both); (5) the two visual states are visually distinguishable and neither uses the reserved red token; (6) with the device's network disabled, highlighting continues to work (FR-6); (7) with `entities` off, no toggle or highlighting is reachable (FR-8).
**Depends on:** 9, 10, 11, 12, 15
**Estimate:** 1
**Notes:** This is the Stage 6.5 manual-exercise task — the automated suite cannot verify live visual appearance, hover timing, or true device-level offline behavior, so this checklist is required before sign-off.
**Done:** [ ]

## Summary
- Total tasks: 16
- Total estimated effort: 43 points
- Critical path: Tasks 3 → 4 → 5 → 6 → 9 → 10 → 11 → 16
- Risks: Task 7 (the OQ-1 benchmark) is the highest-uncertainty task — its numbers determine whether Task 8 needs zero, one, or all three mitigations, so a slow or ambiguous benchmark result could force rework of Task 8 after the fact. Task 6 (the alias-table cache and its three refetch triggers) touches three existing load paths (`projectsSlice`, `resourcesSlice`, `EntitySection.tsx`) and is the most likely task to have a hidden fourth trigger point missed on first pass. Task 5 (native transport) carries the usual ADR-021 risk of a `node:*` import leaking into the web bundle if the `next.config.mjs` alias entry is misconfigured.

## Open Questions

None. All open questions in the source feature spec (OQ-1 through OQ-4) are resolved; this task list implements their resolutions rather than reopening them.
