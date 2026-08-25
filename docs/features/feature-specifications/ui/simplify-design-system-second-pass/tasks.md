# Simplify Design System — Second Pass — Implementation Tasks

Spec: [`simplify-design-system-second-pass-spec.md`](./simplify-design-system-second-pass-spec.md)
Prior pass: [`../simplify-design-system/tasks.md`](../simplify-design-system/tasks.md) — phase-one task ledger, deferral notes.
Estimate scale: story points (1 / 2 / 3 / 5 / 8)

---

### Task 1: `useDismissableMenu` hook

**What:** Implement a single hook encapsulating outside-click, escape-to-close, and roving arrow-key focus behavior for popover-style menus, with unit tests.
**Files:** `frontend/components/common/UI/hooks/useDismissableMenu.ts`, `frontend/components/common/UI/hooks/useDismissableMenu.test.tsx` (or sibling test under `tests/`).
**Done when:** Hook exports a typed API (open/close, ref(s), key handlers) covering outside-click, `Escape`, and arrow-up/down focus rotation across a configurable item list. Unit tests cover: outside-click closes, escape closes, arrow keys rotate focus and wrap, items receive `tabindex`/`aria-activedescendant` (whichever pattern is chosen) correctly. `pnpm typecheck`, `pnpm lint`, `pnpm test:ci` pass.
**Depends on:** none
**Estimate:** 3
**Notes:** Mirror the union of behaviors currently duplicated in `ResourceContextMenu`, `ShellSettingsMenu`, `ManageProjectMenu`. Read all three before designing the API so the contract fits the call sites without per-menu special cases. Decide upfront whether the hook owns the trigger ref or only the menu ref — document the choice in the file header.
**Done:** [x]

---

### Task 2: Adopt `useDismissableMenu` in the three menu containers

**What:** Refactor `ResourceContextMenu`, `ShellSettingsMenu`, and `ManageProjectMenu` to consume `useDismissableMenu` and delete each one's prior outside-click / arrow-key / escape implementation.
**Files:** `frontend/components/ResourceTree/ResourceContextMenu.tsx`, `frontend/components/Layout/ShellSettingsMenu.tsx`, `frontend/components/Start/ManageProjectMenu.tsx`, plus any associated hook files or local helpers those files import for menu dismissal.
**Done when:** All three menus import and use `useDismissableMenu`; no in-file outside-click / `document.addEventListener("keydown", …escape…)` / arrow-key bookkeeping remains in any of the three; existing tests for these menus pass unchanged; `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm test:e2e` all pass.
**Depends on:** 1
**Estimate:** 3
**Notes:** FR 1 forbids parallel coexistence — grep each migrated file post-change to confirm the deleted patterns are gone. Behavior must remain identical (test against keyboard a11y harness from phase one).
**Done:** [x]

---

### Task 3: Canonical `Tabs` primitive

**What:** Build a canonical `Tabs` primitive on shadcn's Radix-Tabs base with brand-token styling, a Storybook story, and an a11y test.
**Files:** `frontend/components/common/UI/Tabs/Tabs.tsx`, `Tabs.stories.tsx`, `Tabs.a11y.test.tsx`.
**Done when:** Component exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (or the equivalent shadcn API) styled with `gw-*` tokens (no hardcoded hex, no raw shadcn defaults). Storybook story covers default + disabled-tab states; a11y test passes; `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm build-storybook` pass.
**Depends on:** none
**Estimate:** 2
**Notes:** Follow the brand-token wiring pattern set in phase-one primitives (`Button`, `Dialog`, etc.). Red token must not appear (FR 6).
**Done:** [x]

---

### Task 4: Migrate `ViewSwitcher` onto `Tabs`

**What:** Replace `WorkArea/ViewSwitcher.tsx` with adoption of the canonical `Tabs` primitive at its call site, deleting the bespoke component if it becomes a thin wrapper or zero-value indirection.
**Files:** `frontend/components/WorkArea/ViewSwitcher.tsx` (delete or thin wrap), the WorkArea component(s) that render the view switcher, any CSS classes specific to the prior implementation.
**Done when:** The WorkArea view switcher renders via canonical `Tabs`; no parallel `ViewSwitcher` styles or keyboard handlers remain; existing E2E/component tests for view switching pass unchanged; full gate suite passes.
**Depends on:** 3
**Estimate:** 2
**Notes:** Single call site (per spec § "Out of scope (deferred)" of phase one). Preserve current keyboard semantics — Radix Tabs already provides them, but verify no app-specific shortcut layered on top is lost.
**Done:** [x]

---

### Task 5: Canonical `Listbox` primitive

**What:** Build a shared `Listbox` primitive on Radix Popover for autocomplete result lists, with brand-token styling, a Storybook story, and an a11y test. Filtering/fetching stays in the call site — the primitive only renders an anchored, focus-managed result list.
**Files:** `frontend/components/common/UI/Listbox/Listbox.tsx`, `Listbox.stories.tsx`, `Listbox.a11y.test.tsx`.
**Done when:** Primitive exposes anchor + content with `role="listbox"` / `role="option"`, keyboard navigation (arrow keys, enter to select, escape to close), and brand-token styling. Storybook story demonstrates a simple anchored list driven by stub data; a11y test passes; `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm build-storybook` pass.
**Depends on:** none
**Estimate:** 3
**Notes:** Spec § FR 3 explicitly excludes `cmdk` — keep filter logic out. Read the four call sites (`SearchBar`, `ResourceCommandPalette`, `POVAutocomplete`, `MultiResourceRefInput`) before locking the API so it fits all four without per-site escape hatches.
**Done:** [x]

---

### Task 6: Migrate `SearchBar` to canonical `Input` + `Listbox`

**What:** Convert the `SearchBar` text field to the canonical `Input` and its result-list overlay to the canonical `Listbox`, keeping current filter logic in place.
**Files:** `frontend/components/SearchBar/SearchBar.tsx`, related CSS modules (`searchbar-*` classes that become dead code).
**Done when:** `SearchBar` imports canonical `Input` and `Listbox`; no hand-rolled outside-click / keyboard handler / overlay positioning code remains for the result list; obsolete CSS classes deleted from global stylesheets; existing SearchBar tests pass unchanged; full gate suite passes.
**Depends on:** 5
**Estimate:** 3
**Notes:** Largest of the four migrations. Verify focus return after selection matches current UX. SearchBar uses `Chip` already (phase one) — confirm that adoption is unaffected.
**Done:** [x]

---

### Task 7: Migrate `ResourceCommandPalette` to canonical `Input` + `Listbox`

**What:** Convert the command palette's search input and result list to canonical `Input` and `Listbox`.
**Files:** `frontend/components/common/ResourceCommandPalette.tsx`, related CSS classes.
**Done when:** `ResourceCommandPalette` uses canonical `Input` and `Listbox`; the palette's hand-rolled overlay / focus management is removed; existing palette tests (incl. any E2E flow) pass unchanged; full gate suite passes.
**Depends on:** 5
**Estimate:** 3
**Notes:** Palette currently combines an `inset-0` overlay with custom keyboard plumbing — confirm the canonical `Dialog` (already used elsewhere) plus `Input` + `Listbox` together produce the same end-to-end behavior. Filtering must stay in the call site.
**Done:** [x]

---

### Task 8: Migrate `POVAutocomplete` to canonical `Input` + `Listbox`

**What:** Convert the POV autocomplete to canonical `Input` and `Listbox`.
**Files:** `frontend/components/Sidebar/controls/POVAutocomplete.tsx`.
**Done when:** `POVAutocomplete` consumes canonical primitives only; no in-file outside-click / arrow-key / overlay positioning remains; existing tests pass unchanged; full gate suite passes.
**Depends on:** 5
**Estimate:** 2
**Notes:** Per phase-one notes, this file's prior `border-brand-mid` drift was already fixed — confirm no new drift is introduced.
**Done:** [x]

---

### Task 9: Migrate `MultiResourceRefInput` to canonical `Input` + `Listbox`

**What:** Convert the multi-resource reference input to canonical `Input` and `Listbox`, retaining its multi-select chip rendering at the call site.
**Files:** `frontend/components/Sidebar/controls/MultiResourceRefInput.tsx`.
**Done when:** Input field and dropdown are canonical primitives; multi-select tag chips continue to use the canonical `Chip`; existing tests pass unchanged; full gate suite passes.
**Depends on:** 5
**Estimate:** 2
**Notes:** Multi-select selection model lives in the call site (per FR 3 — filtering/fetching/selection stay out of the primitive).
**Done:** [x]

---

### Task 10: Add `tag-active` Chip variant and adopt in `TagsSection`

**What:** Extend canonical `Chip` with a `tag-active` variant (red border + red text, no red fill) and migrate `TagsSection` to use it for assigned tags, restoring the assigned-tag visual distinction lost in phase one.
**Files:** `frontend/components/common/UI/Chip/Chip.tsx`, `Chip.stories.tsx`, `Chip.a11y.test.tsx`, `frontend/components/Sidebar/TagsSection.tsx`.
**Done when:** `Chip` exposes a `tag-active` variant (or boolean prop) that yields `border-gw-red-border` + `text-gw-red` with no red fill; `TagsSection` applies it to assigned tags only; Storybook story shows the variant; a11y test passes; manual review confirms red appears only in this canonical-state context here (FR 6). Full gate suite passes.
**Depends on:** none
**Estimate:** 2
**Notes:** Spec FR 6 is explicit about no red fill. Phase-one follow-up doc ([`../simplify-design-system/follow-up-work.md`](../simplify-design-system/follow-up-work.md) § Task 9) sketched this; treat it as canonical guidance.
**Done:** [x]

---

### Task 11: Migrate Timeline visuals onto canonical primitives

**What:** Replace Timeline visuals (`TimelineChip`, `timeline-zoom-btn`, timeline cards) with canonical `Chip` / `Button` / `Card` variants wherever the visual contract matches; document anything kept Timeline-specific in a follow-up note.
**Files:** `frontend/components/Timeline/TimelineChip.tsx`, `frontend/components/Timeline/Timeline.tsx`, `frontend/components/Timeline/TimelineRow.tsx`, `frontend/components/Timeline/TimelineAxis.tsx`, `frontend/components/Timeline/timeline.css`, `docs/features/feature-specifications/ui/simplify-design-system-second-pass/follow-up-work.md` (new — to capture Timeline-specific holdouts).
**Done when:** Every Timeline visual whose contract matches a canonical variant uses the canonical primitive; CSS rules for the migrated patterns are deleted from `timeline.css`; the follow-up note enumerates which Timeline visuals stayed bespoke and why; existing Timeline tests pass unchanged; full gate suite passes.
**Depends on:** 10
**Estimate:** 5
**Notes:** Phase one deferred Timeline as visually unique. The cut here is contract-based: if the variant matches, migrate; otherwise document. Watch the red token rule (FR 6) — Timeline's canonical-position indicator usage is the _one_ legitimate red surface and must remain.
**Done:** [x]

---

### Task 12: `scripts/check-no-hardcoded-hex.mjs` + CI wiring

**What:** Implement the no-hardcoded-hex check script with a structured exemption list and wire it into CI so new hex literals fail the build.
**Files:** `frontend/scripts/check-no-hardcoded-hex.mjs`, `frontend/package.json` (script entry), CI config (e.g. `.github/workflows/*.yml` — locate during task).
**Done when:** Script scans `frontend/components`, `frontend/styles`, `frontend/src` for `#[0-9a-fA-F]{3,8}` literals and fails on anything not in the exemption list (CSS-var fallbacks `var(--color-gw-X, #FALLBACK)`, color-picker `#000000` placeholders, Chip's `#fff` user-color contrast); each exemption carries a structured comment (machine-readable marker the script keys off) explaining the rationale; script runs cleanly on `HEAD`; CI workflow invokes it and fails on injected regressions (verify with a throwaway local test); `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm build` pass.
**Depends on:** 2, 4, 6, 7, 8, 9, 10, 11
**Estimate:** 3
**Notes:** Model after `frontend/scripts/check-test-policy.mjs`. Run script-locally before wiring to CI so the baseline is clean. The structured-comment marker is what protects future contributors from quietly extending the exemption list.
**Done:** [x]

---

### Task 13: Final verification pass

**What:** Run all gates against the branch and document before/after counts for menu containers, autocomplete surfaces, and red-token occurrences.
**Files:** none (verification only); update PR description.
**Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm test:ci`, `pnpm build`, `pnpm build-storybook`, `pnpm test:e2e` all pass; PR description documents (a) deletion of duplicated menu dismissal code (count or LOC), (b) the four autocomplete migrations, (c) the no-hardcoded-hex script's CI gate, (d) Timeline migration scope and what was deferred, (e) red-token audit (every remaining red occurrence is a canonical-state indicator).
**Depends on:** 12
**Estimate:** 2
**Notes:** Mirror the phase-one verification table pattern from [`../simplify-design-system/tasks.md`](../simplify-design-system/tasks.md) § Task 11 — concrete primitive-count deltas are evidence the second pass closed the loop.
**Done:** [x]

---

## Summary

- Total tasks: 13
- Total estimated effort: 35 story points
- Critical path: **Tasks 1 → 2 → 12 → 13** (11 points) is the longest dependency chain because the CI hex-check (Task 12) waits on every migration touching styles. Tasks 3 → 4 (Tabs), 5 → 6/7/8/9 (Listbox + autocompletes), 10 (Chip tag-active + TagsSection), and 11 (Timeline) all fan out independently in parallel once their prerequisite primitive lands. The 6-task fan-in at Task 12 is the real schedule pressure.
- Risks:
  - **Task 5 (Listbox)** — designing one primitive to fit four call sites without leaking filter logic is the hardest API call of the pass; if call-site needs diverge, expect rework in Tasks 6–9.
  - **Task 7 (`ResourceCommandPalette`)** — already a dialog-overlay hybrid; combining canonical `Dialog` + `Input` + `Listbox` must preserve focus and keyboard semantics. Highest behavioral-regression risk.
  - **Task 11 (Timeline migration)** — visual-contract judgement calls. Easy to over- or under-migrate; document the holdouts explicitly.
  - **Task 12 (CI hex-check)** — false positives stall the merge; false negatives let drift in. Test against intentional regressions before flipping CI to required.
