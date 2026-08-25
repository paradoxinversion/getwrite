# Simplify Design System — Implementation Tasks

Spec: [`simplify-design-system-spec.md`](./simplify-design-system-spec.md)
Audit: [`audit.md`](./audit.md) — task list below reflects the audit's phase-one migration set.
Estimate scale: story points (1 / 2 / 3 / 5 / 8)

---

### Task 1: UI primitive audit

**What:** Produce a ranked markdown inventory of duplicated/recurring visual primitives across `frontend/components/`, with file paths and occurrence counts.
**Files:** `docs/features/feature-specifications/ui/simplify-design-system/audit.md`
**Done when:** Artifact exists and lists, per category (button, chip, dialog/modal, input, menu item, panel, badge, etc.): occurrence count, file paths, estimated LOC savings, and a recommendation (migrate / leave / defer). Categories are sorted by impact (count × LOC).
**Depends on:** none
**Estimate:** 3
**Notes:** Combined `rg` for raw counts with manual reads of representative files and shared `common/` primitives. The audit surfaced four phase-one categories (Button, Dialog, Card, Input) plus three smaller cleanups (section merge, Chip adoption, Toaster hex sweep) and recommended deferring the original `MenuItem` task — `MenuItemButton` is already consolidated.
**Done:** [x]

---

### Task 2: Resolve open questions (decision doc)

**What:** Write a decision record answering the three open questions in the spec, using the recommendations the audit surfaced.
**Files:** `docs/features/feature-specifications/ui/simplify-design-system/decisions.md`
**Done when:** Doc records a single chosen answer per question with one-sentence justification. The phase-one migration list from the audit is reproduced as the canonical scope for Tasks 4–10.
**Depends on:** 1
**Estimate:** 1
**Notes:** Ratified in [`decisions.md`](./decisions.md):

- **shadcn distribution path:** CLI, with `components.json` aliased to `components/common/UI/`. Install `class-variance-authority`, `clsx`, `tailwind-merge` as direct deps.
- **Primitives directory:** `frontend/components/common/UI/<Primitive>/` — extends the existing `Chip` precedent.
- **Migration threshold:** ≥ 10 occurrences across ≥ 3 files (with a tiebreaker: adopt an existing shared primitive even below threshold).
- **CSS-class buttons:** absorb into Tailwind-styled `Button` / `Card` variants and delete the global CSS rules — no `className`-passthrough escape hatch.
  **Done:** [x]

---

### Task 3: shadcn + Tailwind foundation

**What:** Install and configure shadcn-compatible primitive infrastructure: dependencies, generator config, the primitives directory from Task 2, and brand-token wiring so shadcn variants consume existing `gw-*` tokens instead of shadcn defaults.
**Files:** `frontend/package.json`, `frontend/components.json` (or equivalent shadcn config), `frontend/tailwind.config.*`, `frontend/styles/getwrite-theme.css` (token bridge), new primitives directory.
**Done when:** `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass with the shadcn scaffolding in place but no components migrated yet. A trivial smoke primitive (or generator dry-run) renders using brand tokens, not shadcn defaults.
**Depends on:** 2
**Estimate:** 3
**Notes:** Tailwind v4 + cva + brand-token wiring all confirmed working. Files added:

- `frontend/components.json` (CLI config; alias points at `components/common/UI`).
- `frontend/components/common/UI/utils.ts` (the `cn()` helper).
- `frontend/components/common/UI/__smoke__/SmokeButton.tsx` (foundation smoke primitive — deleted at start of Task 4).
- `frontend/tests/unit/ui-foundation.test.tsx` (9 tests covering cn() + smoke primitive).
- Direct deps: `class-variance-authority`, `clsx`, `tailwind-merge`.
- Bonus fixes (unblocked done-when): `src/lib/models/search-snippet.ts` (`let end` → `const end`); `app/api/project/[project-id]/search/route.ts` (narrowed `userMetadata` to `Record<string, MetadataValue>` before indexing into `.status`).
  **Done:** [x]

---

### Task 4: Canonical `Button` primitive + migration

**What:** Build the canonical `Button` primitive on a shadcn base with brand-token variants (default, outline, ghost, icon), Storybook story, and a11y test. Replace the 117 raw-button call sites identified in the audit.
**Files:** `frontend/components/common/UI/Button/Button.tsx`, `Button.stories.tsx`, `Button.a11y.test.tsx`, plus every call site listed in [audit § 1](./audit.md#1-button-raw-button).
**Done when:**

- Audit-flagged button call sites (modal footers across `components/preferences/`, `components/Start/`, `components/ResourceTree/`, `components/common/`; action toolbars in `SchemaManager.tsx` and `ProjectTypeEditorForm.tsx`; top-bar buttons in `AppShell.tsx`) import the canonical `Button`.
- CSS-class buttons (`appshell-topbar-button`, `project-modal-button-*`, `project-type-editor-action-button`) are replaced by `Button` variants and their CSS rules deleted from the global stylesheets.
- Deleted call sites' prior local button code is removed (FR 5 — no parallel coexistence).
- Storybook story covers all variants; a11y test passes; `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm test:e2e` all pass.
  **Depends on:** 3
  **Estimate:** 5
  **Notes:** Largest call-site fan-out of the categories (~300 LOC saved). Red token must not appear in any action variant (FR 6). **Defer** Timeline-specific buttons (`timeline-zoom-btn`, `timeline-chip`) — they're visually unique and out of phase one per the audit.
  **Done:** [x]

---

### Task 5: Canonical `Dialog` primitive + migration

**What:** Build the canonical `Dialog` primitive on shadcn's Radix-Dialog base with brand-token styling, then migrate the 12 modals and 3 inline overlays identified in the audit.
**Files:** `frontend/components/common/UI/Dialog/Dialog.tsx`, `Dialog.stories.tsx`, `Dialog.a11y.test.tsx`, plus the modal files listed in [audit § 2](./audit.md#2-dialog--modal--overlay).
**Done when:**

- All 12 modal components route through the canonical `Dialog`.
- The 3 inline `fixed inset-0` overlays (`RenameProjectModal`, `RenameResourceModal`, `ResourceCommandPalette`) are migrated.
- `ModalOverlayShell.tsx` and `ProjectModalFrame.tsx` are deleted; `ConfirmDialog.tsx` is reduced to a thin wrapper around `Dialog` (drops its hand-rolled focus trap).
- Storybook covers default / destructive / scrollable-content variants; a11y test passes.
- Existing modal tests (`tests/exportPreviewModal.test.tsx`, `tests/compilePreviewModal.test.tsx`, `tests/createProjectModal.error.test.tsx`, etc.) pass unchanged; `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm test:e2e` all pass.
  **Depends on:** 3
  **Estimate:** 8
  **Notes:** Highest-risk migration. Existing modals do **not** use portals; Radix Dialog does — verify z-index and Storybook portal mounting before the first migration. Don't loosen the existing tests when porting; if a test breaks, the migration is wrong.
  **Done:** [x]

---

### Task 6: Canonical `Card` primitive + migration

**What:** Build the canonical `Card` primitive on shadcn's Card base with brand-token variants (`chrome` / `chrome2` background, padding presets), Storybook story, and a11y test. Replace the 55 bordered+rounded surface call sites identified in the audit.
**Files:** `frontend/components/common/UI/Card/Card.tsx`, `Card.stories.tsx`, `Card.a11y.test.tsx`, plus call sites listed in [audit § 3](./audit.md#3-card--surface-bordered-rounded).
**Done when:**

- `OrganizerCard.tsx` (currently inlines container styles) renders via the canonical `Card`.
- `HelpSectionCard.tsx` migrates from `help-section-card help-card` CSS classes to `Card`; the CSS rules are deleted.
- Inline card-shaped divs in `StartPage.tsx`, `MetadataSidebar.tsx`, preferences modals, and `SchemaManager.tsx` use `Card`.
- Storybook covers padding and chrome-level variants; a11y test passes.
- `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm test:e2e` all pass.
  **Depends on:** 3
  **Estimate:** 5
  **Notes:** New task added based on audit finding — Card was the third-highest-impact category (~150 LOC saved) and wasn't in the original plan. **Defer** any card that carries non-trivial layout logic beyond `border + rounded + padding + background` (e.g. timeline rows).
  **Done:** [x]

---

### Task 7: Canonical `Input` / `Textarea` / `Select` / `Checkbox` primitives + migration

**What:** Build canonical form-control primitives on shadcn bases with brand-token styling, Storybook stories, and a11y tests. Replace audit-flagged form-control call sites.
**Files:** `frontend/components/common/UI/{Input,Textarea,Select,Checkbox}/*.tsx` (each with stories + a11y test), plus call sites listed in [audit § 4](./audit.md#4-input--textarea--select).
**Done when:**

- The four sidebar controls that share the `w-full mt-2 p-2 border border-gw-border rounded text-sm` class string (`MetadataSidebar`, `SelectInput`, `NumberInput`, `ResourceRefInput`) use canonical primitives.
- Modal text inputs in `BodySettingsModal`, `DefaultRevisionNameModal`, `HeadingSettingsModal`, `CreateProjectModal`, `RenameProjectModal`, `CreateResourceModal`, `RenameResourceModal` use canonical primitives.
- Checkboxes in compile/export tree pickers (`CompilePreviewModal`, `CompileResourceTree`) and `MultiSelectList` use the canonical `Checkbox`; the `compile-tree-checkbox` CSS rule is deleted.
- The one drift case using legacy `border-brand-mid` is replaced with `gw-*` tokens.
- Storybook covers default / disabled / error states; a11y tests pass; full test suite passes.
  **Depends on:** 3
  **Estimate:** 5
  **Notes:** Estimate bumped from 3 → 5 vs. the original plan because the audit confirmed four primitive families, not one. **Defer** specialized inputs: `SearchBar` autocomplete, `ResourceCommandPalette` search input, `POVAutocomplete`, `MultiResourceRefInput` — they layer custom behavior on top and are not simple text-field swaps. Also migrated `SynopsisInput` and `NotesInput` to `Textarea` (same class-string duplication pattern). `compile-modal-select`, `.project-modal-input`, `.project-modal-select`, `.compile-tree-checkbox` CSS rules deleted. `border-brand-mid` drift in `POVAutocomplete` replaced with `border-gw-border`.
  **Done:** [x]

---

### Task 8: Merge `CollapsibleSection` ↔ `SidebarSection`

**What:** Consolidate `Sidebar/SidebarSection.tsx` and `WorkArea/CollapsibleSection.tsx` (near-duplicate, 121 LOC combined) into a single component with a `variant: "sidebar" | "workarea"` prop and the optional `actions` slot.
**Files:** new `frontend/components/common/UI/CollapsibleSection/CollapsibleSection.tsx`, update all four consumers listed in [audit § 5](./audit.md#5-collapsiblesection--sidebarsection).
**Done when:** One component exists in `components/common/UI/`. The two prior files are deleted. All four consumers (`MetadataSidebar.tsx`, `DataView.tsx`, and previously-internal references) import the merged version. Storybook covers both variants; a11y test passes; full test suite passes.
**Depends on:** 2 (not 3 — no shadcn needed)
**Estimate:** 2
**Notes:** No shadcn primitive needed; this is pure consolidation. Slugified `aria-controls` IDs must keep working — both sources already do this identically. Unified prop name is `title` (MetadataSidebar updated from `label`). `onToggle` callback included from SidebarSection. Storybook story moved to `stories/Foundations/CollapsibleSection.stories.tsx` covering both variants.
**Done:** [x]

---

### Task 9: Adopt existing `Chip` primitive at remaining call sites

**What:** Extend the existing `components/common/UI/Chip/Chip.tsx` with an `active` / `pressed` state, then migrate `TagsSection`, `SearchBar`, and `SearchFilterPanel` to use it. Delete the parallel `metadata-sidebar-tag` and `searchbar-chip` CSS class systems.
**Files:** `frontend/components/common/UI/Chip/Chip.tsx` (extend API), `frontend/components/Sidebar/TagsSection.tsx`, `frontend/components/SearchBar/SearchBar.tsx`, `frontend/components/SearchBar/SearchFilterPanel.tsx`, plus the CSS modules that define `metadata-sidebar-tag*` and `searchbar-chip*`.
**Done when:** The three call sites use `<Chip>`; the parallel CSS classes are deleted from the global stylesheets; the existing Chip Storybook story covers the new `active` state; a11y test passes; full test suite passes.
**Depends on:** 2 (not 3 — no shadcn needed; existing `Chip` is already a hand-rolled primitive)
**Estimate:** 2
**Notes:** **Leave** `TimelineChip` and the revision-badge inline (per audit) — they're visually distinct enough to stay separate.
**Done:** [x]

---

### Task 10: Brand-token compliance sweep + `Toaster.tsx` cleanup

**What:** Replace hardcoded hex values introduced by new primitives or surfaced during migration with brand tokens. Specifically replace the 13 raw Tailwind palette hex values in `Toaster.tsx` with brand tokens (introducing `--color-gw-toast-{success,error,info}-{bg,fg,accent}` if needed). Verify red token is not used for any action/alert variant.
**Files:** All files touched in Tasks 4–9, `frontend/components/notifications/Toaster.tsx`, `frontend/styles/getwrite-theme.css` (new toast tokens if added).
**Done when:**

- No hardcoded hex appears in primitive files or migrated call sites (legitimate CSS-var fallbacks `var(--color-gw-X, #FALLBACK)` and color-picker `#000000` placeholders are exempt — see [audit § "Hardcoded-color baseline"](./audit.md#hardcoded-color-baseline-fr-6--fr-8)).
- `Toaster.tsx` uses brand tokens; the 13 raw Tailwind palette values are gone.
- The three `#D44040` direct uses in `TimelineTooltip.tsx` are replaced with `var(--color-gw-red)` / `text-gw-red`.
- Manual review confirms red appears only on canonical/position-state indicators (FR 6).
  **Depends on:** 4, 5, 6, 7, 8, 9
  **Estimate:** 2
  **Notes:** Optional follow-up: codify the check as `scripts/check-no-hardcoded-hex.mjs` (similar to existing `check-test-policy.mjs`) — but defer that to a separate task if it adds scope.
  **Done:** [x]

---

### Task 11: Final verification pass

**What:** Run the full test suite, typecheck, lint, Storybook build, and E2E suite. Confirm Storybook coverage and a11y pass rates meet or exceed pre-migration baseline. Document before/after primitive counts.
**Files:** none (verification only); update PR description with results.
**Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm build`, `pnpm build-storybook`, and `pnpm test:e2e` all pass on the branch. Primitive-count reduction in targeted categories (Button, Dialog, Card, Input family) is ≥ 30% (spec goal 2) and documented in the PR body. LOC delta vs. `main` is captured.
**Depends on:** 10
**Estimate:** 2
**Notes:** Audit's projected savings: ~1140 LOC across the seven phase-one tasks. PR description should cite the audit's before-counts vs. the post-migration counts as evidence for spec goal 2.
**Done:** [x]

#### Verification results (2026-05-19)

All gates green on `feat/simplify-design-system`:

| Check                  | Result                                                   |
| ---------------------- | -------------------------------------------------------- |
| `pnpm typecheck`       | ✅ clean                                                 |
| `pnpm lint`            | ✅ 0 errors (386 pre-existing warnings, all in `tests/`) |
| `pnpm test:ci`         | ✅ 1051 passed / 1 skipped (134 files)                   |
| `pnpm build`           | ✅ Next.js production build OK                           |
| `pnpm build-storybook` | ✅ Storybook static built                                |
| `pnpm test:e2e`        | ✅ 107 passed (Chromium)                                 |

**Primitive-count reduction (excluding new `common/UI/` primitives):**

| Category                       |                    main |               HEAD |               Δ | % reduction |
| ------------------------------ | ----------------------: | -----------------: | --------------: | ----------: |
| Raw `<button>` (call sites)    |     117 across 46 files | 56 across 32 files | −61 / −14 files |     **52%** |
| Raw `<input>`                  |                      50 |                 33 |             −17 |     **34%** |
| Raw `<textarea>`               |                       4 |                  2 |              −2 |     **50%** |
| Raw `<select>`                 |                      15 |                  9 |              −6 |     **40%** |
| Input family combined          |                      69 |                 44 |             −25 |     **36%** |
| Dialog/Modal overlay impls     | 4 shells + 3 inline = 7 | 1 canonical Dialog |              −6 |     **86%** |
| Bordered+rounded card surfaces |                      51 |                 21 |             −30 |     **59%** |

Every targeted category clears the ≥ 30% spec-goal-2 bar. Two parallel modal-shell files (`ModalOverlayShell.tsx`, `ProjectModalFrame.tsx`) and four CSS class systems (`appshell-modal-*`, `project-modal-*`, `confirm-dialog-*`, `compile-tree-checkbox` etc.) were deleted entirely; remaining `<button>` / `<input>` usage in `Timeline/`, `SearchBar/`, `Editor/MenuBar/` is deferred per audit § 1 / § 4 (visually unique or behaviorally non-trivial).

**LOC delta vs. `main`** (all files, branch-wide): `101 files changed, +3972 / −1653` — net +2319 (includes new Storybook stories, a11y tests, primitive sources, decisions/audit/follow-up docs).

Limiting to `frontend/components/` + `frontend/styles/`: `57 files changed, +974 / −1302` — net **−328 LOC** of component/style code.

Excluding new `common/UI/` primitives and `__smoke__`: `41 files changed, +535 / −1351` — net **−816 LOC** removed from migrated call sites (vs. audit projection of ~1140 LOC — within range, since several inputs were converted to thin wrappers rather than fully inlined removals).

---

## Deferred (audit-driven, was Task 7 in the original plan)

### MenuItem primitive — **deferred to phase two**

**Rationale:** `components/common/MenuItemButton.tsx` is already consolidated and used in 20 places by 3 menu containers (`ResourceContextMenu`, `ShellSettingsMenu`, `ManageProjectMenu`). The real duplication is in the menu _containers_ — each repeats outside-click + arrow-key + escape logic — which is a behavioral concern (a `useDismissable` / `useMenu` hook), not a visual primitive. A shadcn dropdown migration would conflate the two. Track this as a separate phase-two task focused on the _hook_, not the primitive.

### Other phase-two candidates

- **Specialized inputs** (`SearchBar` autocomplete, `ResourceCommandPalette`, `POVAutocomplete`, `MultiResourceRefInput`) — out of phase one per audit § 4.
- **Timeline visuals** (`TimelineChip`, `timeline-zoom-btn`, timeline cards) — out of phase one per audit § 1 / § 6.
- **`ViewSwitcher` → shadcn `Tabs`** — single call site, full keyboard behavior already implemented; revisit if a second tablist appears.
- **TipTap editor menu bar** — explicit non-goal in the spec.

---

## Summary

- Total tasks: 11 (was 9 — added Card, section-merge, Chip adoption; deferred MenuItem)
- Total estimated effort: 38 story points (was 30)
- Critical path: **Tasks 1 → 2 → 3 → 5 → 10 → 11** (21 points). Tasks 4, 6, 7 fan out in parallel with Task 5 after Task 3 lands. Tasks 8 and 9 only depend on Task 2 (no shadcn needed) and can run independently in parallel from the start of Task 3.
- Phase-one categories covered (audit ranking): #1 Button (T4), #2 Dialog (T5), #3 Card (T6), #4 Inputs (T7), #5 Section merge (T8), #6 Chip adoption (T9), #7 Toaster (T10).
- Risks:
  - **Task 3** — Tailwind v4 + shadcn compatibility is the foundational unknown. If shadcn defaults assume Tailwind v3, scaffolding takes longer than estimated.
  - **Task 5** — Modal migration owns focus/portal/escape behavior across 12 modals + 3 inline overlays. Radix Dialog uses portals; existing modals don't — z-index and Storybook mounting need explicit verification.
  - **Task 4** — Deleting global CSS rules for `appshell-*` and `project-modal-button-*` is a wide blast radius if any non-component code references them. Grep CSS modules and global stylesheets before deletion.
