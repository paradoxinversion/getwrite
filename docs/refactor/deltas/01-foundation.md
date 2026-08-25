# Slice 01 — Foundation (shared): Per-File Deltas

Date: 2026-06-17
Branch: `refactor/brevity-and-clarity`

Baseline: 4 test files, 23 tests — all passing. Typecheck clean. Lint had 2 pre-existing
errors in `locks.ts` (boolean variable naming convention). All other in-scope files were
lint-clean at baseline.

---

## Per-file deltas (Antonini reports, verbatim)

### `frontend/src/lib/models/locks.ts`

**Size delta:** 43 lines → 36 lines (16% smaller).

**Symbols renamed:** 1 — `released` → `isReleased` (both occurrences, local closure variable).
New symbols added: `makeRelease` (private helper), `lockApi` (named default export intermediate).

**Files touched:** 1

**Changes (Antonini):**

- Extracted `makeRelease(key: string): () => void` helper. The release closure — idempotency
  guard (`if (isReleased) return; isReleased = true`), drain-or-delete — was byte-identical in
  both branches of `acquireLock`. Each branch now resolves to a single `resolve(makeRelease(key))`
  call. Each call creates its own independent `let isReleased = false`, preserving the per-lock
  idempotency isolation.
- Renamed `released` → `isReleased` (both occurrences). Fixes 2 pre-existing
  `@typescript-eslint/naming-convention` lint errors requiring boolean variables to carry an
  `is/has/should/can/did/will` prefix.
- Named the default export: `const lockApi = { acquireLock }; export default lockApi`. Fixes
  the pre-existing `import/no-anonymous-default-export` ESLint warning. Pattern matches how
  other modules in the codebase resolved the same warning.

---

### `frontend/src/lib/models/meta-locks.ts`

**Size delta:** 30 lines → 41 lines (+37%). Growth is entirely documentation. No logic
touched.

**Symbols renamed:** 0. New symbol added by orchestrator: `metaLocks` (named default export
intermediate).

**Files touched:** 1

**Changes (Antonini):**

- Added a module-level JSDoc block explaining that this module is a promise-chain serializer,
  distinguishing it from `locks.ts` (queue-based mutex). Addresses conceptual confusion risk
  when readers encounter two concurrency primitives in the same directory.
- Replaced the terse `// Ensure we remove the lock entry when done` comment on `locks.set`
  with a two-sentence explanation of _why_ the stored promise is void-settled via
  `.then(() => undefined).catch(() => undefined)`: a rejected stored entry would surface as an
  unhandled rejection if callers ignore the returned promise. The original comment said what;
  the new one says why.

**Changes (orchestrator — cross-file baseline fix):**

- Added `const metaLocks = { withMetaLock }; export default metaLocks;` to fix the pre-existing
  `import/no-anonymous-default-export` warning. Pattern consistent with `locks.ts`.

---

### `frontend/src/lib/models/uuid.ts`

**Size delta:** 51 lines unchanged; ~0.6% smaller in bytes (1644 → 1634 chars).

**Symbols renamed:** 0. New symbol added by orchestrator: `uuidUtils` (named default export
intermediate).

**Files touched:** 1

**Changes (Antonini):**

- Hoisted `GlobalCrypto` type alias from inside `generateUUID`'s body to module level. The type
  existed solely to satisfy the no-`any` constraint; keeping it inside the function body mixed
  type-definition concern with algorithm logic. At module level, `generateUUID`'s body now opens
  directly with the cast that uses the type.

**Changes (orchestrator — cross-file baseline fix):**

- Added `const uuidUtils = { generateUUID, isValidUUID }; export default uuidUtils;` to fix the
  pre-existing `import/no-anonymous-default-export` warning.

---

### `frontend/src/lib/models/semver-compare.ts`

**Size delta:** 0% — no changes made.

**Symbols renamed:** 0. **Files touched:** 0.

**Changes (Antonini):** None — already clear. The module JSDoc explains the non-obvious design
choice (pre-release ordering intentionally omitted), naming is precise, logic is flat. Nesting
depth is 2 throughout. Both functions are under 15 lines.

---

### `frontend/src/lib/models/field-value-keys.ts`

**Size delta:** 0% — no changes made.

**Symbols renamed:** 0. **Files touched:** 0.

**Changes (Antonini):** None — already maximally concise. Two JSDoc comments and two exported
constants; no redundancy, no nesting, no dead code.

---

### `frontend/src/lib/models/index.ts`

**Size delta:** 0% — no changes made.

**Symbols renamed:** 0. **Files touched:** 0.

**Changes (Antonini):** None — already minimal. Pure barrel file; all five `export *` statements
correct and necessary.

---

### `frontend/src/lib/models/io.ts`

**Size delta:** 306 lines → 301 lines (0.7% smaller; 3 `| undefined` suffixes removed, 1
variable rename).

**Symbols renamed:** 1 — `maybe` → `typed` in private `normalizeAtomicWriteOptions`.

**Files touched:** 1

**Changes (Antonini):**

- Renamed `maybe` → `typed` in `normalizeAtomicWriteOptions`. `maybe` conveyed uncertainty about
  the type; `typed` accurately describes what it is — the same value narrowed to `AtomicWriteOptions`
  for structural inspection.
- Removed `| undefined` from the `opts?` parameter of `readdir` and `rm` in `StorageAdapter`. The
  `?` optional marker already encodes `| undefined`; the explicit suffix was redundant and
  inconsistent with `mkdir`, `writeFile`, and other methods in the same interface.

---

### `frontend/src/lib/models/memoryAdapter.ts`

**Size delta:** 205 lines → 205 lines (unchanged line count; 7056 → 7026 bytes, 0.4% smaller).

**Symbols renamed:** 0. Three unused `opts` parameters renamed to `_opts` (`mkdir`, `readdir`,
`rm`) to signal intentional non-use.

**Files touched:** 1

**Changes (Antonini):**

- `resolveParent` return type tightened from `{ parent: DirNode; name?: string } | null` to
  `{ parent: DirNode; name: string } | null` by adding `if (!name) return null` before the
  traversal loop. The type now carries the guarantee that callers previously enforced with
  `!res.name` guards.
- All five `name!` non-null assertions removed from callers (`writeFile`, `rm`, `rename` ×3).
  TypeScript now infers `name: string` from the narrowed return type.
- `writeFile` and `rm` guards simplified: `if (!res || !res.name)` → `if (!res)`.
- `rename` guard simplified: `if (!oldRes || !oldRes.name || !newRes || !newRes.name)` →
  `if (!oldRes || !newRes)`.
- `as any` on `stat` root-path return tightened to `as unknown as Stats`, matching the pattern
  used on the non-root return. Eliminates 1 pre-existing `no-explicit-any` lint warning.
- Three unused `opts` parameters renamed to `_opts` (`mkdir`, `readdir`, `rm`) to signal
  intentional non-use per the ESLint parameter convention.

---

### `frontend/src/lib/models/types.ts`

**Size delta:** 339 lines → 345 lines (+2%); 12,687 → 13,200 bytes. Growth is comment additions
only. No symbols renamed.

**Symbols renamed:** 0. **Files touched:** 1.

**Changes (Antonini):**

- Added JSDoc to three undocumented public types: `EditorHeadings`, `EditorHeading`,
  `EditorBodyConfig`. Each now has a single-line JSDoc describing its role.
- Added `@deprecated` inline doc to `Folder.special`: the field is ignored in the project-type
  JSON schema; the interface had no comment hinting at its status.
- Added inline doc to `Folder.metadataSource`, cross-referencing the `MetadataSource` type.
- Added trailing periods to `Revision.id` and `Revision.resourceId` inline docs for internal
  consistency with other member comments in the interface.
- Added JSDoc to `AnyResource`: the only exported type alias with no documentation; names it as
  a discriminated union keyed by `type`.

---

### `frontend/src/lib/models/schemas.ts`

**Size delta:** 563 lines → 561 lines (Antonini pass, 0.4% smaller); then +10 lines for
orchestrator cross-file unification → final 571 lines. Net: 563 → 571 (+1.4%).

**Symbols renamed:** 0. New internal symbol added: `MetadataSourceSchema` (private, unexported).

**Files touched:** 1

**Changes (Antonini):**

- `validateProjectTypeFile`: eliminated the mutable `let parsed: unknown` pre-declaration by
  folding `JSON.parse` directly into the `try` block and returning its result immediately. The
  `let` + assign + post-try-return pattern was unnecessarily verbose. Behavior is identical.

**Changes (orchestrator — cross-file unification goal):**

- Extracted the duplicated `metadataSource` Zod inline shape into a private `MetadataSourceSchema`
  constant (unexported). The identical shape appeared verbatim in three places:
  - `FolderSchema` (line 278 pre-change)
  - `ProjectTypeFolderSchema` (line 443 pre-change)
  - `ProjectTypeDefaultFolderSchema` (line 462 pre-change)
    All three now reference `MetadataSourceSchema.optional()`. The shape is unchanged: `{ isMetadataSource: z.boolean(), metadataInputType: z.enum(["text", "multiselect", "autocomplete"]).optional() }`.
    Added a JSDoc on `MetadataSourceSchema` explaining it is not exported — the three schemas that
    use it are the public API.

---

## Cross-file orchestrator changes (beyond what Antonini touched)

1. **`schemas.ts` — metadataSource unification (slice's stated cross-file goal).** Extracted
   the triple-duplicated inline Zod shape into a private `MetadataSourceSchema` constant. All
   three call sites updated. No exported schema names or shapes changed. This is purely internal
   deduplication; callers see identical runtime Zod objects.

2. **`uuid.ts` — anonymous default export fix.** Added named intermediate `uuidUtils` before
   `export default`. Pre-existing `import/no-anonymous-default-export` warning, now cleared.
   The exported value is unchanged.

3. **`meta-locks.ts` — anonymous default export fix.** Added named intermediate `metaLocks`
   before `export default`. Same pattern. Pre-existing warning, now cleared.

Note: `memoryAdapter.ts` already had `export default { createMemoryAdapter }` without a named
intermediate — knip flags this as a pre-existing "unused default export" issue (the file's
consumers use named imports, not the default). The pattern is consistent with the rest of the
codebase; fixing it is out of scope for this slice.

---

## Signature stability

Pre- and post-change grep of `^export` for all 10 in-scope files confirms no public signatures
were added, removed, or retyped:

- `locks.ts`: `acquireLock` signature unchanged. `makeRelease` is private (unexported). `lockApi`
  is the named intermediate for the default export — the default export object `{ acquireLock }`
  is unchanged.
- `meta-locks.ts`: `withMetaLock<T>` signature unchanged. `metaLocks` is the named intermediate
  for the default export.
- `uuid.ts`: `generateUUID`, `isValidUUID` signatures unchanged. `uuidUtils` is the named
  intermediate for the default export.
- `io.ts`: All 14 exported symbols unchanged. The `| undefined` removal from `StorageAdapter.readdir`
  and `StorageAdapter.rm` parameters is a no-op in TypeScript's type system (`opts?: T` already
  implies `T | undefined`); typecheck confirms compatibility.
- `memoryAdapter.ts`: `createMemoryAdapter` signature unchanged. `_opts` renames do not affect
  the public interface (TypeScript structural typing; parameter names are not part of the call
  signature).
- `schemas.ts`: All 49 exported consts/types/functions unchanged. `MetadataSourceSchema` is not
  exported. The three schemas that used the inline shape now reference the helper — the runtime
  Zod schema objects they produce are identical.
- `types.ts`: 0 symbols renamed, 0 removed. 6 lines of added JSDoc only.
- `semver-compare.ts`, `field-value-keys.ts`, `index.ts`: unchanged.

---

## Gate result

From `frontend/`:

| Check                                                 | Result                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`                                      | PASS — clean                                                           |
| `pnpm lint` (slice files only)                        | PASS — all errors cleared (2 pre-existing in `locks.ts`, now resolved) |
| `pnpm exec vitest run uuid semver-compare unit/index` | PASS — 23/23                                                           |
| `pnpm exec vitest run` (full suite)                   | PASS — 2056/2056 (1 skipped, pre-existing)                             |
| `pnpm knip` (repo root)                               | Pre-existing failures only; no new issues introduced by this slice     |

Knip notes: `default` exports on `locks.ts`, `meta-locks.ts`, `memoryAdapter.ts` are flagged
as unused (callers import named exports, not the default). This is a pre-existing pattern
consistent with other refactored files (`backlinks-watcher.ts`, `inverted-index.ts`, `previews.ts`,
etc.); not introduced by this slice.

---

## Deferred

- `memoryAdapter.ts` default export knip warning: callers use named imports; the default export
  is legacy surface. Fixing would require removing `export default { createMemoryAdapter }` and
  auditing all import sites — a cross-cutting change outside this slice's scope.
- `uuid.ts`, `meta-locks.ts`, `locks.ts` default export knip warnings: same pattern. The named
  intermediate fix clears the `import/no-anonymous-default-export` lint issue; the knip "unused
  default" is a separate concern requiring call-site audit.
- `io.ts` `as any` casts in the default adapter object: required to bridge Node's `fs/promises`
  overloads; the `as any` casts are load-bearing. Replacing them with proper overload-aware types
  is a larger TypeScript engineering task outside this slice.
