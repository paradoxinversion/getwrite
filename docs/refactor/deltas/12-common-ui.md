# Slice 12 — Common UI primitives · change deltas

Date: 2026-06-17. Gate: green (typecheck clean, 13 test files / 168 tests pass, lint clean for all in-scope files, knip pre-existing baseline only).

---

## Per-file deltas (delegated to Antonini)

### `components/common/TagsManagerModal.tsx`

Lines before → after: 183 → 183 (rename-only pass, no line count change).
Symbols renamed: 2 (`useColor` → `shouldUseColor`, `setUseColor` → `setShouldUseColor`).
Files touched: 1.

- **[naming/lint]** Renamed `useColor` → `shouldUseColor` and `setUseColor` → `setShouldUseColor` at the `useState` declaration and all 4 downstream uses (the `handleCreate` body (2 sites), the checkbox `checked` prop, and the checkbox `onChange` handler). Fixes the pre-existing `@typescript-eslint/naming-convention` lint error requiring boolean state variables to carry an `is/has/should/can/did/will` prefix.

---

### `components/common/UI/CollapsibleSection/CollapsibleSection.tsx`

Lines before → after: 89 → 89 (rename-only pass, no line count change).
Symbols renamed: 1 (`next` → `isNowOpen`, local to `toggle`).
Files touched: 1.

- **[naming/lint]** Renamed `next` → `isNowOpen` inside `toggle`. Fixes the pre-existing `@typescript-eslint/naming-convention` error for boolean locals. The new name is also more expressive — it conveys both the boolean nature and its temporal meaning (the state the component is transitioning into).

---

### `components/common/UI/ContextMenu/EditContextMenu.tsx`

Lines before → after: 170 → 170 (within-line change only).
Symbols renamed: 0.
Files touched: 1.

- **[structure]** `hasSelection` derived value simplified: `saved ? saved.end > saved.start : false` → `!!saved && saved.end > saved.start`. Eliminates the ternary branch; the `&&` short-circuit form is more direct and readable. Both evaluate identically.

---

### `components/common/UI/hooks/useDismissableMenu.ts`

Lines before → after: 76 → 76 (net neutral — one line added, one removed).
Symbols renamed: 0.
Files touched: 1.

- **[structure]** Extracted `{ capture: true }` into a named `const captureOpts: AddEventListenerOptions`. The object was written inline twice, with the second instance needing an `as EventListenerOptions` cast to satisfy the `removeEventListener` overload. Sharing the variable eliminates the duplication and the cast.

---

### `src/lib/toast-service.ts`

Lines before → after: 130 → 111 (−14%).
Symbols renamed: 0.
Files touched: 1.

- **[comments]** Removed the module-level `@example` block. The per-method examples are more specific and already illustrate the import path and call patterns; the module-level example was strictly redundant.
- **[comments]** Removed the `dismiss` `@example` block. The `loading` method's own example already demonstrates the `loading` → `dismiss` pattern in a realistic async context. The `dismiss` docblock retains its `@param` and description.
- **[comments]** Removed the `dismissAll` `@example` block. A zero-argument, void-return method with a one-word name needs no example; the description and signature are self-sufficient. All `@param` docs and method descriptions are preserved.

---

### `src/hooks/use-toast.ts`

Lines before → after: 45 → 29 (−35%).
Symbols renamed: 0.
Files touched: 1.

- **[comments]** Trimmed the `@example` in the module JSDoc from a full 22-line component with try/catch/return JSX down to 4 lines showing the essential loading+dismiss pattern. The core usage pattern is preserved and immediately legible.

---

### `components/common/MenuItemButton.tsx`

Lines before → after: 63 → 63 (within-line import change, no line count change).
Symbols renamed: 0.
Files touched: 1.

- **[structure]** Replaced `import React from "react"` with `import { type ReactNode } from "react"`. The default `React` namespace import was unused (automatic JSX runtime); the only `React.*` usage was `React.ReactNode` in the interface. Updated `React.ReactNode` → `ReactNode` to match.

---

### `components/Sidebar/controls/LabeledField.tsx`

Lines before → after: 24 → 24 (within-line changes only).
Symbols renamed: 0.
Files touched: 1.

- **[structure]** Same `import React from "react"` → `import { type ReactNode } from "react"` cleanup as above; updated `React.ReactNode` → `ReactNode` in `LabeledFieldProps`.
- **[comments]** Corrected the doc comment: it said `text-sm font-medium` but the actual label className is `text-gw-micro font-medium font-mono`. Updated to match the code.

---

### Files with no changes applied

- `components/common/UI/Tabs/Tabs.tsx` (160 lines) — Already clean. The `!disabled &&` guard inside `TabsTrigger`'s `onClick` was assessed and kept: it prevents `onValueChange` from firing on programmatic/synthetic clicks (e.g., JSDOM), where native `disabled` has no effect. Removing it would be a behavior change.
- `components/common/UI/Chip/Chip.tsx` (116 lines) — No meaningful refactor opportunities. The three-branch rendering, tooltip spread pattern, and `GW-HEX-EXEMPT` comments are all correct as-is.
- `components/common/ConfirmDialog.tsx` (64 lines) — Already at clarity ceiling. The `aria-describedby=""` pattern is intentional a11y behavior and was left exactly as is.
- `components/Sidebar/controls/useSyncedControlledValue.ts` (27 lines) — Already minimal and idiomatic. No changes.

---

## Cross-file unification

**Goal:** Unify the controlled/uncontrolled value pattern via `useSyncedControlledValue`.

**Assessment:** The pattern is already unified. There is exactly one canonical implementation at `components/Sidebar/controls/useSyncedControlledValue.ts`, used consistently by all 8 consumers (all within the Sidebar tree: `SynopsisInput`, `NotesInput`, `StatusSelector`, `BooleanToggle`, `SelectInput`, `MultiSelectList`, `NumberInput`, `MetadataSidebar`).

**Deliberate non-move:** Moving the hook to `common/UI/hooks/` was considered and rejected. All consumers are Sidebar-adjacent and import via relative paths within the Sidebar tree. The test at `tests/useSyncedControlledValue.test.tsx` also imports from `Sidebar/controls/`. A move would require updating 9+ import paths including the test — a broad cross-file rename with no behavior gain and equivalent to a cross-slice module-path change. The co-location with consumers is a valid pattern; co-locating shared utilities near their primary consumers is idiomatic in this codebase.

**Recommendation for a future pass:** If `useSyncedControlledValue` is ever needed outside the Sidebar tree, that is the right time to promote it to `common/UI/hooks/` with a coordinated import update.

---

## Signature stability

All exported prop interfaces and function signatures are unchanged:

- `TagsManagerModalProps`, `CollapsibleSectionProps`, `UseDismissableMenuOptions`, `UseDismissableMenuReturn`, `TabsProps`, `TabsListProps`, `TabsTriggerProps`, `TabsContentProps`, `ChipProps`, `ConfirmDialogProps`, `MenuItemButtonProps`, `LabeledFieldProps` — all unchanged.
- Exported functions/hooks: `TagsManagerModal`, `CollapsibleSection`, `useDismissableMenu`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Chip`, `ConfirmDialog`, `MenuItemButton`, `LabeledField`, `useSyncedControlledValue`, `toastService`, `useToast` — all unchanged.

---

## Gate result

- **Typecheck:** clean (tsc --noEmit, exit 0).
- **Lint:** In-scope files are all clean. 28 errors remain in the repo — all pre-existing baseline in files outside the slice scope (`Layout/`, `QueryBuilder/`, `WorkArea/`, `e2e/`, test files, `models/locks.ts`). My changes introduced zero new lint errors and resolved 2 pre-existing errors in in-scope files (`TagsManagerModal.tsx`, `CollapsibleSection.tsx`).
- **Tests:** 13 test files, 168 tests, all passing (same as baseline).
- **Knip:** Pre-existing failures only (`toastService|default` duplicate export and others). Confirmed pre-existing by stash/rerun check. My changes introduced no new knip findings.
