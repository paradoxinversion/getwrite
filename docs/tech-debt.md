# Tech debt inventory

Date: 2026-05-23

## Purpose

This document collects technical debt, architectural drift, and maintenance risks discovered while preparing GetWrite for a v1 release. It is a living checklist: add findings, assign owners, and link remediation PRs.

## How to use

- Add concise entries under the relevant category. Each entry should include: description, example files, severity (low/medium/high), and suggested remediation.
- Prefer small, testable remediation tasks that can be scheduled into execution tracks.
- Link PRs or issue IDs when remediation work is started or completed.

Table of contents

- Architecture
- Tests
- Duplication
- Styling
- Performance
- Dependencies
- Docs & Standards
- Immediate Risks

### Architecture

- Editor toolbar duplication — ~~Severity: High~~ **Resolved in `feat/editor-command-descriptor`**
  - ~~Description: Toolbar rendering contains duplicated action wiring and submenu scaffolding across multiple files, increasing drift risk and maintenance cost.~~
  - ~~Example files: `frontend/components/Editor/MenuBar/MenuBar.tsx`, `frontend/components/Editor/MenuBar/EditorMenuInput.tsx`, `frontend/components/Editor/MenuBar/EditorMenuColorSubmenu.tsx`~~
  - ~~Suggested remediation: Extract a typed `CommandDescriptor` and render toolbar from a declarative config; add parity tests to verify behavior.~~
  - Resolution: Introduced `toolbar-command-schema.ts` with a single typed `toolbarCommandSchema: ToolbarCommandGroup[]`. `useToolbarCommands` hook binds editor/state context and returns fully resolved `ResolvedToolbarGroup[]`; `MenuBar.tsx` now renders purely from those descriptors with no direct TipTap command calls. `EditorMenuInput` and `EditorMenuColorSubmenu` are pure presentational components. Parity tests in `editorMenuBar.test.tsx` enforce group-count, id/kind, and callback-binding invariants.

- Revision / canonical guards — ~~Severity: High~~ **Resolved across `fix/p0-blockers` + `fix/tech-debt`**
  - ~~Description: Canonical revision invariants are critical but lack comprehensive unit tests and guard functions in model/slice layers.~~
  - ~~Example files: `frontend/src/lib/revision.ts`, `frontend/src/store/revisionsSlice.ts` (review these paths for exact locations)~~
  - ~~Suggested remediation: Implement canonical guard helpers, add unit tests for promotion/deletion/prune behavior, and harden model factories with zod validation.~~
  - Resolution: Canonical guard added to POST handler (`setCanonicalRevision` after `writeRevision`) and DELETE handler (HTTP 400 on canonical target). Slice-level guards cover stale-requestedResourceId, `setSelectedResourceId` reset, delete-current-revision auto-advance, stale save/fetch/delete cross-resource, and `clearRevisions` reset. See `revision-route-canonical.test.ts`, `revision-invariants.test.ts`, and `revision-canonical-guards.test.ts`.

- Model layer not yet a standalone package — Severity: Medium
  - Description: The framework-free model/logic layer still lives in `frontend/src/lib/`. The standalone `cli/` package consumes it through the `@gw/core` barrel (`frontend/src/lib/core.ts`) via a path alias rather than a real package boundary, so the boundary is enforced by discipline, not the compiler.
  - Example files: `frontend/src/lib/core.ts`, `frontend/src/lib/models/`, `cli/tsconfig.json`
  - Suggested remediation: Promote `@gw/core` to a standalone `core/` package when the plugin system lands, rewriting frontend imports and adding an `exports` map + lint rules to forbid deep imports. Full rationale and migration steps in [ADR-016](architecture/ADRs/adr-016-cli-extraction-and-deferred-core-package.md).

### Tests

- Missing Storybook & unit coverage for WorkArea views — ~~Severity: Medium~~ **Stale — coverage exists**
  - ~~Description: Core flows (Start → Open → Edit, Organizer, Data) lack Storybook stories and vitest coverage, slowing QA.~~
  - Resolution: All WorkArea components now have Storybook stories (`frontend/stories/WorkArea/`), Vitest unit tests (`frontend/tests/{editView,dataView,organizerView,…}.test.tsx`), integration tests (`editViewAutosave.test.tsx`), and a11y tests (`tests/a11y/workarea.a11y.test.tsx`). E2e coverage for `OrganizerView` exists in `frontend/e2e/`; remaining view-level e2e specs are planned separately.

### Duplication

- Menu/help wiring duplication — ~~Severity: Medium~~ **Resolved in `fix/tech-debt`**
  - ~~Description: Similar help/toolbar wiring duplicated across multiple components; extraction recommended to prevent divergence.~~
  - ~~Example files: `frontend/components/help/`, `frontend/components/Editor/MenuBar/`~~
  - ~~Suggested remediation: Consolidate help/menu wiring and add a small adapter layer.~~
  - Resolution: Introduced `SettingsMenuAction` union type in `ShellSettingsMenu.tsx`. Replaced 11 individual `onOpen*` callback props with a single `onAction: (action: SettingsMenuAction) => void`. Collapsed 9 repetitive `handleOpen*` functions in `AppShell.tsx` into one `handleSettingsMenuAction` switch dispatcher. Storybook stories updated to the new API.

### Styling

- Token drift / hard-coded styles — ~~Severity: Medium~~ **Resolved in `feat/simplify-design-system` + `feat/simplify-design-system-second-pass`**
  - ~~Description: Some components use ad-hoc CSS values instead of design tokens, risking theme and dark-mode inconsistency.~~
  - ~~Example files: various components under `frontend/components/` (audit needed)~~
  - ~~Suggested remediation: Run a token-first audit, replace raw values with `var(--...)` tokens, and add PR guidance enforcing token usage.~~
  - Resolution: Full token audit completed across both design-system passes. All hardcoded hex values replaced with `var(--color-gw-*)` tokens (Toaster, TimelineTooltip, and all migrated components). CI enforcement gate added: `scripts/check-no-hardcoded-hex.mjs` + `frontend-checks.yml` workflow blocks new violations at the PR level.

### Performance

- Indexer durability and incremental writes — ~~Severity: High~~ **Resolved in `fix/tech-debt`**
  - ~~Description: Index/backlink persistence and reindex durability need verification; partial or naive writes can lose index state.~~
  - Resolution: Added `atomicWriteFile` to `frontend/src/lib/models/io.ts` (write-to-tmp + rename, atomic on POSIX). `saveIndex` in `inverted-index.ts` and `persistBacklinks` in `backlinks.ts` now use it. Tests added in `io.test.ts` (atomic write semantics), `inverted-index.test.ts` (incremental preservation, corrupt JSON recovery, no .tmp left behind), and `backlinks.test.ts` (corrupt JSON recovery). `waitForDrain`, `reindex` CLI, and `reindexMissingResources` were resolved earlier in `fix/p0-blockers`.

### Dependencies

- Lodash import drift — ~~Severity: Medium~~ **Resolved in `fix/tech-debt`**
  - ~~Description: Full-package lodash imports and non-path imports are present in places, increasing bundle weight and violating the allowlist policy.~~
  - ~~Example files: `frontend/components/ResourceTree/ResourceTree.tsx`, `frontend/components/WorkArea/Views/OrganizerView/OrganizerView.tsx`~~
  - ~~Suggested remediation: Replace full-package imports with path imports (e.g., `lodash/uniq`), prefer native array methods, and add an ESLint rule or PR checklist.~~
  - Resolution: Audit confirmed all lodash usages were already path imports (`lodash/debounce`). Added `no-restricted-imports` ESLint rule in `frontend/eslint.config.mjs` to enforce path-only imports — any future `import { x } from 'lodash'` or `import _ from 'lodash'` will error at lint time.

### Docs & Standards

- Missing enforcement of style contracts — Severity: Low
  - Description: Token-first styling and the lodash policy are documented but not enforced in PR checks or contributing docs. (The knowledge-tome workflow was also listed here; the skill was retired on 2026-08-25 — durable project knowledge now lives in `sab` notes — so there is nothing left to enforce.)
  - Suggested remediation: Add short checklist items to `CONTRIBUTING.md` or PR templates and reference these policies from `docs/roadmap.md` and `specs`.

### Immediate Risks

- Invariant-sensitive hotspots — ~~Severity: High~~ **Resolved in `fix/tech-debt`**
  - ~~Description: Refactors touching `revisionsSlice`, `projectsSlice`, `resource-templates`, or `ResourceTree` risk breaking canonical invariants if done without tests/verification gates.~~
  - Resolution: All remaining open gates closed. Added to `revision-canonical-guards.test.ts`: stale-requestedResourceId load guard (race condition), `setSelectedResourceId` reset behaviour, delete-current-revision auto-advance to canonical, stale save/fetch/delete cross-resource guards, and `clearRevisions` reset. Added `resources-slice-guards.test.ts` covering the cross-slice `renameMetadataFieldKey.fulfilled` coupling in `resourcesSlice` and `removeResource` folder/resource fan-out. Added `projectsSlice` `updateProjectMetadataSchema` no-op guard to `projects-slice-controller.test.ts`. Added `resource-templates` integrity gates: `dryRun` writes no resource files, `loadResourceTemplate` throws on missing template, `scaffoldResourcesFromTemplate` count invariant.

### High-Priority Action Items (Stage 3)

- `fix/revision-canonical-guards` — ~~Owner: TBD — Priority: P0~~ **Resolved in `fix/p0-blockers`**
  - ~~Description: Add unit and integration tests that exercise canonical selection, promotion, deletion, and prune flows.~~
  - Resolution: Added canonical guard to the POST handler (calls `setCanonicalRevision` after `writeRevision` when `isCanonical: true`) and to the DELETE handler (returns HTTP 400 when the target revision is canonical). Tests added in `frontend/tests/unit/revision-route-canonical.test.ts` and `frontend/tests/unit/revision-invariants.test.ts`.

- `feat/indexer-wait-drain` — ~~Owner: TBD — Priority: P0~~ **Resolved in `fix/p0-blockers`**
  - ~~Description: Replace any polling-based flush semantics with a deterministic, promise-based `waitForDrain()` on the indexer queue.~~
  - Resolution: Exported `waitForDrain` alias from `frontend/src/lib/models/indexer-queue.ts` (same semantics as existing `flushIndexer`). Added error logging in the queue `catch` block. Added `getwrite reindex [projectRoot]` CLI command (`frontend/src/cli/commands/reindex.ts`) to rebuild the inverted index and backlinks from scratch. Tests added in `frontend/tests/unit/indexer-queue.test.ts` and `frontend/tests/cli/reindex.test.ts`.

- `feat/editor-command-descriptor` — ~~Owner: TBD — Priority: P1~~ **Resolved**
  - ~~Description: Consolidate toolbar/menu wiring into a typed `CommandDescriptor` and central generator to eliminate duplicated wiring and submenu scaffolding.~~
  - Resolution: Feature complete on `feat/editor-command-descriptor`. Declarative schema, resolver hook, pure presentational subcomponents, and parity tests all shipped. See `docs/features/feature-specifications/editor-command-descriptor/`.

- `chore/lodash-import-cleanup` — ~~Owner: TBD — Priority: P1~~ **Resolved in `fix/tech-debt`**
  - ~~Description: Audit and replace non-path lodash imports with path imports (e.g. `lodash/debounce`) or native methods to reduce bundle pressure and match the repo policy.~~
  - Resolution: Audit found no full-package violations. ESLint `no-restricted-imports` rule added to `frontend/eslint.config.mjs` to block any future `import { x } from 'lodash'`.

---

Seeded from discovery run on 2026-04-08. Add new entries as issues and link them here.
