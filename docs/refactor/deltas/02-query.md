# Slice 02 — Query / Smart Folders — Change Deltas

Date: 2026-06-17  
Branch: `refactor/brevity-and-clarity`  
Gate: typecheck clean · lint clean on slice files · 204/204 tests pass · knip unchanged from baseline

---

## Per-file deltas (from Antonini)

### `frontend/src/lib/models/query-ast.ts`

**Size delta:** 146 → 149 lines (+3, +2%)  
**Symbols renamed:** 0  
**Files touched:** 1

- **[structure]** Extracted `z.string().min(1)` — repeated five times across ComparisonNodeSchema, InNodeSchema, ExistsNodeSchema, TextNodeSchema, and ParamNodeSchema — into a named local const `nonEmptyString` with a "Shared primitives" section header. Single edit-site for the non-empty constraint.

---

### `frontend/src/lib/models/query-intrinsics.ts`

**Size delta:** 173 → 168 lines (-5, -3%)  
**Symbols renamed:** 0  
**Files touched:** 1

- **[structure]** Removed redundant outer parentheses in `wordCount` and `charCount` read accessors: `((resource as TextResource).wordCount ?? null)` → `(resource as TextResource).wordCount ?? null`.
- **[consistency]** Replaced the imperative push-loop in `linkedFrom`'s read with a declarative `filter(...).map(...)` chain, matching the style of `linksTo`'s read. Load-bearing direction comments preserved exactly.

---

### `frontend/src/lib/models/query-cache.ts`

**Size delta:** 137 → 133 lines (-4, -3%)  
**Symbols renamed:** 0  
**Files touched:** 1

- **[structure]** `setCached`: replaced the 4-line `let projectMap / if (!projectMap) { ... }` pattern with `if (!store.has(...)) store.set(..., new Map())` + non-null-asserted `store.get(...)!.set(...)`.
- **[structure]** `readRevision`: inlined the single-use `parsed` intermediate variable. Type cast and optional-chain now live directly on the return expression.

---

### `frontend/src/lib/models/saved-queries.ts`

**Size delta:** 134 → 137 lines (+3, +2%)  
**Symbols renamed:** 0  
**Files touched:** 1

- **[naming]** Extracted the string literal `".query.json"` into a named constant `QUERY_FILE_EXT`. The `endsWith` guard, the `slice` id-extraction, and the `queryFilePath` template literal all reference it — eliminates the duplicated magic string in three places.

---

### `frontend/src/store/querySlice.ts`

**Size delta:** 404 → 369 lines (-35, -8.7%)  
**Symbols renamed:** 0  
**Files touched:** 1

- **[structure]** `resetQueryState`: replaced 11 individual field assignments with `Object.assign(state, initialState)`. New fields added to initialState are automatically reset.
- **[nesting/consistency]** Removed 10 redundant terminal `return state` after mutation blocks across clearQueries, setSelectedProjectId, and all fulfilled/rejected case handlers. Pure early-bail stale guards preserved unchanged. Normalized early-bail `return state` to bare `return`.
- **[structure]** `loadSavedQueries` thunk: replaced explicit for-loop building a Record with `Object.fromEntries(data.queries.map((q) => [q.id, q]))`.
- **[naming]** `getErrorMessage`: simplified `error.message.trim().length > 0` to `error.message.trim()` (truthy check).

---

### `frontend/src/store/query-transport-service.ts`

**Size delta:** 148 → 120 lines (-28, -19%)  
**Symbols renamed:** 0 (public exports unchanged; `getApiErrorMessage` private helper eliminated by absorption into `postJson`)  
**Files touched:** 1

- **[extraction]** Introduced private `postJson<T>` helper owning the entire fetch → error-check → parse-or-throw → return pattern. All four public functions delegate to it, eliminating ~10 lines of near-identical boilerplate per function.
- **[structure]** Inlined `getApiErrorMessage` directly into `postJson`'s error branch — the helper was only ever called from those four identical error paths.
- **[structure]** Dropped `async`/`await` in the four public functions — they now `return postJson(...)` directly (a Promise passthrough).

---

### `frontend/src/store/queries-guards.ts`

**Size delta:** 15 → 15 lines (no change)  
**Symbols renamed:** 0  
**Files touched:** 0 (read only — no changes applied)

File was already maximally brief and clear. Note: knip reports this file as unused (exported but not imported anywhere) — pre-existing, not acted on; public signature preserved.

---

### `frontend/app/api/project/query/evaluate/route.ts`

**Size delta:** 244 → 266 lines (+22, +9%)  
**Symbols renamed:** 0  
**Files touched:** 1

Growth is from extracting four named helpers — each is strictly clearer than the inline equivalent.

- **[extraction]** `str(v)` / `num(v)` / `stringArray(v)` — three one-line type-narrowing helpers replace 8 repeated inline ternaries in `sidecarToResourceBase`.
- **[extraction]** `loadProjectConfig(projectRoot)` — extracts the try/catch config loading from `loadEvaluationInput`.
- **[extraction]** `flattenUserMetadata(rawSidecar)` — extracts the userMetadata flattening logic (with its load-bearing comment) into a named function.
- **[extraction]** `deriveTextCounts(projectRoot, id, resource)` — extracts the content.txt read (with its load-bearing comment) into a named function.
- **[structure]** Parallelised the three independent I/O calls in `loadEvaluationInput` via `Promise.all`.
- **[consistency]** Merged two separate `import type { … }` lines from the same module into one block.

---

### `frontend/app/api/project/query/saved/route.ts`

**Size delta:** 146 → 149 lines (+3, +2%)  
**Symbols renamed:** 1 (`deleted` → `didDelete` — local variable only; JSON response key `deleted` unchanged)  
**Files touched:** 1

- **[structure]** Merged two `import` statements from the same module into one with inline `type` modifier.
- **[structure]** Converted the `if (body.action === "…")` chain into a `switch (body.action)` with braced cases.
- **[naming]** `deleted` → `didDelete` — **gate-blocking baseline fix**: pre-existing lint error `@typescript-eslint/naming-convention` (boolean variable must use `did/is/has/...` prefix). Wire-format property key `{ deleted: boolean }` preserved via explicit `{ deleted: didDelete }`.

---

### `frontend/components/QueryBuilder/ValuePicker.tsx`

**Size delta:** 690 → 690 lines (net zero; ~0.5% smaller by bytes)  
**Symbols renamed:** 5 (`inDomain` → `isInDomain` ×2, `open` → `isOpen`, `atCap` → `isAtCap` — all boolean locals)  
**Files touched:** 1

- **[extraction]** `SuggestionList` sub-component — the `picker-typeahead__suggestions` listbox with buttons was copy-pasted identically in `SingleRefInput` and `MultiRefInput`. Both delegate to `SuggestionList`, eliminating ~18 lines of duplication.
- **[extraction]** `BetweenInput` sub-component accepting `type: "number" | "date"` — `NumberBetweenInput` and `DateBetweenInput` had identical structure (range wrapper, two EditContextMenu-wrapped inputs, separator). Both are now thin wrappers that forward to `BetweenInput`.
- **[naming]** `inDomain` → `isInDomain`, `open` → `isOpen`, `atCap` → `isAtCap` — boolean naming convention fixes.
- **[consistency]** Added `aria-selected={false}` to `role="option"` buttons inside `SuggestionList` — extraction made the missing attribute visible.

---

### `frontend/components/QueryBuilder/FilterChip.tsx`

**Size delta:** 619 → 615 → 615 lines (Antonini −4; orchestrator +0 net after menuOpen rename)  
**Symbols renamed:** 1 (`menuOpen` → `isMenuOpen` — orchestrator fix; baseline lint error in touched file)  
**Files touched:** 1

- **[structure]** Removed `let dividerIndex = 0` mutable outer variable in `OperatorSelect` — replaced `divider-${dividerIndex++}` key with `divider-${i}` (existing map index). Eliminated pre-existing no-unused-vars warning.
- **[extraction]** Added `menuAction` helper (memoized with useCallback) — wraps any `() => void` action to call it then close the menu. Replaced 5 identical inline `onClick` closures (`action(); closeMenu()`) in the overflow menu section.
- **[nesting]** Early-return inversion in `ValueInput` `multiValues` branch — primary path (defined options) no longer nested inside if.
- **[nesting]** Same early-return inversion for the `resource-ref`/`multi-resource-ref` case in the single-value switch.
- **[naming]** `menuOpen` → `isMenuOpen` — gate-blocking baseline fix in touched file (boolean state variable must use `is` prefix).

---

### `frontend/components/QueryBuilder/FieldPicker.tsx`

**Size delta:** 437 → 435 lines (-2, -0.5%)  
**Symbols renamed:** 3 (`open` → `isOpen`, `showAddRow` → `shouldShowAddRow`, `fuzzyCandidate` → `fuzzyResult`)  
**Files touched:** 1

- **[naming]** `open` → `isOpen` — fixes pre-existing lint error.
- **[naming]** `showAddRow` → `shouldShowAddRow` — fixes pre-existing lint error.
- **[naming]** `fuzzyCandidate` → `fuzzyResult` — clarity: it's the return value of fuzzyMatch(), not a candidate.
- **[structure]** `currentField` lookup collapsed: guarded ternary → single `find(...) ?? null`.
- **[structure]** `filteredSavedQueries` ternary reordered to lead with early-exit case.
- **[structure]** `groupedBySource` imperative loop replaced with `filteredFields.reduce(...)`.
- **[structure]** Field item `className` construction changed to `[base, ...conditionals].filter(Boolean).join(" ")` pattern — base class appears once, no `.trim()` needed.

---

### `frontend/components/QueryBuilder/QueryBuilder.tsx`

**Size delta:** 283 → 275 lines (-8, -3%)  
**Symbols renamed:** 2 (`editorOpen` → `isEditorOpen`, `showGroupDelete` → `shouldShowGroupDelete`)  
**Files touched:** 1

- **[naming]** `editorOpen` → `isEditorOpen` — required lint fix (boolean state variable).
- **[naming]** `showGroupDelete` → `shouldShowGroupDelete` — required lint fix.
- **[structure]** Removed `handleOpenEditor` — single-expression, used once. Inlined as `onClick={() => setIsEditorOpen(true)}`.
- **[structure]** Removed `handleCancelEditor` — same rationale. Inlined as `onCancel={() => setIsEditorOpen(false)}`. `handleRestoreFromAdvanced` kept (does two things).
- **[nesting/consistency]** Fixed two `react/no-unescaped-entities` errors on the empty-state string.

---

### `frontend/components/QueryBuilder/FilterGroup.tsx`

**Size delta:** 208 → 208 lines (no change)  
**Symbols renamed:** 0  
**Files touched:** 0 (read only — no changes applied)

File was already well-refactored. Drag handlers correctly use existing `isDragging`/`isDragOver` boolean naming. No meaningful improvements found.

---

### `frontend/components/QueryBuilder/SaveQueryDialog.tsx`

**Size delta:** 179 → 185 lines (+6, +3%)  
**Symbols renamed:** 0  
**Files touched:** 1

- **[comments]** Added "Reset form state each time the dialog opens" comment above first useEffect — explains why stale values from prior opens need clearing.
- **[comments]** Added "Detect save completion: pendingIdRef tracks the in-flight query ID" comment above second useEffect — explains the async-coordination pattern.
- **[comments]** Added "Guard on pendingIdRef prevents a stale Redux error" comment above `displayError` — explains the conditional suppression of errorMessage.
- **[naming/structure]** Removed spurious `async`/`Promise<void>` from `handleSubmit` — the function never awaits anything; `async` was misleading.

---

## Cross-file assessment

**Unification goal:** The slice doc flagged ValuePicker / FilterChip / FieldPicker as potentially sharing branching that could be unified.

Assessment after per-file passes:

- `ValuePicker` and `FilterChip.ValueInput` both render relative-date, range, and single-value inputs, but they use entirely different CSS class namespaces (`picker-*` vs `filter-chip__value-*`) and different type aliases (`ValuePickerValue` vs `FilterChipValue`). Unifying them would require changing the CSS class names (a UI contract) or introducing an abstraction layer — both are higher-risk changes beyond the brevity/clarity scope. Deferred.
- Within-file extraction (Antonini's `BetweenInput` and `SuggestionList` in ValuePicker; `menuAction` in FilterChip) captured the available within-file wins.
- The `FieldPicker`'s outside-click + focus pattern is the same as FilterChip — both are small and clear enough that extracting a shared hook would add indirection without clarity gain at this scale.

---

## Gate result

| Check                                     | Result                                                 |
| ----------------------------------------- | ------------------------------------------------------ |
| `pnpm typecheck` (frontend/)              | Clean (0 errors)                                       |
| `pnpm lint` on slice-02 files             | Clean — all slice-02 file errors resolved              |
| Vitest slice filters (7 files, 204 tests) | 204/204 pass                                           |
| `pnpm knip` (repo root)                   | Identical to baseline — no new unused exports or files |

**Baseline-red issues outside slice scope (not fixed):**

- `AppShell.tsx` — `queryBuilderOpen`, `saveDialogOpen`, `timelineViewEnabled`, `ok` naming errors (slice 10 scope)
- `ShellLayoutController.tsx` — `leftOpen`, `rightOpen` (slice 10 scope)
- `UpdateNotice.tsx` — `hidden`, `active` (slice 10 scope)
- `OperatorMenu.tsx` — `open` naming error (QueryBuilder directory, not in slice-02 scope list; untouched)
- `app/api/project/tags/delete/route.ts` — `deleted` naming error (not in slice-02 scope)
- Various warnings in other files — all pre-existing baseline

**My changes introduced no new lint errors or typecheck failures.**

---

## Signature stability

All public exports verified unchanged:

**Core models:** `QueryASTSchema`, `QueryAST`, all node types and schemas (query-ast); `INTRINSIC_FIELDS`, `getIntrinsicField`, `INTRINSIC_FIELD_KEYS`, `QueryContext`, `IntrinsicField` (query-intrinsics); `getCached`, `setCached`, `invalidate`, `readRevision`, `evaluateCached`, `clearAllCaches` (query-cache); `listQueries`, `readQuery`, `writeQuery`, `deleteQuery`, `SavedQuerySchema`, `SavedQuery` (saved-queries).

**Store:** All thunks (`loadSavedQueries`, `saveQuery`, `deleteQuery`, `evaluateQuery`), `clearQueries` action, all selectors, `QueryState` interface (querySlice); `resolveQueryRequestContext`, `fetchSavedQueryList`, `persistSavedQuery`, `removeSavedQuery`, `evaluateQueryAst`, `QueryRequestContext` (transport); `isStaleQueryResponse` (guards).

**API routes:** `POST` handler and `executeEvaluate` (evaluate route); `POST` handler (saved route). `export const dynamic` preserved.

**UI:** Default exports and all named exports for ValuePicker, FilterChip, FieldPicker, QueryBuilder, FilterGroup, SaveQueryDialog — all unchanged. `SingleRefInput` named export preserved.

One additive-internal change: `postJson` private helper added to query-transport-service.ts — not exported, purely internal.
