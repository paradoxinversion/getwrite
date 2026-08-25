# Slice 07 — Index & Search: Per-File Deltas

Date: 2026-06-17  
Branch: `refactor/brevity-and-clarity`

Baseline: 11 test files, 139 tests — all passing. Typecheck clean. Lint had 453 problems
(93 errors, 360 warnings) repo-wide; none in the core/store/api files of this slice. Two
lint errors and two lint warnings were pre-existing in the UI files (SearchBar.tsx,
ResourceCommandPalette.tsx) — all fixed by this slice.

---

## Per-file deltas (Antonini reports, verbatim)

### `frontend/src/lib/models/indexer-queue.ts`

**Size delta:** 240 lines → 229 lines (Antonini pass); then +4 lines for cross-file
boolean-rename pass (orchestrator) → final 228 lines. Net: 240 → 228 (5% smaller).

**Symbols renamed:** `t` → `task` (Antonini); `running` → `isRunning`, `stopped` →
`isStopped`, `shutdownHooksInstalled` → `isShutdownHooksInstalled` (orchestrator
cross-file fix). All private module variables; no propagation.

**Files touched:** 1

**Changes (Antonini):**

- Renamed `t: Task` → `task: Task` in `runTask` and `processQueue`. `t` was too terse;
  `task` aligns with the `Task` type name and makes access chains self-documenting.
- Collapsed the convoluted `loadResourceContent` fallback block. The original used a
  tautological guard `(loaded.tiptap as any) && loaded.tiptap`, wrapped a synchronous
  call in `Promise.resolve(await ...)`, and dynamically re-imported `tiptapToPlainText`
  from a module already statically imported. Replaced with a straightforward ternary.
  **Verification correction:** Antonini's version used `??`, but the original guard was
  falsy (`if (!plain && loaded.tiptap)`), so an empty-string `plainText` must fall
  through to tiptap-derived text. Restored that behavior with `||`:
  `loaded.plainText || (loaded.tiptap ? tiptapToPlainText(loaded.tiptap) : undefined)`.
- Removed redundant `revs.length > 0` guard in the revision fallback block. Optional
  chaining `last?.filePath` makes the check implicit and eliminates one nesting level.
- Replaced `(side && (side as any).name) || t.resourceId` with
  `(side?.["name"] as string | undefined) ?? task.resourceId`. Uses optional chaining
  and nullish coalescing — avoids falsy coercion, drops the `as any` cast.
- Replaced `(side && (side as any).slug) || undefined` with
  `side?.["slug"] as string | undefined`. The `|| undefined` was redundant.

**Changes (orchestrator — cross-file baseline fix):**

- Renamed `running` → `isRunning`, `stopped` → `isStopped`,
  `shutdownHooksInstalled` → `isShutdownHooksInstalled`. Required by the ESLint
  naming-convention rule (boolean variables must carry an `is/has/should/...` prefix).
  These were 3 pre-existing lint errors on the file; all cleared.
- Removed stale `// eslint-disable-next-line no-await-in-loop` directive. The
  `no-await-in-loop` rule is not active in this project's config; the directive was
  a no-op and ESLint flagged it as unused. Preserved the intent as an inline comment.
- Added named intermediate `indexerQueue` before `export default` to fix the
  `import/no-anonymous-default-export` warning (pre-existing, now cleared).
- Replaced `catch (_)` patterns with bare `catch {}` throughout to silence
  `no-unused-vars` warnings (pre-existing, now cleared).

---

### `frontend/src/lib/models/inverted-index.ts`

**Size delta:** 256 lines → 256 lines (net neutral after extraction adds and flatMap
removes). Characters: 6,737 → 6,799 (+62, ~0.9% larger). The added `resolveBodyText`
helper and doc comment account for the growth.

**Symbols renamed:** 3 (all private):

- `removeFromIndexObj` → `purgeTermsForResource`
- `perTermFreq` → `termHits`
- `resolveBodyText` (new private helper extracted from `indexResource`)

**Files touched:** 1

**Changes (Antonini):**

- Extracted 12-line body-text resolution chain from `indexResource` into
  `resolveBodyText(projectRoot, res)`. `indexResource` now reads as a clear linear
  sequence: load index → purge old entries → resolve text → count terms → write.
- `removeFromIndexObj` → `purgeTermsForResource`. Old name described mechanism; new
  name describes intent.
- `perTermFreq` → `termHits` in `search`. Shorter with no loss of clarity.
- `catch (_)` → `catch {}` in `loadIndex` and `resolveBodyText`. Removes unused
  variable binding generating lint warnings.
- Dropped `as any` casts on `res.tiptap` and `loaded.tiptap`. Both fields are already
  typed `TipTapDocument`; the casts were vestigial.
- `reindexMissingResources` indexed-ID collection replaced nested `for...of` loops with
  `new Set(Object.values(index).flatMap(Object.keys))`.

**Changes (orchestrator — cross-file baseline fix):**

- Added named intermediate `invertedIndex` before `export default` to fix the
  `import/no-anonymous-default-export` warning (pre-existing, now cleared).

---

### `frontend/src/lib/models/backlinks.ts`

**Size delta:** 234 lines → 239 lines (+2%; Antonini added `ResolverMaps` type alias).
After orchestrator catch fixes: 239 lines final.

**Symbols renamed:** 2 (Antonini) — `err` → `_err` in catch blocks; `d` → `e` in map
callback for consistency. Plus `ResolverMaps` type alias added.

**Files touched:** 1

**Changes (Antonini):**

- Removed unused `import fs from "node:fs/promises"` and `import type { UUID }`;
  added `import type { Dirent }`, `import type { ResourceRef, MetadataValue }` to
  enable proper types downstream.
- `isResourceRef` return type changed from inline shape to `ResourceRef` (existing
  type in `types.ts` — identical shape, named reference is clearer).
- `extractSidecarRefIds` parameter type changed from `Record<string, unknown>` to
  `Record<string, MetadataValue>` — matches what `readSidecar` returns, removes cast.
- Added `ResolverMaps` type alias for `buildResolverMaps` return type. Replaces the
  unreadable `ReturnType<typeof buildResolverMaps> extends Promise<infer R> ? R : any`
  in `resolveTarget`.
- Removed 4 redundant null-guard checks on `maps.slugToId`, `maps.nameToId`,
  `maps.aliasesToId` in `resolveTarget`. `buildResolverMaps` always initialises all
  three; the guards added noise.
- Replaced `(side as any).name/slug/aliases` with bracket-notation access `side["name"]`
  etc. Removes 3 `any` casts.
- `(e: any)` / `(d: any)` in `listResourceIds` → single `(entries as Dirent[])` cast
  then `(e) => e.isDirectory()` / `(e) => e.name`. Removes 2 `any` casts.
- Renamed unused catch params `err` → `_err` to signal intentional ignore.
- Removed `maps as any` cast and `sidecar as Record<string, unknown>` cast.

**Changes (orchestrator — cross-file baseline fix):**

- Replaced all `catch (_err)` and `catch (_)` patterns with bare `catch {}` to
  silence pre-existing `no-unused-vars` warnings.
- Added named intermediate `backlinks` before `export default` to fix the
  `import/no-anonymous-default-export` warning (pre-existing, now cleared).

---

### `frontend/src/lib/models/backlinks-watcher.ts`

**Size delta:** 100 lines → 102 lines (+1%).

**Symbols renamed:** 1 — `verbose` → `isVerbose` (local variable; fixes pre-existing
ESLint error).

**Files touched:** 1

**Changes (Antonini):**

- Renamed local `verbose` to `isVerbose`. ESLint naming-convention rule requires boolean
  local variables to carry an `is/has/...` prefix; this was a pre-existing lint error.
- Extracted duplicated `fs.watch(resourcesDir, ...)` call into `startWatcher()` helper.
  Happy path and poll-retry fallback both called it identically; extracting eliminates
  duplication.
- Passed `scheduleRecompute` directly as the `fs.watch` callback instead of wrapping it
  in `() => { scheduleRecompute(); }`.
- Changed `catch (err)` (unused binding) and `catch (_)` to bare `catch {}`. Eliminates
  pre-existing `no-unused-vars` warnings.
- Replaced anonymous default export with named intermediate `backlinkWatcher`, fixing
  the pre-existing `import/no-anonymous-default-export` warning.

---

### `frontend/src/lib/models/field-values.ts`

**Size delta:** 150 lines → 146 lines (3% smaller).

**Symbols renamed:** 0.

**Files touched:** 1

**Changes (Antonini):**

- Inverted the `flattenUserMetadata` guard from a triple-negative early-return
  (`=== null || !== "object" || Array.isArray`) to a positive affirmative check
  (`&& typeof === "object" && !Array.isArray`). The happy path (spreading
  `userMetadata`) now sits inside the `if` branch, making intent immediately legible
  without parsing three negations. Logic is identical.

---

### `frontend/src/lib/models/field-dedup.ts`

**Size delta:** 143 lines → 142 lines (1 line smaller).

**Symbols renamed:** 0. Removed: `MetadataGroup` import (unused after annotation removal).

**Files touched:** 1

**Changes (Antonini):**

- `levenshtein`: replaced `prev.splice(0, n + 1, ...curr)` with destructured swap
  `[prev, curr] = [curr, prev]`, changed `const` to `let` for both row arrays. The
  splice pattern mutated the array non-obviously; the destructured swap is idiomatic.
- `allMatches`: removed redundant callback type annotations `(group: MetadataGroup)` and
  `(field: MetadataField)` — TypeScript infers both from `schema.groups`.
- Removed now-unused `MetadataGroup` import (only reference was the removed annotation).

---

### `frontend/src/lib/models/field-value-keys.ts`

**Size delta:** 5 lines → 5 lines (unchanged).

**Changes (Antonini):** None. File is two documented constants — already maximally
concise.

---

### `frontend/src/lib/models/previews.ts`

**Size delta:** 107 lines → 103 lines (4% smaller; Antonini 107→102, orchestrator +1
for named default).

**Symbols renamed:** 0. Added: `previews` named intermediate for default export.

**Files touched:** 1

**Changes (Antonini):**

- Replaced cast-then-test pattern (`if ((resource as ImageResource).type === "image")`)
  with direct discriminated-union narrowing (`if (resource.type === "image")`).
  TypeScript narrows automatically inside the branch; subsequent explicit casts removed.
- Replaced `if (generators && generators.image)` with `generators?.image` optional
  chaining in all three branches, reducing nesting by one level.
- Extracted `const plainText = resource.plainText ?? ""` to avoid evaluating twice.
- Preserved pre-existing `(resource as any).duration ?? 0` cast intentionally:
  `AudioResource` type has `durationSeconds`, not `duration` — fixing this would be a
  behavior change (deferred, flagged as latent bug predating this refactor).
- Replaced `catch (_)` with bare `catch {}` to fix pre-existing `no-unused-vars` warning.

**Changes (orchestrator — cross-file baseline fix):**

- Added named intermediate `previews` before `export default` to fix the
  `import/no-anonymous-default-export` warning (pre-existing, now cleared).

---

### `frontend/src/lib/models/search-scoring.ts`

**Size delta:** 61 lines → 61 lines (unchanged).

**Symbols renamed:** 1 — `ti` → `termIdx` in event-collection loop (private).

**Files touched:** 1

**Changes (Antonini):**

- Renamed loop variable `ti` → `termIdx`. Eliminates context switch between `ti` (outer
  loop counter) and `termIdx` (field name in pushed object) — they now match, making the
  shorthand property `{ pos, termIdx, len: term.length }` read naturally.
- Scoring formula, weights, window algorithm, and return values are all unchanged.

---

### `frontend/src/lib/models/search-snippet.ts`

**Size delta:** 59 lines → 59 lines (unchanged).

**Changes (Antonini):** None. File is already clear and well-structured — algorithm
comments explain non-obvious decisions, naming is precise, logic is flat.

---

### `frontend/src/store/searchSlice.ts`

**Size delta:** 132 lines → 127 lines (4% smaller).

**Symbols renamed:** 0.

**Files touched:** 1

**Changes (Antonini):**

- Merged two scattered `export type { ... } from "./search-transport-service"` statements
  into a single re-export on one line; moved `import type { RootState }` beside other
  imports.
- Removed six `return state` statements from Immer-based reducers (`clearSearch`,
  `fulfilled`, `rejected`). In RTK's Immer layer, returning the draft is identical to
  not returning — the returns were noise.

---

### `frontend/src/store/search-transport-service.ts`

**Size delta:** 73 lines → 74 lines (unchanged; Antonini reports 74 due to counting
differences).

**Symbols renamed:** 0.

**Files touched:** 1

**Changes (Antonini):**

- Tightened intermediate cast in `getApiErrorMessage` from `{ error?: unknown }`
  (optional) to `{ error: unknown }` (required). The `"error" in errorBody` guard
  already proves the property exists; the `?` was misleading. Shape and runtime behavior
  identical.

---

### `frontend/app/api/project/[project-id]/search/route.ts`

**Size delta:** 313 lines → 323 lines (+3.2%). File grew because extractions add named
function signatures. This is the headline clarity target.

**Symbols renamed:** 0. New private helpers added: `loadTagAssignments`,
`scoreMultiTermCandidates`. `SidecarData` and `ScoredCandidate` types promoted to module
scope.

**Files touched:** 1

**Changes (Antonini):**

- Promoted `type SidecarData` and `interface ScoredCandidate` from inside `executeSearch`
  to module scope. They described module-level shapes; keeping them inside a function hid
  that.
- Extracted tag-loading logic into `loadTagAssignments(projectRoot)`. The original had a
  try/catch block at the top of `executeSearch` assigning into a `let`. The helper gives
  the pattern a name and makes the error path visible.
- Extracted multi-term scoring branch into `scoreMultiTermCandidates(projectRoot,
rankedIds, terms)`. The original used a `let candidates` declaration followed by a
  mutating `if/else`. The helper returns `ScoredCandidate[]` directly; the proximity
  scoring strategy comment now sits at the top of that function. `executeSearch` now
  reads as a single ternary assignment.
- Removed `isMultiTerm` local variable — its only use was as the `if` condition, which
  is now `terms.length > 1` in the ternary; inline is clearer.

---

### `frontend/app/api/project/[project-id]/reindex/route.ts`

**Size delta:** 64 lines → 63 lines (2% smaller).

**Symbols renamed:** 0.

**Files touched:** 1

**Changes (Antonini):**

- Removed redundant `import type { Dirent }` — used only to annotate `let entries:
Dirent[]`, which TypeScript infers from `fs.readdir(..., { withFileTypes: true })`.
  Dropping the annotation and import removes one line.

---

### `frontend/components/SearchBar/SearchBar.tsx`

**Size delta:** 207 lines → 206 lines (0.5% smaller).

**Symbols renamed:** 1 — `open` → `isOpen` (file-local state variable, does not
propagate; fixes pre-existing lint error).

**Files touched:** 1

**Changes (Antonini):**

- Removed unused `import type { ListboxOption }` — imported but never referenced
  (pre-existing lint warning, now cleared).
- Renamed state variable `open` → `isOpen` — fixes ESLint naming-convention error
  requiring boolean-state variables to carry an `is/...` prefix. Updated all four
  usages (`useState` declaration, `useDismissableMenu` argument, `handleKeyDown` guard,
  JSX conditional).
- `isOpen: isOpen` collapsed to shorthand `isOpen` in the `useDismissableMenu` call.

---

### `frontend/components/SearchBar/SearchFilterPanel.tsx`

**Size delta:** 129 lines → 129 lines (unchanged).

**Changes (Antonini):** None. No baseline lint issues and no readability improvements
available within the stated constraints.

---

### `frontend/components/common/ResourceCommandPalette.tsx`

**Size delta:** 199 lines → 181 lines (9% smaller).

**Symbols renamed:** 0 (removed 3 imports and 1 internal component).

**Files touched:** 1

**Changes (Antonini):**

- Removed unused `import type { ListboxOption }` (pre-existing lint warning, cleared).
- Removed unused `ResourceTypeIcon` component — defined but never called in the render
  path (pre-existing lint warning, cleared). `getResourceTypeLabel` helper is still
  called via `meta: getResourceTypeLabel(r)` in the Listbox options.
- Removed `FileText`, `Image as ImageIcon`, and `Music2` from the lucide import — those
  icons were only used inside the now-removed `ResourceTypeIcon`; `Search` kept.

---

## Cross-file orchestrator changes (beyond what Antonini touched)

**Baseline gate fixes applied by orchestrator to in-scope files:**

1. `indexer-queue.ts` — renamed 3 boolean module-private variables (`running`,
   `stopped`, `shutdownHooksInstalled`) to their `is`-prefixed forms. Three pre-existing
   lint errors, now cleared. All 8 usages updated within the file; no external
   propagation (all private).

2. `indexer-queue.ts` — removed stale `eslint-disable-next-line no-await-in-loop`
   directive. The rule is not active in this project's ESLint config; the directive was a
   no-op and was flagged as unused. Preserved the intent as an inline comment alongside
   the `await runTask(task)` call.

3. `indexer-queue.ts`, `backlinks.ts` — added named intermediates before `export default`
   (`indexerQueue`, `backlinks`) to fix `import/no-anonymous-default-export` warnings.
   Same pattern Antonini applied to `backlinks-watcher.ts`; applied consistently to all
   in-scope files.

4. `inverted-index.ts`, `previews.ts` — added named intermediates before `export default`
   (`invertedIndex`, `previews`) for the same reason.

5. `backlinks.ts` — replaced all `catch (_err)` and `catch (_)` patterns with bare
   `catch {}`. Five pre-existing `no-unused-vars` warnings, now cleared.

6. `previews.ts` / `indexer-queue.ts` — replaced remaining `catch (_)` with bare
   `catch {}`.

No cross-file unification was performed beyond these baseline fixes. The slice doc's
stated unification goal ("watch for shared dedup/key logic across the `field-*` modules")
was assessed: `field-value-keys.ts` exports `NULL_VALUE_KEY` and `MISSING_VALUE_KEY`,
both re-exported from `field-values.ts`. This is already a well-structured
two-level re-export. No duplication warranting structural unification was found across
`field-dedup.ts`, `field-values.ts`, and `field-value-keys.ts`.

---

## Signature stability

Pre- and post-change grep of `^export ` for all 17 in-scope files confirms no public
signatures were added, removed, or retyped. All changes are internal-only:

- Private variable renames (`running`, `stopped`, `shutdownHooksInstalled`,
  `perTermFreq`, `removeFromIndexObj`, `ti`) propagate only within their files.
- New private helpers (`resolveBodyText`, `loadTagAssignments`,
  `scoreMultiTermCandidates`, `startWatcher`) are unexported.
- Named default export intermediates (`indexerQueue`, `invertedIndex`, `backlinks`,
  `previews`, `backlinkWatcher`) do not change the exported value.
- `ResolverMaps` type alias added in `backlinks.ts` is unexported (module-private).
- Removed members (`ResourceTypeIcon`, `ListboxOption` imports) were not exported.

---

## Gate result

From `frontend/`:

| Check                                  | Result                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                       | PASS — clean                                                                                  |
| `pnpm lint` (slice files)              | PASS — 1 pre-existing warning (`previews.ts:83 no-explicit-any`) deferred; all errors cleared |
| `pnpm exec vitest run` (11 test files) | PASS — 139/139                                                                                |
| `pnpm knip` (repo root)                | Pre-existing failures only; no new issues introduced                                          |

Repo-wide lint: 411 problems (88 errors, 323 warnings) post-slice vs. 453 baseline (93
errors, 360 warnings). Net: 42 fewer problems, 5 fewer errors, 37 fewer warnings — all
pre-existing issues in the slice's own files, now cleared.

---

## Deferred

- `previews.ts` line 83: `(resource as any).duration ?? 0` — latent bug (AudioResource
  uses `durationSeconds`, not `duration`). Fixing this would change observable behavior
  (audio preview duration field). Deferred to a correctness fix outside the
  brevity/clarity effort.
- `inverted-index.ts`, `backlinks.ts`, `indexer-queue.ts` etc. — the `no-explicit-any`
  warning pattern recurs across the codebase. Systematic elimination is out of scope for
  a single slice; flagged in `docs/standards/typescript-implementation.md`.
