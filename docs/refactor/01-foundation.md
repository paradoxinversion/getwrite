# Slice 01 — Foundation (shared)

**Risk:** 🔴 high — every other slice depends on these. Do this **last**.
**~1.5k lines.** Layer: core only.

## Scope

`frontend/src/lib/models/`: `schemas.ts` (563), `types.ts` (339), `io.ts` (306),
`memoryAdapter.ts` (205), `uuid.ts` (51), `semver-compare.ts` (49), `locks.ts` (43),
`meta-locks.ts` (30), `index.ts` (8), `field-value-keys.ts` (5).

## Goal

Tighten the shared primitives: collapse duplicated Zod shapes in `schemas.ts`,
clarify the `io.ts` read/write helpers, name the lock/mutex APIs for intent.
These are imported everywhere, so clarity here compounds.

## Watch out for

- **Exported types and schema names are public API across all 11 other slices.**
  Renaming `types.ts`/`schemas.ts` exports is out of scope unless coordinated —
  treat signatures as frozen.
- `locks.ts` / `meta-locks.ts` concurrency semantics must not change (serialization
  order, key derivation). Pure readability only.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run uuid semver-compare unit/index
```

Then `pnpm knip` at repo root. Because everything imports this, a full
`pnpm exec vitest run` pass is warranted before merge.
