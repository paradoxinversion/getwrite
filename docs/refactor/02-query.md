# Slice 02 — Query / Smart Folders

**Risk:** 🟡 **~4.5k lines.** Layer: core + store + api + UI.

## Scope

- **Core:** `query-ast.ts` (145), `query-evaluator.ts` (427), `query-cache.ts` (136),
  `query-intrinsics.ts` (172), `saved-queries.ts` (134).
- **Store:** `querySlice.ts` (404), `query-transport-service.ts` (148), `queries-guards.ts` (15).
- **API:** `app/api/project/query/evaluate/route.ts` (244), `app/api/project/query/saved/route.ts` (146).
- **UI:** `components/QueryBuilder/` (9 files, 2.7k) — `ValuePicker` (690),
  `FilterChip` (619), `FieldPicker` (437), `QueryBuilder` (283), `FilterGroup` (208),
  `SaveQueryDialog` (179).

## Goal

The AST → evaluator → cache pipeline is the densest core logic; aim for clearer
naming and decomposition of `query-evaluator.ts`. In UI, `ValuePicker`/`FilterChip`/
`FieldPicker` likely share branching that can be unified.

## Watch out for

- Evaluator results feed smart folders and saved queries — output ordering and
  matching must be identical. Lean on the evaluator/intrinsics tests.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/query-evaluator unit/query-intrinsics unit/query-routes \
  filterChip fieldPicker saveQueryDialog smartFolders
```

Then `pnpm knip` at repo root.
