# Slice 04 — Metadata & Schema: Per-File Change Deltas

Date: 2026-06-17. Branch: `refactor/brevity-and-clarity`.

Note: `field-values.ts` was skipped — it was already refactored and committed in slice 07.

---

## Core

### `frontend/src/lib/models/metadata-schema.ts`

**Size delta:** 1095 → 1047 lines (4% smaller).

> Note: this decomposition did not land in the first orchestrator pass (only the
> boolean renames below were persisted then). It was re-run with Antonini directly
> and verified on disk: file confirmed at 1047 lines, helpers present, migration
> functions byte-identical, gate green (213 tests). The entries below describe what
> actually shipped.

**Symbols renamed:** 0 public. Private helpers added: `withLockedSchema`, `findField`, `applyNullablePatch`. Local boolean variables renamed for naming-convention compliance (orchestrator pass): `changed` → `hasChanged` (in `migrateMultipleToMultiRef`, `migrateLockedBuiltins`, `migrateProjectOnLoad`, `migrateFieldOptionsInSidecars`), `groupChanged` → `hasGroupChanged`, `needsSeed` → `shouldSeed`, `needsRename` → `shouldRename`. Destructuring discards renamed: `multiple: _removed` → `multiple: _isMultiple`, `locked: _removed` → `locked: _isLocked`.

**Files touched:** 1 (`metadata-schema.ts`).

**Changes (Antonini):**

- **[extraction]** Added `withLockedSchema(projectRoot, mutate)` — collapses the repeated acquire-lock / read / getOrInitSchema / mutate / write / return / release scaffold. Applied to **11 functions**: `addField`, `removeField`, `deprecateField`, `reorderFields`, `renameField`, `updateFieldOptions`, `addGroup`, `removeGroup`, `reorderGroups`, `updateRefProperties`, `changeFieldType`. Each call site is now its mutation body instead of 12–18 lines of try/finally scaffold.
- **[extraction]** Added `findField(group, fieldKey)` — mirrors the existing `findGroup` helper; extracts the `group.fields.find + throw \`Field not found: "${fieldKey}"\`` pattern, preserving the exact error string.
- **[extraction]** Added `applyNullablePatch(obj, key, value)` — collapses the triple-branch `undefined → skip / null → delete / value → set` pattern in `updateRefProperties` to three one-liner calls.
- **[consistency]** `changeFieldTypeWithMigration` and `updateFieldOptionsWithMigration` kept their manual lock/try/finally structure because they intentionally release the lock before running sidecar migration — the `withLockedSchema` abstraction cannot represent this two-phase pattern safely.
- **[consistency]** `migrateFieldOptionsInSidecars` and `migrateFieldTypeInSidecars` internal logic left byte-identical — migration paths untouched per the mandate.

**Changes (orchestrator — naming-convention lint fixes):**

- Renamed boolean locals in migration functions to satisfy `is/has/should/can/did/will` prefix rule. All renames are pure identifier substitutions with no logic change.
- Renamed destructuring discards `_removed` → `_isMultiple` / `_isLocked` to satisfy the same rule.

**Deferrals:** None.

---

### `frontend/src/lib/models/default-metadata-schema.ts`

**Size delta:** 0% (35 lines unchanged).

**Symbols renamed:** 0.

**Files touched:** 1 (read-only; no edits applied).

**Changes:** None. The file is a single constant declaration already at the ceiling of clarity. Antonini considered removing the explicit `multiple: false` from the `pov` field (since `undefined` is behaviorally identical) but deferred as an authorial-intent decision.

**Deferrals:** `multiple: false` on the `pov` field — explicit `false` vs. omitted is a user decision.

---

### `frontend/src/lib/models/tags.ts`

**Size delta:** 261 → 264 lines (1.3% larger; 3 extra lines for the named default export split).

**Symbols renamed:** 7 local variables: `p` → `projectPath` (in `readProject` and `writeProject`), `k`/`v` → `resourceId`/`value` (in normalizer loop), `before` → `countBefore` (in `deleteTag`), `res`/`arr` → `resourceId`/`tagIds` (in `deleteTag` assignments loop), `t` → `id` (in `unassignTagFromResource` filter).

**Files touched:** 1 (`tags.ts`).

**Changes:**

- **[naming]** `p` → `projectPath` in `readProject` and `writeProject`. The single-letter name gave no signal.
- **[naming]** `k`/`v` → `resourceId`/`value` in `writeProject` normalization loop.
- **[naming]** `before` → `countBefore` in `deleteTag`. Removes type ambiguity (number, not boolean or snapshot).
- **[naming]** `res`/`arr` → `resourceId`/`tagIds` in `deleteTag`'s assignments loop.
- **[naming]** `t` → `id` in `unassignTagFromResource` filter.
- **[structure]** `listResourcesByTag` push-loop collapsed to a `.filter().map()` chain. Removes mutable accumulator.
- **[structure]** Named the anonymous default export (`const tagOperations = { … }; export default tagOperations`). Eliminates the `import/no-anonymous-default-export` lint warning.

**Deferrals:** None.

---

## Store

### `frontend/src/store/metadata-schema-transport-service.ts`

**Size delta:** 302 → 252 lines (17% smaller in line count; 7377 → 7287 chars, 1.2% smaller). Line reduction is larger than character reduction because multi-line function bodies collapsed to single lines.

**Symbols renamed:** 0.

**Files touched:** 1.

**Changes:**

- **[structure]** Destructured `{ projectPath }` from `context` at the top of all 16 exported post functions. Each function previously wrote `context.projectPath` explicitly; now `projectPath` is used as a shorthand property.
- **[nesting/comments]** Simplified `getApiErrorMessage`: replaced two explicit casts with a single cast to `Record<string, unknown>` and a check on `body.error`.
- **[consistency]** For simple post functions (≤ ~4 payload fields), collapsed the `postToMetadataSchemaRoute({…})` call to a single line. Complex functions retain multi-line format.

**Deferrals:** None. The pre-existing `no-explicit-any` warning on `state: any` is intentional and documented by a comment — left unchanged.

---

## API Routes

### `frontend/app/api/project/metadata-schema/route.ts`

**Size delta:** 464 → 400 lines (14% smaller). 12,232 → 11,235 chars (8% smaller).

**Symbols renamed:** 0.

**Files touched:** 1.

**Changes:**

- **[extraction]** Added `okSchema(schema)` helper — every action branch ended with `const schema = await ...; return NextResponse.json({ schema })`. Extracting this collapses 14 two-line patterns into single-expression returns.
- **[extraction]** Added `invalidFieldKey(key)` helper — the slug-validation 400 error response was duplicated identically in `add-field` and `rename-key`.
- **[structure]** Collapsed each action branch from `const schema = await op(...); return NextResponse.json({ schema })` to `return okSchema(await op(...))`, removing ~28 intermediate `const schema` bindings.
- **[structure]** Merged the two identical `return NextResponse.json(...)` branches in the catch block into one call with a ternary on `isClientError`.
- **[structure]** Replaced the `for...of map.entries()` push-loop in `GET` with `Array.from(map.entries(), mapper)` — single expression, no mutable accumulator.

**Deferrals:** None.

---

### `frontend/app/api/project/tags/route.ts`

**Size delta:** +0.9% larger (2620 → 2643 bytes).

**Symbols renamed:** 0.

**Files touched:** 1.

**Changes:**

- **[extraction]** Extracted `TagsResponse` type alias for the union `ListTagsResponse | CreateTagResponse | AssignmentsResponse | ErrorResponse`. The five-line inline generic on `POST`'s return type compressed to one named line.

**Deferrals:** None.

---

### `frontend/app/api/project/tags/assign/route.ts`

**Size delta:** 0% (1274 bytes unchanged).

**Symbols renamed:** 0.

**Files touched:** 0.

**Changes:** None. The file was already as brief and clear as it can be.

---

### `frontend/app/api/project/tags/delete/route.ts`

**Size delta:** +1.3% larger (1015 → 1028 bytes).

**Symbols renamed:** 1 (`deleted` → `didDelete`).

**Files touched:** 1.

**Changes:**

- **[naming]** Renamed local `deleted` to `didDelete` to satisfy the `@typescript-eslint/naming-convention` rule. The JSON response property `deleted` is preserved via explicit form `{ deleted: didDelete }`.

**Deferrals:** None.

---

## UI — SchemaManager

### `frontend/components/SchemaManager/SchemaManager.tsx`

**Size delta:** 1151 → 1138 lines (1.1% smaller / 13 lines removed).

**Symbols renamed (Antonini):** 5 — `prefillVisible` → `isPrefillVisible`, `setPrefillVisible` → `setIsPrefillVisible`, `prefillSubmitting` → `isPrefillSubmitting`, `setPrefillSubmitting` → `setIsPrefillSubmitting`, `groupHasLockedFields` → `hasGroupLockedFields`.

**Files touched:** 1 (all renames are local-only).

Note: Antonini reported these changes but they were not persisted to disk. The orchestrator applied them directly.

**Changes:**

- **[naming]** Removed dead import `removeMetadataField` (was imported but never called anywhere in the file — pre-existing unused import).
- **[naming]** `prefillVisible` / `setPrefillVisible` → `isPrefillVisible` / `setIsPrefillVisible` — fixes ESLint naming-convention error.
- **[naming]** `prefillSubmitting` / `setPrefillSubmitting` → `isPrefillSubmitting` / `setIsPrefillSubmitting` — same convention fix.
- **[naming]** `groupHasLockedFields` → `hasGroupLockedFields` — same convention fix (local variable inside `.map()` callback).
- **[extraction]** Added `FIELD_TYPE_OPTIONS` module-level constant (pre-cast `Object.entries(FIELD_TYPE_LABELS)`).
- **[structure]** Replaced repeated `Object.entries(FIELD_TYPE_LABELS) as [MetadataFieldType, string][]` in both `<select>` elements with `FIELD_TYPE_OPTIONS.map(...)`.
- **[structure]** Simplified `onClick={() => { void handlePrefillCreate(); }}` to `onClick={() => void handlePrefillCreate()}`.
- **[nesting]** Collapsed duplicated `maxSelections` blur handler into a single dispatch with a ternary.

**Deferrals:** None.

---

### `frontend/components/SchemaManager/MigrationPreview.tsx`

**Size delta:** 358 → 357 lines (0.8% smaller; 12,701 → 12,599 chars).

**Symbols renamed:** 5 — `loading` → `isLoading`, `applying` → `isApplying`, `cancelled` → `isCancelled`, `React` default import removed (named `Fragment` added), `defaultAction` simplified.

**Files touched:** 1.

**Changes:**

- **[naming]** `loading` → `isLoading`, `applying` → `isApplying`: resolves three pre-existing naming-convention lint errors.
- **[naming]** `cancelled` → `isCancelled`: resolves the third lint error.
- **[structure]** Replaced default `React` import with named `Fragment` import; swapped `<React.Fragment key={...}>` → `<Fragment key={...}>`.
- **[extraction]** Collapsed `defaultAction(_key, newType)` from a two-branch if (both returned `"keep"`) into a single `return "keep"`. Dead parameters removed from signature and call site.

**Deferrals:** None.

---

### `frontend/components/SchemaManager/OptionsRemovalPreview.tsx`

**Size delta:** 320 → 315 lines (1.5% smaller; 11,559 → 11,389 chars).

**Symbols renamed:** 3 — `loading` → `isLoading`, `applying` → `isApplying`, `cancelled` → `isCancelled`.

**Files touched:** 1.

**Changes:**

- **[naming]** `loading` → `isLoading`, `applying` → `isApplying`, `cancelled` → `isCancelled`: resolves three pre-existing naming-convention lint errors.
- **[structure]** Inlined the one-use `initialRows` intermediate variable inside the `.then()` callback.
- **[structure]** Collapsed two `affectedCount > 0` / `affectedCount === 0` conditional JSX paragraphs into a single `<p>` with a ternary. Both branches rendered identical markup with only text content differing.

**Deferrals:** None.

---

### `frontend/components/SchemaManager/DeprecateOrClearDialog.tsx`

**Size delta:** 3654 → 3259 bytes (11% smaller). Line count unchanged at 112 (helper adds lines, extracted JSX removes equal number).

**Symbols renamed:** 0.

**Files touched:** 1.

**Changes:**

- **[extraction]** Extracted the duplicated radio `<label>` block into a file-local `RadioOption` helper component. Two nearly identical 14-line blocks collapse to two 6-line `<RadioOption>` calls.
- **[structure]** Removed `handleConfirm()` wrapper — it was a single-branch function used exactly once. Replaced `onClick={handleConfirm}` with direct inline ternary `onClick={choice === "deprecate" ? onDeprecate : onClear}`.

**Deferrals:** None.

---

## UI — Sidebar

### `frontend/components/Sidebar/MetadataSidebar.tsx`

**Size delta:** 568 → 561 lines (1% smaller lines; 18,541 → 18,605 chars, 0.3% larger — longer names offset line savings).

**Symbols renamed:** 6 — `synopsisEnabled` → `isSynopsisEnabled`, `notesEnabled` → `isNotesEnabled`, `povEnabled` → `isPovEnabled`, `timelineEnabled` → `isTimelineEnabled`, `showAddForm`/`setShowAddForm` → `isAddFormVisible`/`setIsAddFormVisible`, `multiple` (destructured local) → `isMultiple`.

**Files touched:** 1.

**Changes:**

- **[naming]** Renamed 5 boolean locals to carry `is` prefix, fixing pre-existing naming-convention lint errors.
- **[naming]** `showAddForm`/`setShowAddForm` → `isAddFormVisible`/`setIsAddFormVisible`.
- **[naming]** Destructured `multiple` from `field` renamed to `isMultiple`; passed as `multiple={isMultiple}` to preserve the typed prop name.
- **[naming]** Two identical handlers `handleFieldFocused` + `handleFieldCreated` (both set `isAddFormVisible(false)` and `setPendingFocusKey`) collapsed into one `handleAddFormDismissed`.
- **[structure]** `emit` one-liner wrapper (`onChangeField?.(key, value)`) inlined at every call site.
- **[naming/types]** Replaced `state: any` with `state: RootState` in three selectors, resolving the `no-explicit-any` warnings. Added `import type { RootState }` from the store.
- **[structure]** `React.Fragment` wrapping replaced with `<>` shorthand where key prop is not needed.

**Deferrals:** None.

---

### `frontend/components/Sidebar/AddFieldForm.tsx`

**Size delta:** 0% lines (376); 13,257 → 13,331 chars (0.6% larger — longer names add characters).

**Symbols renamed:** 3 — `labelEdited` → `isLabelEdited`, `showSuggestions` → `isShowingSuggestions`, `submitting` → `isSubmitting`.

**Files touched:** 1.

**Changes:**

- **[naming]** `labelEdited` → `isLabelEdited`, `showSuggestions` → `isShowingSuggestions`, `submitting` → `isSubmitting`: fixes three pre-existing naming-convention lint errors.

**Deferrals:** A11y warning at line ~229 — `aria-expanded` is not valid on `role=textbox`. Fixing requires a structural change (move the attribute to a wrapper element) — out of scope for a clarity pass.

---

### `frontend/components/Sidebar/TagsSection.tsx`

**Size delta:** 3% smaller (3203 → 3105 chars; 104 → 101 lines).

**Symbols renamed:** 0.

**Files touched:** 1.

**Changes:**

- **[structure]** Removed dead `LabeledField` import (imported but never used — pre-existing lint warning).
- **[structure]** Folded `selectedResource` intermediate variable into the `resourceId` selector. Both steps expressed as a single `useAppSelector` call; `shallowEqual` comparator preserved.

**Deferrals:** None.

---

## UI — Sidebar Controls

### `frontend/components/Sidebar/controls/BooleanToggle.tsx`

**Size delta:** 1225 → 1163 bytes (5% smaller).

**Symbols renamed:** 1 — `checked` → `isChecked`.

**Files touched:** 1.

**Changes:**

- **[naming]** `checked` → `isChecked`: fixes boolean-prefix lint rule.
- **[structure]** Removed unused `import LabeledField` (dead import).
- **[structure]** Removed unused `import React` (JSX transform handles JSX; no `React.*` namespace usage).

---

### `frontend/components/Sidebar/controls/MultiResourceRefInput.tsx`

**Size delta:** 4859 → 4865 bytes (+6 bytes, ~0%).

**Symbols renamed:** 1 — `atCap` → `isAtCap`.

**Files touched:** 1.

**Changes:**

- **[naming]** `atCap` → `isAtCap`: fixes boolean-prefix lint rule.

---

### `frontend/components/Sidebar/controls/POVAutocomplete.tsx`

**Size delta:** 3698 → 3706 bytes (+8 bytes, ~0%).

**Symbols renamed:** 1 — `open` → `isOpen`.

**Files touched:** 1.

**Changes:**

- **[naming]** `open` → `isOpen`: fixes boolean-prefix lint rule.

---

### `frontend/components/Sidebar/controls/NumberInput.tsx`

**Size delta:** 1372 → 1322 bytes (4% smaller).

**Symbols renamed:** 0.

**Files touched:** 1.

**Changes:**

- **[structure]** Inlined the single-use `const defaultValue = 0` intermediate variable; the value is self-evident inline at `value ?? 0`.

---

### Files left unchanged in controls (11)

`DateTimeInput.tsx`, `DurationInput.tsx`, `EndDateInput.tsx`, `LabeledField.tsx`, `MultiSelectList.tsx`, `NotesInput.tsx`, `ResourceRefInput.tsx`, `SelectInput.tsx`, `StatusSelector.tsx`, `SynopsisInput.tsx`, `useSyncedControlledValue.ts` — all already compact and lint-clean; no improvements identified.

---

## Cross-file unification

No cross-file unification was performed. The orchestrator assessed:

- `MigrationPreview` and `OptionsRemovalPreview` share structural patterns (`isLoading`/`isApplying`/`isCancelled` state, a "load preview data → confirm → apply" flow). The shared structure was already addressed by the per-file clarity passes. Extracting a shared base component or hook would involve behavioral risk (the two components call different API functions and have distinct data types) and would be a feature-level decomposition beyond the brevity/clarity mandate of this slice. Deferred with a note for a future, purposeful refactor.

---

## Gate result

**Baseline (pre-refactor):** typecheck clean; tests 9/9 files pass (213 pass, 1 skipped); lint 81 errors (all pre-existing); knip shows 4 pre-existing findings in slice files.

**Post-refactor:**

- Typecheck: clean (no errors introduced).
- Tests: 9/9 files pass, 213 pass, 1 skipped — identical to baseline.
- Lint: all naming-convention errors in in-scope files resolved. Remaining items in slice files are warnings only: `aria-expanded` a11y warning in `AddFieldForm.tsx` (structural fix, deferred) and `no-explicit-any` in `metadata-schema-transport-service.ts` (intentional, documented by comment).
- Knip: 4 pre-existing findings in slice files (`default` export in `metadata-schema.ts`, `default` export in `tags.ts`, `RemoveFieldChoice` in `DeprecateOrClearDialog.tsx`, `ResourceOption` in `MultiResourceRefInput.tsx`) — all confirmed pre-existing via stash comparison. No new knip findings introduced.
