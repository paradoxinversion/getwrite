# Slice 10 — Layout / Shell — Per-file deltas

Date: 2026-06-17. Branch: `refactor/brevity-and-clarity`.

Files delegated to Antonini (7). Cross-file unification by orchestrator (1 edit).
Gate: typecheck clean, lint clean for all in-scope files, 186/186 test files pass (2056 tests), slice filters 13/13.

---

## `components/Layout/AppShell.tsx`

**Size delta:** 1637 → 1628 lines (−9, then −44 more from interface removal = ~1584 final after cross-file unification)

**Symbols renamed:** 4

- `queryBuilderOpen` → `isQueryBuilderOpen` (+ setter): ESLint naming-convention fix. 7 call sites updated.
- `saveDialogOpen` → `isSaveDialogOpen` (+ setter): ESLint naming-convention fix. 3 call sites updated.
- `timelineViewEnabled` → `isTimelineViewEnabled`: ESLint naming-convention fix. 4 call sites updated (fallback useEffect, disabledViews IIFE, defensive switch guard).
- `ok` → `isOk` in `handleRenameConfirm`: ESLint naming-convention fix.

**Changes:**

- Extracted `triggerDownload(blob, filename)` internal helper function. The identical 7-line create-anchor/click/cleanup block appeared 4 times in `onConfirmCompile` (pdf, docx, md, txt branches). Each branch now calls `triggerDownload`. 4×7 lines → 4×3 lines plus 7-line helper.
- 4 naming-convention lint errors eliminated (all in function body, none in exported surface).

**Files touched:** 1 (no cross-file renames; renames were to local state variables).

---

## `components/Layout/ShellModalCoordinator.tsx`

**Size delta:** 454 → 442 lines (−12)

**Symbols renamed:** 0

**Changes:**

- Extracted `onDialogClose(setter)` module-level helper returning an `onOpenChange` handler that calls `setter(false)`. Applied to all 8 Dialog instances, replacing repeated 3-line inline lambdas with a single `onDialogClose(setX)` call.
- Removed dead-code expression `{hasUnsavedEditorChanges ? null : null}` (line 451) — always evaluated to null, no side effects. Prop `hasUnsavedEditorChanges` remains in the exported `ShellModalCoordinatorProps` interface unchanged.

**Files touched:** 1.

---

## `components/Layout/ShellSettingsMenu.tsx`

**Size delta:** 239 → 222 lines (−17)

**Symbols renamed:** 0

**Changes:**

- Extracted `projectScopedItems` module-level array of `{ icon, label, action }` for the 5 settings items gated by `hasProject`. The 5 separate `{hasProject ? <MenuItemButton ... /> : null}` guards replaced by a single `{hasProject && projectScopedItems.map(...)}` block. Item order, icons, labels, and action strings unchanged.
- The `close-project` item left inline (it occupies a distinct position after a separator, separate from the project-scoped block).

**Files touched:** 1.

---

## `components/WorkArea/Views/OrganizerView/OrganizerView.tsx`

**Size delta:** 177 → 177 lines (no change — lint-fix-only pass)

**Symbols renamed:** 4

- `notesEnabled` → `isNotesEnabled`: shorthand `{ notesEnabled }` expanded to `{ notesEnabled: isNotesEnabled }` to avoid changing the options type key. ESLint naming-convention fix.
- `showBodyState` / `setShowBodyState` → `isShowingBody` / `setIsShowingBody`: ESLint naming-convention fix.
- `next` (inside `handleToggle`) → `isNextShowing`: ESLint naming-convention fix.
- `cancelled` → `isCancelled`: ESLint naming-convention fix. Fetch-cancel guard behavior preserved exactly.

**Files touched:** 1. All renames are file-local.

---

## `components/WorkArea/Views/TimelineView/TimelineView.tsx`

**Size delta:** 152 → 152 lines (no change — lint-fix-only pass)

**Symbols renamed:** 2

- `povEnabled` → `isPovEnabled`: ESLint naming-convention fix. 4 uses in file updated.
- `notesEnabled` → `isNotesEnabled`: ESLint naming-convention fix. 3 uses in file updated.

All spec comments preserved (POV/Notes feature-flag gate, notes field provenance). useMemo dependency arrays updated to match renamed variables.

**Files touched:** 1.

---

## `app/page.tsx`

**Size delta:** 727 → 713 lines (−14)

**Symbols renamed:** 0

**Changes:**

- Extracted `downloadBlob(blob, filename)` helper inside `Home`. The identical 7-line create-anchor/click/revoke pattern appeared in both the `md` and `txt` export branches of `handleResourceAction`. Both call sites consolidated.
- Hoisted `resourcesMeta` mapping above the `if (opts?.format === "md")` branch split. Both branches were computing it identically from the same closure; computing it once before the branch removes 8 lines of duplication.

Pre-existing `any` warnings (lines 183, 184, 195, 196, 468) are intentional, documented by inline comments, and left unchanged.

**Files touched:** 1.

---

## `app/project-types/page.tsx`

**Size delta:** 75 → 73 lines (−2)

**Symbols renamed:** 0

**Changes:**

- Eliminated intermediate `templateFiles` variable in `loadProjectTypeTemplates`. The `const templateFiles = await ...; return templateFiles;` two-step replaced by `return await Promise.all(...)` — same semantics, no intermediate binding.
- `resolveProjectTypesDirectory` kept as a separate named function (its JSDoc home and named callsite are clearer than inlining a long expression).

**Files touched:** 1.

---

## `app/layout.tsx`, `app/preferences/page.tsx`

No changes made. Both files were already at their clearest form. `app/layout.tsx` has one pre-existing `@next/next/no-page-custom-font` warning that is not fixable at the code level (it requires a Next.js App Router font-loading approach change — outside the slice's scope).

---

## Cross-file unification (orchestrator)

AppShell defined 5 private interfaces (`ContextActionState`, `CreateModalState`, `ExportModalState`, `CompileModalState`, `RenameModalState`) that were structurally identical to the 5 publicly exported interfaces in ShellModalCoordinator (`ShellContextActionState`, `ShellCreateModalState`, `ShellExportModalState`, `ShellCompileModalState`, `ShellRenameModalState`).

Applied: import the Shell-prefixed types from ShellModalCoordinator as local aliases using `import type { ShellContextActionState as ContextActionState, ... }`. Removed the 5 redundant private interface declarations from AppShell (~44 lines).

Behavior: pure type-level change. The state shapes are identical; all runtime behavior is preserved. No exported signatures changed.

Knip side-effect: The baseline had knip flagging all 5 `Shell*` state interfaces as unused exports in ShellModalCoordinator. After the unification, those interfaces are now consumed by AppShell, so 5 knip unused-export findings are resolved.

---

## Gate result

| Check                                                                  | Result                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`                                                       | Clean (0 errors)                                                                                                                                                                                                                     |
| `pnpm lint` (in-scope files only)                                      | Clean (0 errors in AppShell, ShellModalCoordinator, ShellSettingsMenu, OrganizerView, TimelineView, app/page, app/layout, app/preferences/page, app/project-types/page)                                                              |
| `pnpm lint` (repo-wide)                                                | 29 errors remain — all pre-existing baseline in out-of-scope files. Reduced from 39 errors at baseline (10 fewer, all from in-scope file fixes).                                                                                     |
| `vitest run shellModalCoordinator appShellTimelineGating viewSwitcher` | 13/13 tests pass                                                                                                                                                                                                                     |
| `vitest run` (broad)                                                   | 2056/2057 tests pass (1 skipped, pre-existing)                                                                                                                                                                                       |
| `pnpm knip`                                                            | Pre-existing findings only; 5 fewer unused-export findings than baseline (ShellContextActionState, ShellCreateModalState, ShellExportModalState, ShellCompileModalState, ShellRenameModalState — resolved by cross-file unification) |

---

## Deferred / not done

- `UpdateNotice.tsx`: 2 pre-existing naming-convention errors (`hidden`, `active`). Not in the slice's stated scope. Recommend fixing in Foundation slice (01) or a follow-up pass.
- `OrganizerCard.tsx`: 1 pre-existing `no-explicit-any` warning. Not in scope.
- `AppShellResourceActionOptions`: knip still flags this interface as unused externally. It is exported but consumed only within AppShell's own module — a minor knip false-positive for a documentation interface. Not a behavior issue.
- `TimelineView` / `TimelineViewProps` duplication between `TimelineView.tsx` and its `index.ts` re-export: pre-existing knip duplicate-export finding, not introduced by this slice.
- `aria-pressed` on `menuitemcheckbox` in ShellSettingsMenu: pre-existing a11y warning requiring a design change, not a code clarity fix.
