# Slice 03 — Revisions: Per-file deltas

Date: 2026-06-17  
Branch: `refactor/brevity-and-clarity`  
Gate: typecheck clean · lint 0 new errors · 69/69 tests pass · knip unchanged from baseline

---

## Core files

### `frontend/src/lib/models/revision.ts`

**Size delta:** 378 → 376 lines (0.5% smaller)  
**Symbols renamed:** 0  
**Files touched:** 1

Changes:

- Removed no-op `try { ... } catch (err) { throw err; }` wrapper around the stat check in `writeRevision` — re-threw unconditionally so added two levels of nesting with no semantic value.
- Inlined `filename` local constant and `finalFilePath`/`tmpFilePath` intermediates; each was used once.
- Merged two-step `.filter(...isDirectory).filter(...startsWith("v-"))` in `listRevisions` into one `.filter()` predicate.
- Simplified double-cast `(err as unknown as { code?: string })` to `(err as { code?: string })` in ENOENT check.
- Replaced `(r as any).metadata?.preserve` with `(r.metadata as Record<string, unknown> | undefined)?.preserve` — eliminates `no-explicit-any` lint warning; uses the correct type.
- Changed `catch (_) { // ignore cleanup errors }` to `catch { // ignore cleanup errors }` — eliminates unused-variable lint warning.
- Changed unused catch variable `err` in inner loop to empty `catch { continue; }`.
- Assigned the default export to named `const revisionApi = { ... }` before export — fixes `import/no-anonymous-default-export` lint warning.

---

### `frontend/src/lib/models/revision-manager.ts`

**Size delta:** 88 → 80 lines (9% smaller)  
**Symbols renamed:** 0  
**Files touched:** 1

Changes:

- Removed unused imports `fs` (node:fs/promises) and `path` (node:path).
- Removed unused named imports `revisionsBaseDir` and `getCanonicalRevision` from `./revision`.
- Removed unused import `readSidecar` from `./sidecar` (entire import line gone).
- Removed unused type import `TextResource` from `./types` (entire import line gone).
- Changed `catch (err) { // ignore queueing errors }` to `catch {}` — variable was unused.
- Extracted named `const revisionManager = { ... }` before export default — fixes `import/no-anonymous-default-export` lint warning.

---

### `frontend/src/lib/models/revision-settings.ts`

**Size delta:** 48 → 48 lines (net zero — one removed, one added)  
**Symbols renamed:** 1 (`nextProject` → `updated`)  
**Files touched:** 1

Changes:

- Renamed `nextProject` → `updated` — the old name restated the type; `updated` expresses what was done.
- Inlined `fs.readFile` directly into `JSON.parse(...)`, eliminating the single-use `raw` intermediate.

---

### `frontend/src/lib/models/pruneExecutor.ts`

**Size delta:** 59 → 59 lines (unchanged)  
**Symbols renamed:** 3 (`e` inlined, `res` → `pruneResults`, `k`/`v` → `resourceId`/`deletedCount`)  
**Files touched:** 1

Changes:

- Eliminated `e` intermediate in `listResourceIds` catch block — inline cast `(err as NodeJS.ErrnoException).code` reads more directly.
- Renamed `res` → `pruneResults` in `runCli` — too generic for a results map.
- Renamed `k`/`v` → `resourceId`/`deletedCount` in `Object.entries` destructure — matches domain vocabulary; log line now self-documenting.

---

### `frontend/src/lib/models/resource-revision.ts`

**Size delta:** 0 lines changed (already optimal at 24 lines)  
**Symbols renamed:** 0  
**Files touched:** 0

No actionable improvements within the refactor mandate.

---

## Store files

### `frontend/src/store/revision-canonical-guards.ts`

**Size delta:** 0 lines changed (already optimal at 35 lines)  
**Symbols renamed:** 0  
**Files touched:** 0

Already at quality ceiling. The module-level comment names the invariant; both functions are irreducibly minimal.

---

### `frontend/src/store/revision-normalization.ts`

**Size delta:** 135 → 131 lines (3% smaller)  
**Symbols renamed:** 0  
**Files touched:** 1

Changes:

- Extracted private `trimIfNonEmpty(value: unknown): string | undefined` helper — the two parallel `typeof x === "string" && x.trim().length > 0` / `return x.trim()` blocks in `resolveRevisionDisplayName` were structurally identical.
- Replaced the two `if`-block guards in `resolveRevisionDisplayName` with a single `??` chain: `trimIfNonEmpty(metadataName) ?? trimIfNonEmpty(fallbackName) ?? \`Revision v${...}\`` — priority order now explicit at a glance.
- Eliminated intermediate `metadataName` local and its manual object-guard; replaced with `revision.metadata?.["name"]` — `metadata` is `Record<string, unknown> | undefined` so the `typeof === "object"` check was redundant.

---

### `frontend/src/store/revision-transport-service.ts`

**Size delta:** 177 → 154 lines (13% smaller)  
**Symbols renamed:** 0  
**Files touched:** 1

Changes:

- Extracted `throwApiError(response, fallback)` async helper — the identical `if (!response.ok) { const errorBody = await response.json().catch(() => ({})); throw new Error(...) }` block appeared 5 times; each now collapses to a one-liner. Removes ~15 lines of duplication.
- Simplified `getApiErrorMessage` from 9 lines (two-step type-guard with double cast) to 3 lines using a single `Record<string, unknown>` cast with optional chain. Same behavioral contract preserved.
- Removed `params.toString()` in `fetchRevisionContent` — template literals coerce `URLSearchParams` to string automatically; the explicit call was redundant.

---

### `frontend/src/store/revisionsSlice.ts`

**Size delta:** 646 → 562 lines (13% smaller) — PRIMARY BREVITY TARGET  
**Symbols renamed:** 0  
**Files touched:** 1

Changes:

- Extracted `makeRevisionThunk<Args, Result>(typePrefix, transportFn, errorFallback)` factory — all five thunks shared an identical skeleton (resolve context → error guard → transport call → catch with fallback). Each thunk is now a ~5-line factory call with an inline transport lambda.
- Imported `RevisionRequestContext` from `revision-transport-service` to type the factory's `transportFn` parameter (was already exported; only the import was missing).
- Unified `DeleteRevisionPayload`/`FetchRevisionContentPayload` (both `{ resourceId, revisionId }`) into `ResourceAndRevisionPayload`. Unified `SetCanonicalRevisionResult`/`DeleteRevisionResult` (structurally identical) into `ResourceAndRevisionResult` type alias.
- Simplified `resetRevisionState` from 10 explicit field assignments to `Object.assign(state, initialState)` — Immer handles Proxy wrapping correctly.
- Removed JSDoc blocks from the nine internal (non-exported) payload/result interfaces — self-describing by name and field. All JSDoc on exported symbols untouched.
- Inlined `getErrorMessage` helper into the factory's catch block (its only call site post-consolidation).
- Added section header comments (`// Internal payload / result types`, `// Slice state`, `// Thunk factory`, `// Async thunks`, `// Slice`, `// Selectors`) for navigation.

---

## API route

### `frontend/app/api/resource/revision/[resource-id]/route.ts`

**Size delta:** 604 → 433 lines (28% smaller) — PRIMARY BREVITY TARGET  
**Symbols renamed:** 0  
**Files touched:** 1

Changes:

- Extracted `parseJsonBody<T>(req)` — consolidates the `try { body = await req.json() } catch { return 400 }` block duplicated verbatim in POST, DELETE, and PATCH.
- Extracted `requireString(value, fieldName)` — consolidates the `if (!field || typeof field !== "string") return 400` guard that appeared once in POST and twice each in DELETE and PATCH.
- Extracted `errorResponse(error, fallback, status?)` — consolidates near-identical catch-block patterns across all four handlers.
- Added `// Shared helpers`, `// Private route helpers`, and `// Route handlers` section dividers.

---

## UI components

### `frontend/components/Editor/RevisionControl/RevisionControl.tsx`

**Size delta:** 398 → 387 lines (2.8% smaller)  
**Symbols renamed:** 0  
**Files touched:** 1  
**Rendering changes:** None — class names, text content, accessibility attributes, and HTML structure unchanged.

Changes:

- Extracted `promoteRevisionAndFetch(revisionId, successPrefix, errorMsg)` — `handleSetCanonical` and `handleRollbackRevision` were byte-for-byte identical except for toast strings; both are now one-expression wrappers.
- `resolveRevisionName` body collapsed to single-expression arrow — eliminated intermediate `match` variable.
- `canInteract` `useMemo` body collapsed from explicit `return` block to single-expression form.
- `handleViewRevision` state updater simplified from early-return-if-not-collapsed conditional to a ternary.
- `!revisionName.trim().length` → `!revisionName.trim()` in Save button's `disabled` prop — now matches the identical guard in `handleSaveRevision`.

---

### `frontend/components/WorkArea/DiffView.tsx`

**Size delta:** 201 → 219 lines (+9% — intentional clarity growth)  
**Symbols renamed:** 0  
**Files touched:** 1  
**Rendering changes:** None.

Changes:

- Lifted `renderLeftPane`, `renderRightPane`, `renderRevisionsList` from inline component arrow functions to named module-level functions with explicit prop parameters — component body is now a scannable ~25-line return statement. Growth is parameter signatures; bodies unchanged.
- `onSelectRevision && onSelectRevision(r.id)` → `onSelectRevision?.(r.id)`.
- `className={\`${className}\`}`→`className={className}` — redundant template literal removed.

---

### `frontend/components/WorkArea/DiffViewController.tsx`

**Size delta:** 251 → 251 lines (unchanged)  
**Symbols renamed:** 2 (local only: `project` → `projectRootPath`, `selectedResource` → `selectedResourceId`)  
**Files touched:** 1  
**Rendering changes:** None.

Changes:

- Narrowed `project` selector to select `project?.rootPath` directly, renamed `projectRootPath` — eliminates `shallowEqual` on a scalar.
- Narrowed `selectedResource` selector to select `selectedResource?.id` directly, renamed `selectedResourceId` — same rationale.

---

## Cross-file unification

The slice doc goal "clarify normalization and the canonical-guard logic without altering the invariant" was achieved through:

1. All canonical-state writes in `revisionsSlice.ts` remain channeled exclusively through `applyCanonicalRevision` from `revision-canonical-guards.ts` — no direct `isCanonical = true` assignments anywhere in the store.
2. `isStaleCanonicalUpdate` remains the sole staleness gate for canonical updates — unchanged.
3. The `makeRevisionThunk` factory does not bypass the context-resolve/error-guard pattern; it wraps it, making the pattern visible rather than hiding it across five copies.

---

## Gate result

| Check                                  | Result                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm typecheck`                       | Clean (no errors)                                                                          |
| `pnpm lint` (slice files)              | 0 errors, 0 warnings (12 pre-existing warnings fixed)                                      |
| `pnpm lint` (repo-wide)                | 39 errors — all pre-existing in test files outside slice scope; baseline count unchanged   |
| `pnpm exec vitest run <slice filters>` | 69/69 tests pass (baseline: 69/69)                                                         |
| `pnpm knip`                            | All revision-related knip hits are pre-existing baseline; no new unused exports introduced |

---

## Signature stability

All exported functions, types, interfaces, and React component default exports are identical before and after. Internal changes only:

- `makeRevisionThunk` added to `revisionsSlice.ts` as an unexported internal factory.
- `throwApiError` added to `revision-transport-service.ts` as an unexported internal helper.
- `trimIfNonEmpty` added to `revision-normalization.ts` as an unexported internal helper.
- `ResourceAndRevisionPayload` / `ResourceAndRevisionResult` replace the structurally-identical `DeleteRevisionPayload` / `FetchRevisionContentPayload` / `SetCanonicalRevisionResult` / `DeleteRevisionResult` — all internal, none exported.

---

## Deferred / escalated

None. All files in scope were addressed. `resource-revision.ts` and `revision-canonical-guards.ts` were inspected and found already optimal — no changes needed.
