# Slice 03 — Revisions

**Risk:** 🔴 high — the single-canonical invariant. Run characterization tests first.
**~3k lines.** Layer: core + store + api + UI.

## Scope

- **Core:** `revision.ts` (377), `revision-manager.ts` (88), `revision-settings.ts` (48),
  `pruneExecutor.ts` (59), `resource-revision.ts` (24).
- **Store:** `revisionsSlice.ts` (646), `revision-transport-service.ts` (176),
  `revision-normalization.ts` (134), `revision-canonical-guards.ts` (35).
- **API:** `app/api/resource/revision/[resource-id]/route.ts` (604).
- **UI:** `components/Editor/RevisionControl/RevisionControl.tsx` (398),
  `components/WorkArea/DiffView.tsx` (201), `DiffViewController.tsx` (251).

## Goal

`revisionsSlice.ts` (646) and the revision route (604) are the brevity targets.
Clarify normalization and the canonical-guard logic without altering the invariant.

## Watch out for

- **Exactly one `isCanonical: true` per resource** — `revision-canonical-guards.ts`
  enforces this. Do not weaken it.
- Prune order (oldest non-canonical first, keep ≤ max) must be preserved.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/revision unit/revision-manager unit/revision-prune unit/pruneExecutor \
  unit/revision-settings-api revisions-slice-selectors diffView diffViewController \
  defaultRevisionNameModal
```

Then `pnpm knip` at repo root.
