# Multi Resource Ref Selection — Implementation Tasks

Spec: `docs/features/feature-specifications/metadata/multi-ref-selection/multi-ref-selection-spec.md`

---

### Task 1: Add `multi-resource-ref` to field type union

**What:** Extend `MetadataFieldTypeSchema` (Zod enum) and `MetadataFieldType` (TS union) to include `"multi-resource-ref"`.
**Files:** `frontend/src/lib/models/schemas.ts`, `frontend/src/lib/models/types.ts`
**Done when:** `MetadataFieldTypeSchema.safeParse("multi-resource-ref")` succeeds; a `MetadataField` literal with `type: "multi-resource-ref"` type-checks; `pnpm typecheck` passes.
**Depends on:** none
**Estimate:** 1
**Notes:** Single-line additions to the enum and the union. Covers FR 1. Also required adding `"multi-resource-ref": "Multi Ref"` to `FIELD_TYPE_LABELS` in `SchemaManager.tsx` — that record is `Record<MetadataFieldType, string>` (exhaustive), so typecheck fails without it.
**Done:** [x]

---

### Task 2: Extend `MetadataField` with `refFolder`, `includeSubfolders`, `maxSelections`

**What:** Add three optional properties to `MetadataFieldSchema` (Zod) and the `MetadataField` TS interface: `refFolder?: string`, `includeSubfolders?: boolean`, `maxSelections?: number` (positive integer).
**Files:** `frontend/src/lib/models/schemas.ts`, `frontend/src/lib/models/types.ts`
**Done when:** A `MetadataField` literal carrying any subset of the three new properties round-trips through `MetadataFieldSchema.safeParse`; `maxSelections` is validated as a positive integer (`z.number().int().positive().optional()`); `pnpm typecheck` and `pnpm test:ci` pass.
**Depends on:** Task 1
**Estimate:** 2
**Notes:** Covers FR 11, 12, 14 at the schema layer. JSDoc each property: `refFolder` and `includeSubfolders` only meaningful for `resource-ref` / `multi-resource-ref`; `maxSelections` only meaningful for `multi-resource-ref`.
**Done:** [x]

---

### Task 3: Model + API + Redux for ref-property updates

**What:** Add an `update-ref-properties` action (model function + route handler + Redux thunk) that patches `refFolder`, `includeSubfolders`, and `maxSelections` on a single field.
**Files:** `frontend/src/lib/models/metadata-schema.ts`, `frontend/app/api/project/metadata-schema/route.ts`, `frontend/src/store/projectsSlice.ts` (transport service file alongside)
**Done when:** Dispatching the new thunk patches the three properties in `state.projects.projects[id].metadataSchema` after the API returns; unit tests in `metadata-schema-types.test.ts` cover the model function happy path and locked-field guard; `pnpm test:ci` passes.
**Depends on:** Task 2
**Estimate:** 3
**Notes:** Follow the existing `update-field-options` / `change-field-type` action pattern in `metadata-schema.ts` and `route.ts`. Accept partial updates — passing `null` or omitting a property leaves the existing value alone; passing `undefined` clears it (decide and document one of the two semantics in JSDoc).
**Done:** [x] Partial-update semantics: `undefined`/absent = leave unchanged, `null` = clear, value = set. Tests in `metadata-schema-api.test.ts` and `metadata-schema-thunks.test.ts`.

---

### Task 4: Build `MultiResourceRefInput` component (chips, autocomplete, keyboard, click-to-navigate)

**What:** Create the chip-based input that renders selected resources as `Chip`s, drives an autocomplete dropdown, handles Enter/Backspace, and dispatches `setSelectedResourceId` on chip click.
**Files:** `frontend/components/Sidebar/controls/MultiResourceRefInput.tsx` (new), `frontend/tests/multi-resource-ref-input.test.tsx` (new)
**Done when:** Typing one or more characters shows suggestions filtered case-insensitively (FR 3); selecting from the dropdown or pressing Enter on an exact match adds a chip and clears the input (FR 4); Enter on no match adds nothing (FR 5); each chip renders via `Chip` (shape `sharp`, size `sm`) with `onDismiss` removing only that ref (FR 6); Tab cycles between chips, Backspace on empty input removes the last chip (FR 7); chips with non-null `id` dispatch `setSelectedResourceId(id)` on click and chips with `id: null` render with no `onClick` (FR 16); unit tests cover each behavior; `pnpm test:ci` and `pnpm typecheck` pass.
**Depends on:** Task 1
**Estimate:** 8
**Notes:** Pattern after `ResourceRefInput.tsx` for autocomplete state and suggestion list; reuse `LabeledField`. Value type is `ResourceRef[]` (FR 8) — no migration needed. Click-to-navigate uses `useAppDispatch` + `setSelectedResourceId` from `resourcesSlice`. The component should accept a `resourceOptions: ResourceOption[]` prop and let the parent handle filtering, keeping the component pure relative to project state.
**Done:** [x] 14 tests in `tests/multi-resource-ref-input.test.tsx`. Story at `stories/Sidebar/controls/MultiResourceRefInput.stories.tsx`.

---

### Task 5: Folder-scoped autocomplete candidates

**What:** Filter the `resourceOptions` passed into `MultiResourceRefInput` (or filter inside it given a `refFolder` / `includeSubfolders` prop) so candidates are limited to the configured folder and optionally its descendants.
**Files:** `frontend/components/Sidebar/MetadataSidebar.tsx` (or a co-located helper), `frontend/components/Sidebar/controls/MultiResourceRefInput.tsx`
**Done when:** Given a field with `refFolder: "<folderId>"` and `includeSubfolders: false`, the autocomplete only surfaces resources whose `folderId === refFolder` (FR 11); with `includeSubfolders: true`, candidates also include resources in any descendant folder (FR 12); when `refFolder` is unset, all resources remain candidates; unit test covers all three cases; `pnpm test:ci` passes.
**Depends on:** Tasks 2, 4
**Estimate:** 2
**Notes:** Descendant-folder resolution requires walking `state.resources.folders` by `parentId`. Either expose a helper (`resolveFolderScope(folders, refFolder, includeSubfolders): Set<string>`) or compute the candidate list in `MetadataSidebar` before passing into the input.
**Done:** [x] `resolveFolderScope` (BFS) and `filterResourceOptionsByScope` in `components/Sidebar/folderScope.ts`. `MetadataSidebar` gains `selectRawResourcesList` + `selectFoldersList` selectors and subscribes to both — ready for Task 7's `case "multi-resource-ref":` branch. 12 unit tests in `tests/folder-scope.test.ts`; all 822 tests pass, `pnpm typecheck` clean.

---

### Task 6: Max-selections enforcement

**What:** When `maxSelections` is set, prevent the input from adding chips beyond the cap and disable the text input once the cap is reached.
**Files:** `frontend/components/Sidebar/controls/MultiResourceRefInput.tsx`, `frontend/tests/multi-resource-ref-input.test.tsx`
**Done when:** With `maxSelections: 2` and two chips selected, the text input is disabled (`disabled` attribute set) and no further chips can be added via Enter or suggestion click; removing a chip re-enables the input; unit test covers cap reached, cap exceeded attempt blocked, removal re-enables; `pnpm test:ci` passes.
**Depends on:** Tasks 2, 4
**Estimate:** 1
**Notes:** Covers FR 14. The component should accept `maxSelections?: number` as a prop; unset means unbounded.
**Done:** [x] `atCap` guard in `addRef` + `disabled={atCap}` on the input. 3 new tests in `multi-resource-ref-input.test.tsx` (cap reached → disabled, Enter blocked at cap, under-cap → not disabled). All 825 tests pass, `pnpm typecheck` clean.

---

### Task 7: Wire `MultiResourceRefInput` into `MetadataSidebar`

**What:** Add a `case "multi-resource-ref":` branch in `MetadataSidebar`'s field-renderer switch that mounts `MultiResourceRefInput` with the correct `value`, `onChange`, scoped `resourceOptions`, and `maxSelections`.
**Files:** `frontend/components/Sidebar/MetadataSidebar.tsx`
**Done when:** A schema field with `type: "multi-resource-ref"` renders `MultiResourceRefInput` in the sidebar; its `onChange` writes the resulting `ResourceRef[]` to the sidecar through the existing per-field save path; adding, removing, and reordering chips persist correctly; an existing sidecar value (`ResourceRef[]`) loads and renders without a migration step (FR 8); `pnpm typecheck` passes.
**Depends on:** Tasks 4, 5, 6
**Estimate:** 1
**Notes:** Covers FR 2. The `onChange` shape (`ResourceRef[]`) plugs into the same `onChangeField(key, value)` callback used by all other typed inputs.
**Done:** [x] `case "multi-resource-ref":` added to `renderField` switch. Also fixed a pre-existing gap: `z.array(ResourceRefValueSchema)` was missing from `MetadataValueSchema` in `schemas.ts` (TS type already included `ResourceRef[]`, Zod did not). 3 new tests in `metadataSidebar.test.tsx`. All 828 tests pass, `pnpm typecheck` clean.

---

### Task 8: SchemaManager — add `multi-resource-ref` to field-type selector

**What:** Add `"multi-resource-ref": "Multi Ref"` (or similar label) to `FIELD_TYPE_LABELS` and ensure the type dropdown lists it.
**Files:** `frontend/components/SchemaManager/SchemaManager.tsx`
**Done when:** The field-type dropdown in SchemaManager includes "Multi Ref"; selecting it dispatches `changeMetadataFieldType` with `"multi-resource-ref"` and the sidebar renders the new control for that field; `pnpm typecheck` passes.
**Depends on:** Tasks 1, 7
**Estimate:** 1
**Notes:** Covers FR 9. One-line addition to the labels record plus verification the existing `changeMetadataFieldType` thunk accepts the new value (it should, given Task 1).
**Done:** [x] `"multi-resource-ref": "Multi Ref"` was already added to `FIELD_TYPE_LABELS` during Task 1 (required for exhaustive `Record<MetadataFieldType, string>`). Dropdown iterates `Object.entries(FIELD_TYPE_LABELS)` — no code changes needed. Added 2 tests to `schemaManager.test.tsx` verifying "Multi Ref" appears in the dropdown and that selecting it dispatches `changeMetadataFieldType` with the correct payload. All 830 tests pass, `pnpm typecheck` clean.

---

### Task 9: SchemaManager — folder picker + Include Subfolders checkbox

**What:** Add UI controls in SchemaManager to set `refFolder` (folder picker dropdown) and `includeSubfolders` (checkbox) on a `multi-resource-ref` field, wired to the Task 3 thunk.
**Files:** `frontend/components/SchemaManager/SchemaManager.tsx`
**Done when:** When a field's type is `multi-resource-ref`, a folder dropdown (built from `state.resources.folders`) and an "Include Subfolders" checkbox appear; selecting a folder dispatches the ref-properties thunk; the checkbox is hidden until `refFolder` is set (FR 13); changes round-trip to disk via the existing API route; `pnpm typecheck` passes.
**Depends on:** Tasks 3, 8
**Estimate:** 3
**Notes:** Covers FR 13. No reusable `FolderPicker` exists yet — build a simple `<select>` populated from `selectFolders` rather than introducing a new shared component (out of scope). The "Include Subfolders" checkbox must use `disabled` + `checked` state derived from the current `MetadataField`.
**Done:** [x] Folder picker `<select>` and conditional "Include subfolders" checkbox added to `SchemaManager.tsx` for `multi-resource-ref` fields. Folder list from `state.resources.folders`. Selecting a folder dispatches `updateMetadataRefProperties`; clearing also clears `includeSubfolders`. Checkbox hidden when no `refFolder`. 7 tests in `schemaManager.test.tsx`. All 838 tests pass, `pnpm typecheck` clean.

---

### Task 10: SchemaManager — `maxSelections` number input

**What:** Add an optional number input in SchemaManager that sets `maxSelections` on a `multi-resource-ref` field, wired to the Task 3 thunk.
**Files:** `frontend/components/SchemaManager/SchemaManager.tsx`
**Done when:** A number input labeled "Max selections" appears for `multi-resource-ref` fields; entering a positive integer dispatches the thunk; clearing the input clears the property (unbounded); `pnpm typecheck` passes.
**Depends on:** Tasks 3, 8
**Estimate:** 1
**Notes:** Covers FR 15. Validate `min=1` on the input element; reject non-positive values inline. Reuse the existing rename/edit row styling in SchemaManager.
**Done:** [x] `<input type="number" min=1>` added inside the `isMultiRef` block. Dispatches `updateMetadataRefProperties({ maxSelections: value })` on blur for valid positive integers, `maxSelections: null` when cleared; value 0 or negative is silently ignored. Uses `defaultValue` + `key` to stay in sync after API roundtrips. 5 tests in `schemaManager.test.tsx`. All 843 tests pass, `pnpm typecheck` clean.

---

### Task 11: Storybook story for `MultiResourceRefInput`

**What:** Create a stories file covering empty state, chips present, autocomplete open, and a11y verification.
**Files:** `frontend/stories/Sidebar/MultiResourceRefInput.stories.tsx` (new — match existing `stories/` subdirectory convention)
**Done when:** Named stories `Empty`, `WithChips`, `AutocompleteOpen`, and `MaxSelectionsReached` render in Storybook without console errors; the `@storybook/addon-a11y` panel reports no violations; keyboard Tab reaches each chip's dismiss button and the text input; `pnpm storybook` builds.
**Depends on:** Tasks 4, 6
**Estimate:** 2
**Notes:** Covers FR 10. Use mock `resourceOptions` data inline. The `AutocompleteOpen` story can pre-set initial input text via a render wrapper to force suggestions to display.
**Done:** [x] Added `defaultInputValue?: string` prop to `MultiResourceRefInput` (initialises both `inputVal` state and `suggestions`). Stories: `Empty`, `WithChips`, `AutocompleteOpen` (uses `defaultInputValue="Al"`), `MaxSelectionsReached` (2 chips, `maxSelections: 2`), `Interactive`. Follow-up item in `follow-up-work.md` marked resolved.

---

## Summary

- **Total tasks:** 11
- **Total estimated effort:** 25 story points
- **Critical path:** Tasks 1 → 2 → 4 → 5 → 7 (14 pts) — the longest dependent chain runs through the input component, its folder-scope extension, and the sidebar wiring.
- **Risks:**
  - **Task 4** (8 pts) is the largest single unit — combines chip rendering, autocomplete, keyboard handling, and dispatch. Highest implementation uncertainty; consider splitting into 4a (core add/remove + click-to-navigate) and 4b (autocomplete + keyboard nav) if it slips beyond one focused session.
  - **Task 9** (folder picker) — no reusable folder-picker component exists. Inline `<select>` is acceptable for this scope but creates duplication if other features need folder pickers later.
  - **Task 3** (model + API + Redux) — three-layer change; partial-update semantics for the three properties must be decided and documented to avoid SchemaManager → sidebar inconsistencies.
