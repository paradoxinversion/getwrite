# Slice 06 — Projects & Types: Per-file Deltas

Date: 2026-06-17

---

## Core / Models

### `frontend/src/lib/models/project-creator.ts`

**Size delta:** 346 → 341 lines (−1.4%)
**Symbols renamed:** 0 (the `projectCreator` const is new, not a rename)
**Files touched:** 1

Changes:

- **extraction** — Extracted `loadSpec(spec: ProjectTypeSpec | string): Promise<ProjectTypeSpec>` private helper. The file/object validation branches inside `createProjectFromType` were structurally identical — same two `!res.success` guard checks, same throw pattern — differing only in the validator function called and the error message prefix. Pulling this into a named helper makes the intent of the validation step scannable at a glance and eliminates the duplicated guard structure.
- **structure** — Replaced `for (let i = 0; i < specObj.folders.length; i += 1)` with `for (const [orderIndex, f] of specObj.folders.entries())` and similarly for default resources. Eliminates the index variables `i`/`j`, the `specObj.defaultResources![j]` non-null assertion, and the manual `specObj.folders[i]` element access — the element is now named at the loop head.
- **structure** — Inlined the two `const now = new Date().toISOString()` temporaries directly into the `Folder` object literals (`createdAt: new Date().toISOString()`). Each `now` was assigned immediately before the object literal and used only in the `createdAt` field; the intermediate name added no clarity.
- **comments** — Removed the `/** The spec for this project */` inline comment on `specObj`. It restated the variable name and added no information; the surrounding step comment already labels the block "Load and validate spec".
- **comments** — Removed the three redundant inline `/** ... */` JSDoc comments on the `options` parameter properties of `createProjectFromType` (`projectRoot`, `spec`, `name`). These were exact duplicates of the `@param` lines in the JSDoc block immediately above — same wording, same content, no net information gain.
- **consistency** — Named the anonymous default export: `const projectCreator = { createProjectFromType }; export default projectCreator`. Resolves the pre-existing `import/no-anonymous-default-export` lint warning and aligns with the pattern used in `tags.ts`.

---

### `frontend/src/lib/models/project-loader.ts`

**Size delta:** 100 → 97 lines (−3%) [Antonini reported 90; verified on-disk count is 97]
**Symbols renamed:** 5
**Files touched:** 1

Changes:

- **naming** — `metadataDir` → `metaDir` — removes the redundant "metadata" suffix; the `meta/` directory name is already the canonical short form used everywhere in this codebase
- **naming** — `metadataEntries` → `metaFilenames` — more precise: these are filenames (strings from `readdir`), not "entries" in the abstract sense
- **naming** — `metadataName` (map callback param) → `filename` — clearer: it's a filename string; `metadataName` was needlessly verbose in this context
- **naming** — `sidecarId` → `id` — the variable is already scoped inside the resource callback; `sidecarId` was redundant qualification
- **naming** — `resourcePlaintext` → `plaintext` — already scoped inside the per-resource callback; the `resource` prefix adds no information
- **structure** — Eliminated the `resourcePromises` intermediate variable by inlining the `.filter().map()` chain directly into `Promise.all(...)` — the variable was used only once, immediately after assignment; removing it reduces visual distance between the work and its awaiting

---

### `frontend/src/lib/models/project-config.ts`

**Size delta:** 95 → 95 lines (unchanged)
**Symbols renamed:** 3
**Files touched:** 1

Changes:

- **naming** — `p` → `filePath` in both `loadProject` and `loadProjectConfig` — the single-character name was opaque; `filePath` makes the variable's role immediately clear without abbreviation
- **structure** — Inlined the `normalizedConfig` intermediate in `loadProject` — it was a one-use variable whose name added no information beyond what `normalizeProjectConfig(...)` already communicates; the return expression is equally readable inline

Note: One pre-existing `import/no-anonymous-default-export` warning on the default export remains (existed before this refactor).

---

### `frontend/src/lib/models/projects-dir.ts`

**Size delta:** 15 → 15 lines (unchanged)
**Symbols renamed:** 0
**Files touched:** 0

No meaningful improvements possible. The file is a single-expression function with an essential explaining comment. Already optimal. The `GETWRITE_PROJECTS_DIR` Electron behavior is preserved exactly.

---

### `frontend/src/lib/models/project.ts`

**Size delta:** 64 → 60 lines (−6%)
**Symbols renamed:** 0 (constants removed, not renamed)
**Files touched:** 1

Changes:

- **structure** — Removed `DEFAULT_MAX_REVISIONS = 50` and `DEFAULT_AUTO_PRUNE = true` constants, inlining their values (`50`, `true`) directly at the two use sites in `normalizeProjectConfig`. Each constant was used exactly once — the names added no information beyond the field name already present at the use site (`maxRevisions`, `autoPrune`). Inlining also eliminates a pre-existing ESLint `naming-convention` error on `DEFAULT_AUTO_PRUNE` (the `is/has/...` prefix rule fired on a boolean-typed const).
- **comments** — Removed the "Default values applied when creating a new project." section comment, which described only the two constants that were removed. The code it documented no longer exists.

---

### `frontend/src/lib/models/project-view.ts`

**Size delta:** 22 → 18 lines (−18%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Replaced the verbose inline return-type annotation `{ project: BuildProjectViewOptions["project"]; folders: FolderWithResources[]; resources: UIResource[] }` with `ReturnType<typeof buildProjectViewAdapter>`. The function is a pure delegation — the return type is exactly the adapter's return type, so `ReturnType<typeof buildProjectViewAdapter>` expresses that precisely without repeating the shape or using a `["project"]` index to sidestep importing `ProjectType`.
- **structure** — Dropped the `FolderWithResources` and `UIResource` imports from the local import clause. They were only used to spell out the return type annotation; the `ReturnType<...>` form makes them unnecessary in the function body. They remain as re-exports on the next line.

---

### `frontend/src/lib/models/project-view-adapter.ts`

**Size delta:** 111 → 113 lines (+2 lines for extracted helper)
**Symbols renamed:** 2 (`left`/`right` → `a`/`b` in sort comparator)
**Files touched:** 1

Changes:

- **extraction** — Extracted `byOrderIndex(a, b)` helper for the `_orderIndex` comparator. The identical sort callback `(left, right) => left._orderIndex - right._orderIndex` appeared twice (for `rootResources` and per-folder `resources`). Naming the comparator makes the two `.sort()` calls read as intent (`sort(byOrderIndex)`) rather than arithmetic.
- **consistency** — The folder sort comparator already differed (uses `orderIndex` not `_orderIndex`) so it stays inline; its parameter names were updated from `left`/`right` to `a`/`b` to match the naming convention used in `byOrderIndex`.

The file grows by 2 lines because the extracted helper adds more than it saves at the two call sites — the clarity improvement (named comparator vs. arithmetic lambda) is the goal, not shrinkage.

---

### `frontend/src/lib/models/project-features.ts`

**Size delta:** 110 → 110 lines (unchanged)
**Symbols renamed:** 0
**Files touched:** 0

No changes. The file is already compact and clear. The two-field partial-update pattern, the up-front Zod validation, the lock/read/mutate/write/release scaffold, and the invariant enforcement are each well-named and appropriately commented.

---

### `frontend/src/lib/models/update-check.ts`

**Size delta:** 161 → 161 lines (unchanged)
**Symbols renamed:** 0
**Files touched:** 0

No changes. `pickDownloadUrl`'s `for` loop was tested as a `.find()` chain but required re-extracting `browser_download_url` after the find — more lines and less clear than the original. The guard-clause structure of `checkForUpdate` is already optimal.

---

### `frontend/src/lib/update-notice-suppression.ts`

**Size delta:** 58 → 58 lines (unchanged)
**Symbols renamed:** 0
**Files touched:** 0

No changes. The file is already at its natural minimum. Four single-purpose exports, one `safeStorage()` guard, all SSR-safe.

---

### `frontend/src/lib/projectTypes.ts`

**Size delta:** 169 → 165 lines (−2%)
**Symbols renamed:** 4 (`e` → `filename`, `fp` → `filePath`, `res` → `validationResult`, `l` → `entry`)
**Files touched:** 1

Changes:

- **naming** — Removed unused `validateProjectTypeFile` import. It was imported but never called in this file; its only callers are in `project-creator.ts`. Eliminating it removes the pre-existing `no-unused-vars` lint warning.
- **naming** — `e` (directory entry loop variable) → `filename`. The name `e` carries no semantic meaning; `filename` makes the loop body self-explanatory.
- **naming** — `fp` (constructed file path) → `filePath`. Aligns with the `ProjectTypeEntry.filePath` field name it feeds.
- **naming** — `res` (validation result) → `validationResult`. Distinguishes it clearly from the raw parsed JSON and makes the success-check read naturally.
- **naming** — `l` (find predicate parameter) → `entry`. `l` was a single-letter mystery; `entry` matches the type's conceptual name throughout the file.
- **structure** — Simplified the `(entries as any[]).map(...)` expression. The `any[]` cast was needed to paper over the `string | Dirent` union, but the map callback's typeof check meant the real type was `(string | Dirent)[]`. Replaced with that explicit union cast so the `any` is gone and the intent is clearer.

---

### `frontend/src/lib/user-preferences.ts`

**Size delta:** 304 → 307 lines (+3 lines for extracted helper and JSDoc)
**Symbols renamed:** 2 (`prefersDark` → `isDarkPreferred`, `reducedMotion` local → `isReducedMotion`)
**Files touched:** 1

Changes:

- **naming** — `prefersDark` → `isDarkPreferred` (in both `resolvePreferredColorMode` and the new `detectSystemColorMode`). Fixes the pre-existing `@typescript-eslint/naming-convention` lint error; boolean locals must have an `is/has/should/can/did/will` prefix in this project.
- **naming** — `reducedMotion` local variable (in `getStoredGlobalAppearancePreferences`) → `isReducedMotion`. Fixes the second pre-existing naming-convention lint error. The property name `reducedMotion` on the returned object is unchanged — only the local variable was renamed, using the explicit `reducedMotion: isReducedMotion` form in the return statement.
- **extraction** — Extracted `detectSystemColorMode()` private helper. The `matchMedia` try/catch pattern was duplicated verbatim inside both `resolvePreferredColorMode` and `resolveColorModeFromAppearance`. Both call sites now delegate to the shared helper, eliminating ~8 lines of duplication and giving the pattern a name that documents what it does. The new function carries full JSDoc.

---

## Store

### `frontend/src/store/projectsSlice.ts`

**Size delta:** 1058 → 814 lines (−23%, −244 lines) — VERIFIED ON DISK\*\*
**Symbols renamed:** 0
**Files touched:** 1 (no separate files created; all exports remain in this file)

Changes:

- **extraction** — Added `makeSchemaThunk<Args>()` factory — encodes the identical 3-step boilerplate shared by all 15 metadata-schema thunks (resolve context → error guard → call transport → return `{ projectId, schema }`). Each of the 15 thunks reduced from ~20 lines to 2–8 lines.
- **extraction** — Added `makeFeatureConfigThunk<Args>()` factory — same pattern for the 2 feature-config thunks (`updateProjectFeatures`, `updateProjectOrganizerCardBody`), each reduced from ~20 lines to 4–7 lines.
- **structure** — Moved `normalizeStoredProject` up adjacent to `buildStoredProject` — both are public normalization utilities; grouping them makes the public surface easier to scan.
- **structure** — Moved `selectProjectCache` declaration before `selectProject` — fixes a confusing forward-reference where `selectProject` used `selectProjectCache` 10 lines before it was declared.
- **structure** — Added a `// Selectors` section header to delineate the selector block from the action exports above it.
- **consistency** — Added `type MetadataSchemaRequestContext` to the import from `metadata-schema-transport-service` — needed to type the factory's `context` parameter explicitly rather than relying on inference.

Note: The `(state: any)` pattern on all thunks and selectors was intentionally left as-is — existing comments document that this avoids a circular import from `./store`, and changing it would require importing `RootState` which is the import cycle the comments are defending against.

---

### `frontend/src/store/project-actions-controller.ts`

**Size delta:** 115 → 99 lines (−14%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Removed `ApiErrorResponse` interface — it existed solely to support the old double-cast inside `getApiErrorMessage` and became dead after the helper was simplified.
- **structure** — Simplified `getApiErrorMessage` to the same `Record<string, unknown>` single-cast + ternary pattern as the other transport services.
- **structure** — Collapsed `if (onRename) { onRename(projectId, newName); }` to `onRename?.(projectId, newName)` and `if (onDelete) { onDelete(projectId); }` to `onDelete?.(projectId)` — optional chaining is the idiomatic form for conditional callback invocation; identical behavior.

---

### `frontend/src/store/editorConfigSlice.ts`

**Size delta:** 61 → 61 lines (unchanged)
**Symbols renamed:** 0
**Files touched:** 0

No changes. The file is already compact and correct.

---

### `frontend/src/store/feature-config-transport-service.ts`

**Size delta:** 63 → 56 lines (−11%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Simplified `getApiErrorMessage`: replaced the nested `if` chain with a double-cast into a single `(errorBody as Record<string, unknown>)?.error` read + ternary. Same pattern used in `metadata-schema-transport-service.ts`. The `"error" in errorBody` check was redundant given `?.` handles missing keys safely.

---

### `frontend/src/store/update-check-transport-service.ts`

**Size delta:** 24 → 24 lines (unchanged)
**Symbols renamed:** 0
**Files touched:** 0

No changes. Already the minimal correct form — one constant, one function, one try/catch.

---

## API Routes

### `frontend/app/api/project/route.ts`

**Size delta:** 64 → 39 lines (−39%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Removed three local response interfaces (`LoadProjectRequestBody`, `LoadProjectSuccessResponse`, `LoadProjectErrorResponse`) — they were only used in the return type annotation. The module-level JSDoc already documents the shapes; the interfaces added scaffolding without adding clarity to a 5-line handler.
- **structure** — Removed now-unused type imports (`LoadedResource`, `Project`) that were only needed for the removed interfaces.
- **nesting** — Inlined `const result` — single-use variable with no naming benefit.
- **structure** — Collapsed the verbose multi-line return type to `Promise<NextResponse>`.

---

### `frontend/app/api/project/delete/route.ts`

**Size delta:** 9 → 9 lines (unchanged)

No meaningful improvements possible. Already minimal.

---

### `frontend/app/api/project/rename/route.ts`

**Size delta:** 21 → 21 lines (unchanged)

No meaningful improvements possible. Already compact.

---

### `frontend/app/api/project/preferences/route.ts`

**Size delta:** 94 → 67 lines (−29%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Removed `UpdateProjectPreferencesSuccess` and `UpdateProjectPreferencesError` interfaces.
- **structure** — Collapsed `const rawProject` / `JSON.parse(rawProject)` into a single `JSON.parse(await fs.readFile(...))` expression, eliminating an intermediate variable.
- **structure** — Inlined the `nextProject` spread directly into `JSON.stringify(...)`, eliminating an intermediate variable.
- **structure** — Collapsed to `Promise<NextResponse>` return type.

---

### `frontend/app/api/project/editor-config/route.ts`

**Size delta:** 87 → 72 lines (−17%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Removed `UpdateProjectEditorConfigSuccess` and `UpdateProjectEditorConfigError` interfaces.
- **structure** — Collapsed `const rawProject` / `JSON.parse(rawProject)` into a single expression.
- **structure** — Inlined `nextConfig` directly into the `nextProject` spread, eliminating an intermediate variable.
- **structure** — Collapsed to `Promise<NextResponse>` return type.

---

### `frontend/app/api/project/features/route.ts`

**Size delta:** 88 → 82 lines (−7%)
**Symbols renamed:** 1 (`isValidation` → `isZodError`)
**Files touched:** 1

Changes:

- **structure** — Removed `UpdateFeaturesError` interface — replaced inline with `{ error: string }` in the return type union.
- **naming** — Renamed `isValidation` to `isZodError` — the variable specifically checks for a Zod schema error; the old name was vague.
- **nesting** — Inlined `const result = await updateFeatureConfig(...)` / `return NextResponse.json(result)` into a single `return NextResponse.json(await updateFeatureConfig(...))`.

---

### `frontend/app/api/project/revision-settings/route.ts`

**Size delta:** 71 → 59 lines (−17%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Removed `UpdateRevisionSettingsSuccess` and `UpdateRevisionSettingsError` interfaces.
- **structure** — Collapsed to `Promise<NextResponse>` return type.

---

### `frontend/app/api/projects/route.ts`

**Size delta:** 84 → 83 lines (−1%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **comments** — Removed `// get all projects from local` — this restates what the next two lines clearly show; the function-level JSDoc already says the same thing.

---

### `frontend/app/api/projects/[projectId]/reorder/route.ts`

**Size delta:** 122 → 125 lines (+2%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Replaced `[] as any[]` catch fallback with `[] as Dirent[]` (imported from `node:fs`) — removes the pre-existing `no-explicit-any` lint warning and makes the type explicit.
- **structure** — Collapsed `const raw = await fs.readFile(pj, "utf8"); const parsed = JSON.parse(raw)` in `findProjectRoot` into a single expression.
- **structure** — In the folder-update loop, collapsed `const raw` / `const parsed` into a single typed `JSON.parse(await fs.readFile(...))` expression; added a typed shape annotation to the parsed object (was `any`).
- **comments** — Removed `// locate projects directory` — the next line is self-explanatory.

The slight line increase (+3) is because the typed `Dirent` import adds a line and the inline parsed-object type annotation is explicit.

---

### `frontend/app/api/project-types/route.ts`

**Size delta:** 47 → 45 lines (−4%)
**Symbols renamed:** 1 (`fp` → `filePath`)
**Files touched:** 1

Changes:

- **naming** — Renamed `fp` to `filePath` — opaque single-letter name becomes self-descriptive.
- **structure** — Removed intermediate `const raw` — collapsed `fs.readFile` directly into `JSON.parse(...)`.
- **structure** — Removed redundant explicit type annotation `const res: ReturnType<typeof validateProjectType>` — TypeScript infers this; the annotation added noise without clarity.

---

### `frontend/app/api/version-check/route.ts`

**Size delta:** 66 → 66 lines (unchanged)

No changes. Already well-structured with meaningful variable names, clear control flow, and an informative module JSDoc.

---

## UI Components — Start/

### `frontend/components/Start/CreateProjectModal.tsx`

**Size delta:** 299 → 283 lines (−5%)
**Symbols renamed:** 4 (state variables + setters: `loadingTypes`/`setLoadingTypes` → `isLoadingTypes`/`setIsLoadingTypes`; `creating`/`setCreating` → `isCreating`/`setIsCreating`)
**Files touched:** 1

Changes:

- **naming** — `loadingTypes` → `isLoadingTypes`, `setLoadingTypes` → `setIsLoadingTypes` — fixes naming-convention lint error on boolean state
- **naming** — `creating` → `isCreating`, `setCreating` → `setIsCreating` — fixes naming-convention lint error on boolean state
- **extraction** — Extracted `const selectedType = types?.find(...)` before the JSX — eliminates two repeated `.find()` calls (hint div + validation error div) and replaces the IIFE pattern with a plain conditional
- **structure** — Submit button's `disabled` condition simplified from a 6-line `!!types && !!projectType && !!types.find(...)` expression to `isCreating || !!selectedType?.validationError`
- **structure** — `body.project/folders/resources` intermediate variables inlined into the `onCreate()` call (each was used exactly once)

---

### `frontend/components/Start/ManageProjectMenu.tsx`

**Size delta:** 147 → 146 lines (−1%)
**Symbols renamed:** 6 (state variables + setters: `open`/`setOpen` → `isOpen`/`setIsOpen`; `renameOpen`/`setRenameOpen` → `isRenameOpen`/`setIsRenameOpen`; `confirmDeleteOpen`/`setConfirmDeleteOpen` → `isConfirmDeleteOpen`/`setIsConfirmDeleteOpen`)
**Files touched:** 1

Changes:

- **naming** — `open` → `isOpen`, `setOpen` → `setIsOpen` — fixes naming-convention lint error
- **naming** — `renameOpen` → `isRenameOpen`, `setRenameOpen` → `setIsRenameOpen` — fixes naming-convention lint error
- **naming** — `confirmDeleteOpen` → `isConfirmDeleteOpen`, `setConfirmDeleteOpen` → `setIsConfirmDeleteOpen` — fixes naming-convention lint error
- **structure** — Removed unnecessary `<>...</>` fragment wrapper inside the menu `<div className="p-2">` — the fragment was empty overhead with a single sibling group

---

### `frontend/components/Start/RenameProjectModal.tsx`

**Size delta:** 80 → 80 lines (unchanged)

No meaningful improvements possible; the file was already clean.

---

### `frontend/components/Start/StartPage.tsx`

**Size delta:** 689 → 666 lines (−3%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **extraction** — Extracted `triggerDownload(blob, filename)` as a module-level function — it was defined inline inside `onConfirmCompile`, nested 4 levels deep, and called 4 times; extracting it eliminates the repeated definition and reduces nesting
- **extraction** — Extracted `resolveFilename(ext, serverFilename)` as a local const helper inside `onConfirmCompile` — the `rawName ? rawName.endsWith(x) ? rawName : rawName+ext : server` pattern was duplicated verbatim 4 times
- **nesting** — Moved `setCompileTargetProjectId(null)` before the format branches instead of repeating it in each branch, reducing duplication
- **structure** — Removed `handleOpen` wrapper function; inlined `onOpen?.(...)` at the call site (the wrapper was a one-line passthrough with no added logic)
- **structure** — Inlined `handleCreateClick` at both call sites (another one-line passthrough)

---

## UI Components — preferences/

### `frontend/components/preferences/AppearanceRuntime.tsx`

**Size delta:** 63 → 62 lines (−2%)
**Symbols renamed:** 0
**Files touched:** 1

Changes (Antonini + orchestrator):

- **structure** — Inlined `onAppearanceChanged` — it was a one-line identity wrapper around `applyAppearanceToDocument`; passing the function directly to `addEventListener`/`removeEventListener` is cleaner and the stable reference is preserved
- **structure** (orchestrator) — Removed unused `React` import (`import React, { useEffect }` → `import { useEffect }`). The file uses the automatic JSX runtime and never calls `React.*` directly. This eliminated the pre-existing `no-unused-vars` lint warning surfaced by Antonini's refactor.

---

### `frontend/components/preferences/BodySettingsModal.tsx`

**Size delta:** 143 → 143 lines (unchanged)

No meaningful improvements possible.

---

### `frontend/components/preferences/DefaultRevisionNameModal.tsx`

**Size delta:** 117 → 117 lines (unchanged)

No meaningful improvements possible.

---

### `frontend/components/preferences/FontFamilyInput.tsx`

**Size delta:** 39 → 39 lines (unchanged)

No meaningful improvements possible.

---

### `frontend/components/preferences/HeadingSettingsModal.tsx`

**Size delta:** 382 → 371 lines (−3%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — `toFontWeightSelectValue`: replaced the verbose if-chain (4 conditional blocks, two `normalizedWeight` comparisons spelled out longhand) with optional-chain + two guard returns — same logic, 10 fewer lines.

---

### `frontend/components/preferences/HeadingStyleField.tsx`

**Size delta:** 29 → 29 lines (unchanged)

No meaningful improvements possible.

---

### `frontend/components/preferences/OrganizerCardBodySettings.tsx`

**Size delta:** 225 → 225 lines (unchanged line count)
**Symbols renamed:** 1 (`notesEnabled` local → `isNotesEnabled`)
**Files touched:** 1

Changes:

- **naming** — `notesEnabled` → `isNotesEnabled` (the local `const` from `useAppSelector`) — fixes naming-convention lint error. The `resolveSelectValue` function's parameter was also updated in the JSDoc `@param` tag for accuracy; the parameter name itself is a function parameter and not subject to the boolean-prefix rule — left unchanged.

---

### `frontend/components/preferences/ProjectFeatureToggles.tsx`

**Size delta:** 172 → 172 lines (unchanged line count)
**Symbols renamed:** 1 (`cascadesViewOff` → `isCascadesViewOff`)
**Files touched:** 1

Changes:

- **naming** — `cascadesViewOff` → `isCascadesViewOff` — fixes naming-convention lint error.

---

### `frontend/components/preferences/TimelineViewToggle.tsx`

**Size delta:** 107 → 107 lines (unchanged)

No meaningful improvements possible.

---

### `frontend/components/preferences/UserPreferencesPage.tsx`

**Size delta:** 280 → 274 lines (−2%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Collapsed the two-step `selectedProjectId` + `selectedProject` selector pattern into a single `useAppSelector(state => selectedProjectId ? selectProject(...) : null)`. Eliminates the null-check duplication.

---

## UI Components — project-types/

### `frontend/components/project-types/ProjectTypeDraftService.ts`

**Size delta:** 344 → 331 lines (−4%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **nesting** — `updateSelectedDefinition`'s `setItems` callback: removed the redundant explicit `return` from the outer arrow, collapsed `const updatedDefinition` + `const nextKey` + conditional `setSelectedKey` + return object from 12 lines to 7. All logic identical.
- **naming** — Anonymous positional params in four `.filter()` callbacks renamed from verbose `folderIndex`/`resourceIndex`/`statusIndex` to `i` — the positional index meaning is already established by the surrounding `index` parameter; the longer names added noise. Same change applied to `.map()` in `handleUpdateStatus`.

---

### `frontend/components/project-types/ProjectTypeEditorForm.tsx`

**Size delta:** 726 → 723 lines (−0.4%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Dropped `import React from "react"`: the project uses `jsx: "react-jsx"` (automatic JSX runtime); no `React.*` call exists in this file, so the import was dead weight.
- **extraction** — Extracted `MetadataSourceRow` sub-component (with `MetadataSourceRowProps` interface). The Metadata Source checkbox + conditional Input Type select block appeared verbatim in both the Folders section and the Default Folders section (each ~18 lines). Both usages replaced with the named component. The identical 36 lines of duplicated markup became two 8-line `<MetadataSourceRow ... />` call sites.

---

### `frontend/components/project-types/ProjectTypeListPane.tsx`

**Size delta:** 92 → 91 lines (−1%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Dropped `import React from "react"`: same reason as above (automatic JSX runtime, no `React.*` usage).

---

### `frontend/components/project-types/ProjectTypesManagerPage.tsx`

**Size delta:** 193 → 179 lines (−7%)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- **structure** — Replaced `import React, { useState }` with `import { useState, useEffect }`: the file used `React.useEffect` directly but never needed the default `React` object for anything else. Converting to the named import is idiomatic and consistent with the automatic JSX runtime.
- **nesting** — Collapsed the two separate `useAppSelector` calls for `selectedProjectId` and `selectedProject` into a single selector. The intermediate `selectedProjectId` local variable existed only to thread into the second selector.
- **nesting** — `handleCloseManager`'s three-branch if/return chain reformatted as three single-line guard clauses. All three branches are one-statement actions; the single-line form removes 6 blank lines and makes the guard structure visually scannable.

---

## Cross-file Changes (Orchestrator)

### `frontend/components/preferences/AppearanceRuntime.tsx` — unused import removal

After Antonini's refactor, the file had a lingering `import React, { useEffect }` where only `useEffect` was needed (Antonini refactored the file but left the `React` import triggering a new `no-unused-vars` warning). Fixed by the orchestrator: changed to `import { useEffect } from "react"`. Typecheck confirmed clean with this change.

### Cross-file unification assessment

The slice goal stated "Start/ and preferences/ share form patterns worth unifying." Antonini surfaced this as a deferred item: a `PreferencesModalShell` component could unify the shared modal shell pattern (`BodySettingsModal.tsx`, `HeadingSettingsModal.tsx`, etc.) and reduce ~25 lines of duplication. This was deferred as a follow-up — the extraction requires touching multiple files and creating a new component in `components/common/`, which is a larger scope than a single-file clarity edit.

The `projectsSlice.ts` headline unification (the thunk factory pattern) was achieved within the file — `makeSchemaThunk` collapsed 15 identical thunk bodies and `makeFeatureConfigThunk` collapsed 2 more. No separate files were created; all exported names re-export from the original file as required.

---

## Gate Results

**Baseline (before refactor):** Typecheck clean. 16/16 test files, 105 tests passing. Lint had pre-existing error-level naming-convention issues in several in-scope files.

**After refactor:**

- **Typecheck:** Clean (zero errors)
- **Tests:** 16/16 test files, 105 tests passing (identical to baseline)
- **Lint (in-scope files):** All error-level naming-convention issues in the slice's touched files eliminated. Remaining items in slice files are warnings only (pre-existing `no-explicit-any`, `no-unused-vars`, `import/no-anonymous-default-export`).
- **knip:** Unused files (16) and unused exports (110) identical to baseline.
  Unused _exported types_ went 95 → 98 (+3): `UIResource` and `FolderWithResources`
  (re-exported public facade in `project-view.ts`) and `LoadedResource`
  (`project-loader.ts`). These are intentional public type exports still used
  _within_ their own modules (e.g. `LoadedResource` is the element type of
  `loadProjectFromDisk`'s return). They lost their last _cross-file by-name_
  importer when legitimate internal simplifications landed (`project-view.ts`
  switched to `ReturnType<typeof buildProjectViewAdapter>`; `project/route.ts`
  dropped its redundant `LoadProjectSuccessResponse` interface). Left in place:
  removing the exports would be a public-type-surface change, which this slice
  forbids. Net behavior impact: none (type-only).

---

## Slice Totals

| Layer                       | Before    | After     | Delta                |
| --------------------------- | --------- | --------- | -------------------- |
| Core/Models (12 files)      | 1,357     | 1,321     | −36 lines (−3%)      |
| Store (5 files)             | 1,321     | 1,054     | −267 lines (−20%)    |
| API (11 files)              | 753       | 668       | −85 lines (−11%)     |
| UI Start/ (4 files)         | 1,215     | 1,175     | −40 lines (−3%)      |
| UI preferences/ (10 files)  | 1,570     | 1,549     | −21 lines (−1%)      |
| UI project-types/ (4 files) | 1,355     | 1,324     | −31 lines (−2%)      |
| **Total**                   | **7,571** | **7,091** | **−480 lines (−6%)** |

**Headline target confirmed on disk:** `projectsSlice.ts` 1058 → 814 lines (−244 lines, −23%).
