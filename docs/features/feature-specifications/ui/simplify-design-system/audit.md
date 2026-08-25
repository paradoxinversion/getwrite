# Simplify Design System — UI Primitive Audit

Generated: 2026-05-19
Scope: `frontend/components/` (81 `.tsx` files)
Method: ripgrep across `<element>` opens, classNames, and CSS-class anchors; spot-reads of the largest call sites and every shared `common/` candidate.

> **Reading this doc:** each category lists raw counts, files, the duplication patterns observed, and a recommendation (**migrate / merge / leave / defer**). Categories are ranked top-to-bottom by impact, computed as `occurrence count × estimated LOC savings per migration`.

---

## Ranking summary

| Rank | Category                                             |                Raw count | Files | Est. LOC saved | Impact score | Recommendation                            |
| ---- | ---------------------------------------------------- | -----------------------: | ----: | -------------: | -----------: | ----------------------------------------- |
| 1    | Button (raw `<button>`)                              |                      117 |    46 |           ~300 |  **highest** | migrate                                   |
| 2    | Dialog / Modal / Overlay                             | 12 components + 3 inline |    15 |           ~400 |  **highest** | migrate (highest risk)                    |
| 3    | Card / Surface (bordered, rounded)                   |                       55 |   ~25 |           ~150 |         high | migrate                                   |
| 4    | Input / Textarea / Select                            |         48 form controls |    27 |           ~150 |         high | migrate                                   |
| 5    | CollapsibleSection ↔ SidebarSection (near-duplicate) |             2 components |     4 |            ~60 |       medium | **merge** (no shadcn needed)              |
| 6    | Chip / Tag / Badge                                   |  5+ parallel CSS systems |     6 |            ~80 |       medium | migrate (consolidate to existing `Chip`)  |
| 7    | `Toaster.tsx` hardcoded hex                          |          13 hex literals |     1 |            ~15 |          low | **token sweep** (no primitive needed)     |
| —    | MenuItemButton                                       |    20 uses, 3 containers |     3 |              — |            — | **leave** (already consolidated)          |
| —    | ViewSwitcher (tablist)                               |                    1 use |     1 |              — |            — | **leave / defer** (isolated, well-tested) |

**Phase-one migration recommendation (per spec FR 1–7):** categories 1, 2, 3, 4. They alone yield ~1000 LOC of savings, all four hit the duplication threshold easily, and they cover every visual primitive that appears more than ~10 times. Categories 5–7 are small one-off cleanups bundled into the same PR train.

---

## 1. Button (raw `<button>`)

**Raw count:** 117 occurrences across 46 files.
**Top offenders (count per file):**

| Count | File                                                                                                                                                                                                                          |
| ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    11 | `SchemaManager/SchemaManager.tsx`                                                                                                                                                                                             |
|     8 | `project-types/ProjectTypeEditorForm.tsx`                                                                                                                                                                                     |
|     7 | `Editor/RevisionControl/RevisionControl.tsx`                                                                                                                                                                                  |
|     6 | `preferences/HeadingSettingsModal.tsx`, `Layout/AppShell.tsx`                                                                                                                                                                 |
|     5 | `preferences/UserPreferencesPage.tsx`, `Timeline/Timeline.tsx`                                                                                                                                                                |
|     4 | `common/CompilePreviewModal.tsx`                                                                                                                                                                                              |
|     3 | `preferences/DefaultRevisionNameModal.tsx`, `preferences/BodySettingsModal.tsx`, `common/UI/Chip/Chip.tsx`, `common/TagsManagerModal.tsx`, `Timeline/TimelineChip.tsx`, `Start/StartPage.tsx`, `Start/CreateProjectModal.tsx` |

**Duplication patterns observed** (exact classNames, repeat count):

| Repeats | Pattern (truncated)                                                                                                                                                                  | Visual role             |
| ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
|       8 | `project-type-editor-action-button` (CSS class)                                                                                                                                      | toolbar action          |
|       6 | `rounded-md border border-gw-border bg-transparent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gw-secondary transition-colors duration-150 hover:bg-gw-chrome2` | modal-footer secondary  |
|       5 | `border border-gw-primary text-gw-primary bg-transparent rounded-md font-mono text-[10px] uppercase tracking-[0.16em] px-4 py-2 hover:bg-gw-chrome2 transition-colors duration-150`  | modal cancel / outline  |
|       4 | `project-modal-button-{primary,secondary}` (CSS classes)                                                                                                                             | project-modal footer    |
|       4 | `appshell-{topbar-button,sidebar-toggle}` (CSS classes)                                                                                                                              | top-bar icon button     |
|       3 | `timeline-chip` (CSS class)                                                                                                                                                          | timeline chip clickable |
|       2 | `compile-modal-generate-button` (CSS class)                                                                                                                                          | compile primary         |
|    many | one-off Tailwind clusters                                                                                                                                                            | misc                    |

**Why it scores #1:** four distinct visual variants (secondary, primary outline, icon-only, danger) are repeated inline with copy-paste Tailwind in nearly every modal. A canonical `Button` with ~3 variants (`default`, `outline`, `ghost`) plus a `size` prop replaces 117 call sites with a uniform API and deletes ~300 lines of repeated class strings.

**Recommendation:** **MIGRATE.** Canonical `Button` built on shadcn's button primitive, styled with brand tokens. Phase-one target call sites:

- All 11 modals in `components/common/`, `components/preferences/`, `components/Start/`, `components/ResourceTree/` (modal footers — exact pattern dupes).
- `SchemaManager.tsx` and `ProjectTypeEditorForm.tsx` action toolbars (CSS-class buttons; absorb the class into a variant).
- Top-bar buttons (`appshell-topbar-button`, `appshell-sidebar-toggle`).

**Defer:** Timeline-specific buttons (`timeline-zoom-btn`, `timeline-chip`) — they are visually unique and the migration cost outweighs the wins. Revisit in phase two.

---

## 2. Dialog / Modal / Overlay

**Raw count:**

- **4 distinct overlay implementations** in `components/common/`:
  1. `ModalOverlayShell.tsx` (30 LOC) — uses `appshell-modal-*` CSS classes.
  2. `ProjectModalFrame.tsx` (38 LOC) — uses `project-modal-*` CSS classes.
  3. `ConfirmDialog.tsx` (114 LOC) — uses `confirm-dialog-*` CSS classes + **hand-rolled focus trap** (lines 29–65).
  4. Inline `<div className="fixed inset-0 z-50 …">` in `RenameProjectModal.tsx`, `RenameResourceModal.tsx`, `ResourceCommandPalette.tsx` (3 occurrences).

- **12 modal components** built on top of the four overlays:

| File                                       |      LOC | Overlay used           |
| ------------------------------------------ | -------: | ---------------------- |
| `common/CompilePreviewModal.tsx`           |      198 | ModalOverlayShell      |
| `common/ExportPreviewModal.tsx`            |       60 | ModalOverlayShell      |
| `common/TagsManagerModal.tsx`              |      204 | ModalOverlayShell      |
| `common/ResourceCommandPalette.tsx`        |      235 | inline `fixed inset-0` |
| `common/ConfirmDialog.tsx`                 |      114 | self-contained         |
| `preferences/BodySettingsModal.tsx`        |      114 | ModalOverlayShell      |
| `preferences/DefaultRevisionNameModal.tsx` |      117 | ModalOverlayShell      |
| `preferences/HeadingSettingsModal.tsx`     |      424 | ModalOverlayShell      |
| `Start/CreateProjectModal.tsx`             |      370 | ProjectModalFrame      |
| `Start/RenameProjectModal.tsx`             |       81 | inline `fixed inset-0` |
| `ResourceTree/CreateResourceModal.tsx`     |      172 | ProjectModalFrame      |
| `ResourceTree/RenameResourceModal.tsx`     |       92 | inline `fixed inset-0` |
| **Subtotal**                               | **2181** |                        |

**Findings:**

- **No portal usage anywhere** — every overlay is rendered inline in its parent tree, with no `createPortal`. Z-index conflicts are managed by hand.
- **Focus management is ad-hoc.** Only `ConfirmDialog` implements a focus trap (manually, with shift-Tab cycling). Other modals rely on browser focus order.
- **Escape handling is inconsistent.** Some modals listen via `useEffect`, others don't handle Escape at all.
- **Three CSS class systems** (`appshell-modal-*`, `project-modal-*`, `confirm-dialog-*`) all paint roughly the same picture: backdrop + centered panel. The fact they exist in parallel is the duplication.

**Recommendation:** **MIGRATE.** Canonical `Dialog` built on shadcn's Radix-Dialog base, styled with brand tokens. Migrate all 12 modals + the 3 inline overlays + retire `ModalOverlayShell`, `ProjectModalFrame`, `ConfirmDialog` shells (keep `ConfirmDialog` as a thin wrapper around `Dialog` for the common `title/description/confirm/cancel` shape).

**Risk:** Highest in the audit. Existing tests (`tests/exportPreviewModal.test.tsx`, `tests/compilePreviewModal.test.tsx`, `tests/createProjectModal.error.test.tsx`, `tests/component/*`) gate behavior. Radix Dialog uses portals — verify Storybook + a11y test wiring before the first migration.

---

## 3. Card / Surface (bordered, rounded)

**Raw count:** 55 occurrences of `rounded-md|rounded-lg|rounded-xl` combined with `border`; 34 of those match the specific `rounded(-md|-lg|-sm)? border border-gw-border bg-*` shape.

**Representative inline implementations:**

| File                                                                              | Pattern                                                    |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `WorkArea/Views/OrganizerView/OrganizerCard.tsx`                                  | `h-48 border border-gw-border rounded-md p-4 bg-gw-chrome` |
| `help/HelpSectionCard.tsx`                                                        | uses `help-section-card help-card` CSS classes             |
| `Start/StartPage.tsx`, `Sidebar/MetadataSidebar.tsx`, multiple preferences modals | repeated `border border-gw-border rounded-md …`            |

**Findings:**

- No shared `Card` / `Surface` primitive exists.
- Padding and background vary slightly (`p-3` / `p-4`, `bg-gw-chrome` / `bg-gw-chrome2`) but the visual concept is consistent: a bordered, rounded surface on chrome background.

**Recommendation:** **MIGRATE.** Canonical `Card` primitive on shadcn's Card base with variants for padding and chrome level (`chrome` / `chrome2`). Phase-one targets:

- `OrganizerCard.tsx` (inlines container styles)
- Inline card-shaped divs in `StartPage.tsx`, `MetadataSidebar.tsx`, preferences modals
- `HelpSectionCard.tsx` (refactor from CSS classes to canonical Card)

---

## 4. Input / Textarea / Select

**Raw count:**

| Type                            |                  Count | Notable files                                                                                                                                                                                         |
| ------------------------------- | ---------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<input type="text/email/etc">` | 21 typed + ~30 untyped | `ProjectTypeEditorForm.tsx` (7), `EditorMenuInput.tsx` (6), `HeadingSettingsModal.tsx` (4), `SchemaManager.tsx` (4)                                                                                   |
| `<input type="checkbox">`       |                     12 | `SchemaManager.tsx`, `BooleanToggle.tsx`, `MultiSelectList.tsx`, `CompilePreviewModal.tsx`, `CompileResourceTree.tsx`, `TagsManagerModal.tsx`, `UserPreferencesPage.tsx`, `ProjectTypeEditorForm.tsx` |
| `<select>`                      |                     11 | spread across 11 files                                                                                                                                                                                |
| `<textarea>`                    |                      4 | `ProjectTypeEditorForm.tsx`, `SynopsisInput.tsx`, `NotesInput.tsx`, `SchemaManager.tsx`                                                                                                               |

**Duplication patterns** (exact classNames, repeat count):

| Repeats | Pattern                                                                                                                                                                    | Used in                                                             |
| ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
|       4 | `w-full mt-2 p-2 border border-gw-border rounded text-sm`                                                                                                                  | `MetadataSidebar`, `SelectInput`, `NumberInput`, `ResourceRefInput` |
|       2 | `w-full p-2 border rounded text-sm` (no token)                                                                                                                             | misc                                                                |
|       2 | `compile-tree-checkbox` (CSS class)                                                                                                                                        | `CompilePreviewModal`, `CompileResourceTree`                        |
|       1 | `w-full rounded-md border border-gw-border bg-transparent px-3 py-2 text-sm text-gw-primary placeholder-gw-secondary focus:outline-none focus:ring-1 focus:ring-gw-border` | various                                                             |
|       1 | `w-full mt-2 p-2 border border-brand-mid text-sm`                                                                                                                          | uses **legacy `brand-mid` token** (drift)                           |
|       1 | `w-full mt-1 p-2 border rounded text-sm`                                                                                                                                   | inconsistent margin                                                 |

**Findings:**

- `components/Sidebar/controls/` already has a partial shared layer: `LabeledField`, `NumberInput`, `SelectInput`, `BooleanToggle`, etc. But each control reimplements its own classes; there is no shared `Input` element.
- One file uses the **legacy `brand-mid` token** instead of `gw-*`, an example of drift the audit surfaces.
- Checkboxes are styled inconsistently — some inline, some via the `compile-tree-checkbox` CSS class.

**Recommendation:** **MIGRATE.** Canonical `Input` (text/number/email), `Textarea`, `Select`, and `Checkbox` primitives on shadcn bases. Phase-one targets:

- The four sidebar controls that share the identical w-full mt-2 p-2 class string.
- Modal text inputs in `BodySettingsModal`, `DefaultRevisionNameModal`, `HeadingSettingsModal`, `CreateProjectModal`, `RenameProjectModal`, `CreateResourceModal`, `RenameResourceModal`.
- Checkboxes in compile/export tree pickers and `MultiSelectList`.

**Defer:** Specialized inputs (`SearchBar` autocomplete, `ResourceCommandPalette` search input, `POVAutocomplete`, `MultiResourceRefInput`) — they layer custom behavior on top and aren't simple text-field replacements. Revisit in phase two.

---

## 5. CollapsibleSection ↔ SidebarSection

**Raw count:** 2 components, 121 LOC combined, near-duplicate.

**Findings:**

- `components/Sidebar/SidebarSection.tsx` (57 LOC) and `components/WorkArea/CollapsibleSection.tsx` (63 LOC) implement the same primitive: a button-triggered collapsible with a chevron icon and slugified `aria-controls` content id.
- They differ only in label typography (`text-[11px] mono uppercase` vs `text-sm font-bold`) and the optional `actions` slot.

**Recommendation:** **MERGE** (no shadcn needed). Consolidate into a single `CollapsibleSection` component with a `variant: "sidebar" | "workarea"` prop and the optional `actions` slot. shadcn's `Collapsible` is overkill here — the existing JSX is fine; the duplication is the problem, not the primitive.

---

## 6. Chip / Tag / Badge

**Raw count:** 5+ parallel chip/tag CSS class systems.

| System                                                  | File(s)                                                      | Status                  |
| ------------------------------------------------------- | ------------------------------------------------------------ | ----------------------- |
| `Chip` component (`components/common/UI/Chip/Chip.tsx`) | imported in 1 place (`MultiResourceRefInput.tsx`)            | **under-used**          |
| `metadata-sidebar-tag` (CSS classes)                    | `Sidebar/TagsSection.tsx`                                    | parallel implementation |
| `searchbar-chip` (CSS classes)                          | `SearchBar/SearchBar.tsx`, `SearchBar/SearchFilterPanel.tsx` | parallel implementation |
| `TimelineChip.tsx` (separate component)                 | `Timeline/TimelineChip.tsx`, `Timeline/TimelineRow.tsx`      | parallel implementation |
| revision-badge inline                                   | `Editor/RevisionControl/RevisionControl.tsx`                 | inline                  |

**Findings:**

- A shared `Chip` primitive already exists but only one consumer imports it.
- `TagsSection` and `SearchFilterPanel` both implement toggleable chips, with their own CSS classes — exactly what `Chip` was built for.
- `TimelineChip` is visually distinct (positional on a timeline) and probably stays separate.

**Recommendation:** **MIGRATE** (consolidate to existing `Chip`). No shadcn primitive needed — extend the existing `Chip` API with an `active`/`pressed` state and migrate `TagsSection`, `SearchBar`, `SearchFilterPanel` to use it. **Defer** `TimelineChip` (visually distinct, separate concern).

---

## 7. `Toaster.tsx` hardcoded hex (token compliance)

**Raw count:** 13 hardcoded hex literals in `components/notifications/Toaster.tsx` — Tailwind palette values (`#1f2937`, `#10b981`, `#ef4444`, `#3b82f6`, etc.) used inline for toast variants.

**Findings:**

- `Toaster.tsx` (81 LOC) configures `react-hot-toast` with success/error/info color palettes pulled from Tailwind defaults — no brand tokens.
- This violates FR 6 (red reserved for canonical/position state only — `#ef4444` is used for error toasts) and FR 8 (Tailwind config / brand tokens as single source of truth).
- Everywhere else, hardcoded hex appears only as CSS-var fallbacks (`var(--color-gw-X, #FALLBACK)`) — legitimate — or as `#000000` placeholders in color-picker UI (also legitimate).

**Recommendation:** **TOKEN SWEEP.** Replace the 13 raw hex values with brand tokens (introduce `--color-gw-toast-{success,error,info}-{bg,fg,accent}` if missing). No shadcn primitive needed — this is a token-compliance fix bundled with the brand-token sweep (tasks.md Task 8).

---

## Categories explicitly left alone

### MenuItemButton

- **Status:** already consolidated. Used in 20 places by 3 menu containers (`ResourceContextMenu`, `ShellSettingsMenu`, `ManageProjectMenu`).
- The menu _containers_ repeat outside-click + arrow-key + escape logic, but that's a hook (a `useMenu` / `useDismissable`), not a visual primitive. **Defer** to a separate behavior-consolidation pass.

### ViewSwitcher

- **Status:** isolated, used in one place, with full keyboard navigation already implemented.
- shadcn `Tabs` is a candidate replacement but adoption cost > savings. **Leave** for now; revisit only if a second tablist appears.

### TipTap editor menu (`Editor/MenuBar/`)

- **Status:** out of scope per spec non-goals. Not audited.

---

## Hardcoded-color baseline (FR 6 / FR 8)

- **34 hex literals total** across 8 files.
- **11** are legitimate CSS-var fallbacks: `var(--color-gw-X, #FALLBACK)` in `Chip.tsx` and `TimelineTooltip.tsx`.
- **6** are `#000000` placeholders in color-picker UI (TagsManagerModal, HeadingSettingsModal, ProjectTypeEditorForm).
- **1** is `#fff` on a filled tag chip (TagsSection.tsx:122) — pragmatic for arbitrary user-chosen tag colors.
- **3** are `#D44040` direct uses of the red token in TimelineTooltip — should be `var(--color-gw-red)` or `text-gw-red`.
- **13** are Tailwind palette values in Toaster.tsx — see category 7.

After Task 8 (brand-token sweep), only the legitimate fallback / color-picker / arbitrary-user-color uses should remain.

---

## Open questions surfaced by the audit (input to `decisions.md`)

1. **Threshold for migration.** Categories with ≥ 20 occurrences across ≥ 5 files clearly clear any bar. Borderline cases:
   - `appshell-topbar-button` (4 occurrences) — migrate as a `Button` variant, or leave?
   - Chip system has 5 callsites — migrate, or wait until it's larger?
   - Recommended threshold: **migrate at ≥ 10 occurrences across ≥ 3 files**; below that, leave.

2. **CSS-class buttons** (`project-modal-button-*`, `appshell-topbar-button`, `project-type-editor-action-button`, `timeline-chip`, etc.) are styled in global CSS files, not Tailwind. Two paths:
   - **A**: migrate them to Tailwind-styled `Button` variants and delete the CSS rules.
   - **B**: keep CSS classes, pass them through `Button`'s `className` prop.
   - Recommended: **A** for phase one — `Button` should own its styling, not delegate to the global stylesheet.

3. **Primitives directory.** Current precedent: `components/common/UI/Chip/Chip.tsx`. Two viable paths:
   - **A**: `components/common/UI/<Primitive>/` — extends existing precedent.
   - **B**: `components/ui/<primitive>/` — matches shadcn CLI default.
   - Recommended: **A** — fewer disruptions; existing imports and tests already use this path.

---

## Phase-one migration set (recommended)

Based on this audit, the phase-one canonical primitives are:

1. **`Button`** (Task 4 in tasks.md) — top impact, ~117 call sites, ~300 LOC saved.
2. **`Dialog`** (Task 5 in tasks.md) — highest risk, ~12 modals + 3 inline overlays, ~400 LOC saved.
3. **`Card`** (new — not in current tasks.md) — ~55 surfaces, ~150 LOC saved. **Recommend adding to tasks.md.**
4. **`Input`** / **`Textarea`** / **`Select`** / **`Checkbox`** (Task 6 in tasks.md) — ~48 controls, ~150 LOC saved.

**Bundled small cleanups (no shadcn):**

5. Merge `CollapsibleSection` + `SidebarSection` (~60 LOC saved).
6. Adopt existing `Chip` in `TagsSection`, `SearchBar`, `SearchFilterPanel` (~80 LOC saved).
7. `Toaster.tsx` token sweep (Task 8 in tasks.md, expanded scope).

**Out of phase one:**

- `MenuItem` migration (Task 7 in tasks.md) — `MenuItemButton` is already shared; the duplication is in menu _containers_, not items. **Recommend deferring Task 7** and replacing it with a "menu-container behavior hook" task in a phase-two iteration.
- Timeline / TipTap-specific visuals.
- ViewSwitcher.

**Net phase-one savings estimate:** ~1140 LOC removed, ≥ 30% reduction in distinct implementations across the four targeted categories (spec goal 2).
