# Task List: Backlink Detection Repair (`resource-ref` / `multi-resource-ref`)

Source spec: `specs/features/entity-linking.md`

### Task 1: Descend `extractSidecarRefIds` into `sidecar.userMetadata`

**What:** Fixes `extractSidecarRefIds` so it scans `resource-ref`/`multi-resource-ref` values both at the sidecar top level and one level down under `sidecar.userMetadata`, without generic recursion into other nested objects.

**Files:** `frontend/src/lib/models/backlinks.ts`

**Done when:** `extractSidecarRefIds` scans `Object.values(sidecar)` (top level, unchanged) plus `Object.values(sidecar.userMetadata)` when `sidecar.userMetadata` is a non-null, non-array object (mirroring `flattenUserMetadata` in `frontend/src/lib/models/field-values.ts:137-146` — reuse that function or an equivalent one-level-deep merge, and the task/PR states explicitly which approach was taken). `isResourceRef` (`backlinks.ts` ~lines 18-28) is not modified. No other nested path (e.g. two levels deep, or objects other than `userMetadata`) is scanned. `tsc --noEmit` and `pnpm lint` pass in `frontend/`.

**Depends on:** none

**Estimate:** 2

**Notes:** FR-1. FR-7 is satisfied by this task doing nothing extra: no index-version marker, no automatic rebuild, no startup migration is added anywhere in this change. If a reviewer finds any such addition, that is a defect against FR-7, not a missing task — remove it rather than filing a follow-up.

**Done:** [ ]

### Task 2: Regression-test top-level and nested `userMetadata` ref extraction

**What:** Extends the existing sidecar-ref test suite with a case proving the fix (nested-under-`userMetadata` refs are now detected) while confirming the five already-covered top-level behaviors still hold.

**Files:** `frontend/tests/unit/backlinks-wiki.test.ts` (existing `describe("backlinks — sidecar resource-ref extraction", ...)` block — add to it, do not create a new file)

**Done when:**
- A new test writes a sidecar via `writeSidecar(projectRoot, source, { userMetadata: { pov: { id: target, name: "..." } } })` (single ref) and asserts `computeBacklinks` includes `target` in `idx[source]`. This test fails against the pre-fix `extractSidecarRefIds` (top-level-only scan) and passes after Task 1 — verified by running it once against the unmodified `backlinks.ts` (fails) and once after Task 1's change (passes), and both results are noted in the task's completion notes.
- A second new test covers a `multi-resource-ref` array nested under `userMetadata` (one backlink id per non-null element).
- The four existing tests in that `describe` block — single top-level ref (FR-3), multi-resource-ref array at top level (FR-4), `id: null` skipped (FR-5), self-reference excluded (FR-6) — are re-run and still pass unmodified, confirming no regression (FR-2).
- `pnpm --filter getwrite-frontend exec vitest run backlinks-wiki` passes.

**Depends on:** 1

**Estimate:** 2

**Notes:** FR-2 through FR-6, plus the new FR-1 nested case. This is the substantive work of the change per the spec's own framing — treat the fail-before/pass-after check as a hard requirement, not a formality.

**Done:** [ ]

### Task 3: Verify downstream consumers surface the corrected data end to end

**What:** Confirms, with a test exercising the real call path (no code change expected), that a nested `userMetadata` ref now flows through to the `linkedFrom`/`linksTo` query intrinsics and to `mentions-core.ts`'s `isLinked`, since neither has been verified against this fix.

**Files:** `frontend/tests/unit/query-intrinsics.test.ts` and/or `frontend/tests/unit/mention-index.test.ts` (extend existing files; add a scenario per file's existing conventions), reading `frontend/src/lib/models/query-intrinsics.ts:140-160` and `frontend/src/lib/models/mentions-core.ts:248-295` first to match calling conventions already in use

**Done when:** A test in the query-intrinsics suite that sets up a `userMetadata`-nested `resource-ref` (via `writeSidecar` + `computeBacklinks`/`persistBacklinks`, or by driving the same path the app uses) asserts `linkedFrom`/`linksTo` returns the referenced/referencing resource id. A test in the mention-index suite asserts `isLinked` is `true` for a resource nested-ref-linked to an entity, using `computeBacklinks`'s output as the `linkedResourceIds` input `mentions-core.ts` line ~282 expects. If either consumer requires a code change beyond Task 1 to see the fix (which the spec does not anticipate), that is reported as a spec deviation rather than silently patched.

**Depends on:** 1

**Estimate:** 2

**Notes:** No production code change is expected here — this is verification that the spec's value claim ("linkedFrom/linksTo … receive real data") actually holds through the full call chain, not just at `extractSidecarRefIds`. Flagged as the one place this task list adds work the spec doesn't explicitly request as a "task" (the spec states it as an outcome, not a deliverable) — kept in scope because nobody has checked it and a false claim in the spec's Goals section would otherwise ship unverified.

**Done:** [ ]

### Task 4: Document the one-time `reindex` step for existing projects

**What:** Adds a plainly-stated note to the `reindex` section of `docs/features/cli.md` telling writers to run `getwrite-cli reindex` once per existing project they will not edit again, including the stated limitation that a never-reedited, never-manually-reindexed project keeps a silently stale backlink index.

**Files:** `docs/features/cli.md` (the existing `### reindex` section, `docs/features/cli.md:201-227`)

**Done when:** The `reindex` section states: (1) this fix means `resource-ref`/`multi-resource-ref` backlinks now resolve correctly, and any project's on-disk `meta/backlinks.json` self-heals automatically on the next save to any resource in that project; (2) for a project the writer does not plan to edit again, running `getwrite-cli reindex` once brings it up to date immediately; (3) the limitation is stated plainly — a project that is never edited again and is never manually reindexed keeps a stale backlink index with no in-app signal. No migration script, version marker, or startup check is introduced by this task — it is a documentation-only change.

**Depends on:** 1

**Estimate:** 1

**Notes:** FR-8. This is the only in-scope documentation change per the spec; `entity-layer.md` and `getwrite.features.md` are explicitly out of scope per the spec's resolved Open Questions.

**Done:** [ ]

## Summary

- Total tasks: 4
- Total estimated effort: 7 points
- Critical path: Task 1 → Task 2 (Task 3 and Task 4 both depend only on Task 1 and can run in parallel with Task 2 and each other)
- Risks: Task 3 is the least certain — it's verification of a composition nobody has exercised end to end, not a known-shape code change, so it could surface a real gap between `computeBacklinks`'s output shape and what the query intrinsics or `mentions-core.ts` expect as input. If it does, that's a genuine spec-vs-implementation mismatch to report back, not something to silently code around inside this task list.

## Open Questions

None — the source spec's Open Questions are fully resolved (see `specs/features/entity-linking.md`), and no new ones surfaced while writing this task list.
