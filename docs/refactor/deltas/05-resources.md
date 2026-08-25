# Slice 05 — Resources / Templates / Trash: Per-file Deltas

Date: 2026-06-17

---

## Core model files (`frontend/src/lib/models/`)

### `resource.ts`

**Size delta:** 43 → 44 lines (+1 line)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Added `// Named imports required to assemble the default export object below.` above the bare import block. The pattern of importing names already covered by `export { ... } from` below is non-obvious; without this comment a reader might assume it is dead code.

Deferred: The pre-existing `import/no-anonymous-default-export` warning on the default export object would require assigning the object to a named const before exporting — that is out of scope as it would change the module's default export shape.

---

### `resource-factory.ts`

**Size delta:** 257 → 265 lines (+8 lines — clarity extraction)
**Symbols renamed:** 2 (`now` → `createdAt`, local `id` made part of the same destructure — both internal-only)
**Files touched:** 1

Changes:

- Extracted `newIdAndTimestamp()` helper — the `const now = new Date().toISOString(); const id = generateUUID();` pair appeared verbatim in all four factory functions. A single named helper eliminates the repetition and makes the intent explicit.
- Extracted `deriveTextMetrics(plain)` — the three-line word/char/paragraph block in `createTextResource` handles a distinct concern and is now named and isolated. The result spreads cleanly into the resource literal via `...deriveTextMetrics(plain)`.
- Renamed local `now` → `createdAt` (via destructuring) — aligns the local name with the field it populates.

---

### `resource-persistence.ts`

**Size delta:** 285 → 273 lines (−12 lines, 4% smaller)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Moved early `return resource` for folder resources to the top of `writeResourceToFile`, then placed `const base` after it. The old code computed `base` using a ternary before the early-return — wasted work for every folder write.
- Removed `&& !isFolderResource(resource)` from `isTextResource` guard — redundant since `resource.type === "text"` can never be true when `type === "folder"`.
- Replaced the index-mutating `for` loop in `getLocalResources` with `.map()`. The old loop mutated `resources[i]` in-place to backfill word counts; the `.map()` makes the intent clear.

---

### `sidecar.ts`

**Size delta:** 128 → 102 lines (−26 lines, 20% smaller)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Removed `ensureDir` helper. Its body was a try/catch that unconditionally rethrew, making it identical to calling `fs.mkdir` directly. Inlined `fs.mkdir(dir, { recursive: true })` at the one call site in `writeSidecar`.
- Removed the outer `try/catch` block wrapping `setImmediate(...)` in `writeSidecar`. `setImmediate` is a synchronous registration call that cannot throw; the catch block was unreachable dead code.
- Replaced `(err as any).code === "ENOENT"` in `readSidecar` with `(err as NodeJS.ErrnoException).code === "ENOENT"`, matching the pattern used throughout sibling model files. Eliminates a pre-existing `no-explicit-any` lint error.
- Collapsed the five-line ENOENT guard in `bumpMetadataRevision` to a single-line cast. The intermediate checks added no safety not already provided by the cast.
- Eliminated the `parsed` intermediate variable in `readSidecar` (`const parsed = JSON.parse(raw) as ...; return parsed;` → `return JSON.parse(raw) as ...`).

---

### `trash.ts`

**Size delta:** 293 → 255 lines (−38 lines, 13% smaller)
**Symbols renamed:** 2 (`anyChanged` → `isAnyChanged`, `dirty` → `isDirty` — pre-existing boolean naming-convention lint errors)
**Files touched:** 1

Changes:

- Added `trashPaths(projectRoot)` helper returning `{ trashRoot, trashResourcesDir, trashMetaDir }`. The identical three-path computation was duplicated in all three public functions; the helper removes 9 lines of repetition.
- Removed `ensureDir` wrapper function — trivial passthrough. Replaced three call sites with direct `fs.mkdir(dir, { recursive: true })` calls.
- Replaced all four inline `(err as any).code === "ENOENT"` guards with the existing `isEnoent(err)` helper — unifies the error-check pattern and eliminates 4 pre-existing `no-explicit-any` warnings.
- Inverted ENOENT catch blocks from `if (isEnoent) { /* no-op */ } else { throw err }` to `if (!isEnoent(err)) throw err`, reducing one nesting level per catch block and eliminating empty branches.
- Renamed `anyChanged` → `isAnyChanged` and `dirty` → `isDirty` to satisfy the project's ESLint boolean-prefix rule.
- Converted bare `catch (err)` bindings in `purgeResource` (where the error is intentionally ignored) to `catch { }`, removing 2 pre-existing `no-unused-vars` warnings.
- Removed the redundant `(raw as unknown[])` cast in `patchRef`'s array branch — `Array.isArray(raw)` already narrows `raw` to `unknown[]`.

---

### `folder-utils.ts`

**Size delta:** 84 → 73 lines (−11 lines, 13% smaller)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Pulled the repeated `readdir` + `.DS_Store` filter + `stat.isDirectory()` loop into a private `childDirs(dir)` helper. Both `readFolderTree` and `renameFolderById` shared this exact three-step pattern verbatim.
- Both public functions lost one nesting level entirely — the `for` loop over names, the `stat` try/catch, and the `.isDirectory()` guard all collapse into `for (const subDir of await childDirs(dir))`.
- Removed the `// recurse into subdirectories` comment — it restated the recursive call with no "why" content. Preserved `// no folder.json — skip descriptor, still recurse`.
- Added a single-line JSDoc to `childDirs` explaining its null-safe contract.

---

### `template-service.ts`

**Size delta:** 95 → 88 lines (−7 lines, 7% smaller)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Replaced the manual `exec`-in-while loop in `collectPlaceholdersFromString` with `matchAll` + `for...of`. Eliminates the intermediate `let match` variable and the repeated `exec` call.
- Narrowed `scanValueForPlaceholders`'s `value` parameter type from `MetadataValue | string[] | number[] | boolean[] | unknown` to just `unknown`. The union was misleading noise — `unknown` already covers every case.
- Inlined the `const record = value as Record<string, unknown>` intermediate into `Object.values(value as Record<string, unknown>)`.
- Replaced `template.userMetadata ? Object.keys(template.userMetadata) : []` with `Object.keys(template.userMetadata ?? {})`.
- Dropped the now-unused `MetadataValue` named import.

---

### `resource-templates.ts` (headline brevity target)

**Size delta:** 1012 → 984 lines (−28 lines, 2.8% smaller)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Removed the duplicate one-liner JSDoc fragment (`/** Persist a resource template under project meta/templates. */`) that sat immediately above the full JSDoc for `saveResourceTemplate`.
- Removed `ensureDir` helper function and inlined `fs.mkdir(dir, { recursive: true })` at all 6 call sites.
- Replaced the `typeof (fs as any).cp === "function"` runtime check and its fallback shim in `duplicateResource` with a direct `fs.cp(src, dest, { recursive: true })` call. Node 24 / TS 5.9 both expose `fs.cp` natively; the defensive Node 16.7 shim is no longer needed.
- Removed the dead `try { throw err }` wrapper around the file-copy block in `duplicateResource`. The comment said "propagate error to caller" but a try/catch that only rethrows is identical to no try/catch.
- Removed the unused `ext` variable in `duplicateResource` (assigned via `path.extname(foundName)` but never read). Renamed the unused `err` catch binding to `_`.
- Simplified `listResourceTemplates` filter from a two-branch if/else to a single expression using `query?.toLowerCase()`.
- Replaced `(prev as any)[k]` / `(next as any)[k]` in `recordTemplateChange` with `(prev as unknown as Record<string, unknown>)[k]` — TypeScript-idiomatic for index-accessing a known-typed object when no index signature is present.
- Removed `opts?.vars as any` cast in `previewResourceTemplate`; replaced `(res as any).resourcePreview` with `(res as TemplateCreatePreview).resourcePreview`, using the type already declared in the file.
- Added a missing blank line between the `CRC32_TABLE` IIFE and the JSDoc for `saveResourceTemplateFromResource`.

Deferred: `createResourceFromTemplate` three-branch unification (text/image/audio). The three type-branches each build a resource, filename, filePath, and sidecar JSON, then branch again on `dryRun`. A `writeResourceToStore` inner helper would collapse ~80 lines to ~30 but involves a per-type config table (different extensions `.txt`/`.img`/`.aud`, different content defaults) and was judged too risky for one pass. Recommended for a targeted follow-up.

---

## Store (`frontend/src/store/`)

### `resourcesSlice.ts`

**Size delta:** 181 → 168 lines (−13 lines, 7.2% smaller)
**Symbols renamed:** 0 exported. 2 local iterator parameters (`r` → `f` in `updateFolder` and `updateFolders`)
**Files touched:** 1

Changes:

- Replaced the 10-line inline payload type in `persistReorder` with `ReorderPayload & { projectId: string; projectRoot: string }` — `ReorderPayload` was already defined and identically shaped in `../lib/api/resources`. Removed the duplicated shape; added `ReorderPayload` to the existing import.
- Renamed the `findIndex` callback parameter in `updateFolder` from `r` → `f` — the item being iterated is a `Folder`, not a resource.
- Renamed the `state.folders.map` callback parameter in `updateFolders` from `r` → `f` — same reason.

---

## UI (`frontend/components/ResourceTree/`)

### `ResourceTree.tsx`

**Size delta:** 360 → 344 lines (−16 lines, 4.4% smaller)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Moved `renderResourceIcon` and `renderExpandableStateIcon` from inside the component to module-level function declarations. Neither closes over component state; extracting avoids re-creation on every render.
- Removed redundant intermediate `const resourceType` in `renderResourceIcon` — the `switch` now reads directly from `item.getItemData().resourceType`.
- Collapsed `useMemo(() => { return buildResourceTree(rawResources); }, [rawResources])` to `useMemo(() => buildResourceTree(rawResources), [rawResources])`.
- Simplified `getItemName: (item) => { return item.getItemData().name; }` to `(item) => item.getItemData().name`.
- Fixed redundant double-lookup in `getChildren`'s sort comparator: `transformedResourceData[aData.resourceId]?.orderIndex` → `aData?.orderIndex ?? 0` (clearer and fewer map accesses per sort comparison; changed `|| 0` to `?? 0`).
- Unwrapped `onClick={(e) => { handleClick(e, item); }}` to `onClick={(e) => handleClick(e, item)}`.
- Removed unnecessary template-literal from `className={\`truncate\`}`to`className="truncate"`.
- Removed the unused `AnyResource` import (pre-existing lint warning).

### `CreateResourceModal.tsx`

**Size delta:** 268 → 268 lines (unchanged)
**Symbols renamed:** 1 (`uploading` → `isUploading` — fixes pre-existing boolean naming-convention lint error)
**Files touched:** 1

Changes:

- Removed unused `React` default import; kept named imports.
- Renamed `uploading` / `setUploading` → `isUploading` / `setIsUploading` (3 references updated).

### `FolderTreePicker.tsx`

**Size delta:** 243 → 243 lines (unchanged)
**Symbols renamed:** 2 (`expanded` → `isExpanded`, `open` → `isOpen` — fix pre-existing boolean naming-convention lint errors)
**Files touched:** 1

Changes:

- Removed unused `React` default import; kept named imports.
- Renamed `expanded` / `setExpanded` → `isExpanded` / `setIsExpanded` in `TreeNode` (3 references).
- Renamed `open` / `setOpen` → `isOpen` / `setIsOpen` in `FolderTreePicker` (6 references updated — Radix `open={}` and `aria-expanded={}` prop names unchanged, only the local state variable renamed).

### `RenameResourceModal.tsx`

**Size delta:** 82 → 82 lines (unchanged)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Removed unused `React` default import; kept named imports.

### `SmartFolders.tsx` (orchestrator fix)

**Size delta:** unchanged (rename only)
**Symbols renamed:** 1 (`collapsed` → `isCollapsed`)
**Files touched:** 1

Changes:

- Renamed `collapsed` / `setCollapsed` → `isCollapsed` / `setIsCollapsed` (4 references) — fixes pre-existing boolean naming-convention lint error that Antonini flagged but could not fix because it treated this as out of scope.

### `ResourceContextMenu.tsx`

**Size delta:** 141 → 141 lines (unchanged)
**Symbols renamed:** 1 (`React.ReactNode` → `ReactNode` via named import)
**Files touched:** 1

Changes:

- Replaced `import React from "react"` with `import type { ReactNode } from "react"`. The `React` default import was only needed for `React.ReactNode` in the props interface.

### `SidebarContextMenu.tsx`

**Size delta:** 56 → 57 lines (+1 line)
**Symbols renamed:** 1 (`React.ReactNode` → `ReactNode`)
**Files touched:** 1

Changes:

- Same React import tightening as `ResourceContextMenu.tsx`.

### `SmartFolders.tsx` (Antonini pass — no changes applied; handled by orchestrator above)

### `ResourceTreeIcons.tsx`

**Size delta:** 91 → 89 lines (−2 lines)
**Symbols renamed:** 0
**Files touched:** 1

Changes:

- Extracted the repeated `{ className?: string }` inline prop shape into a shared `type IconProps` applied to all four icon wrapper functions and the deprecated `FileIcon`.

### `buildResourceTree.ts`

**Size delta:** 106 → 104 lines (−2 lines)
**Symbols renamed:** 3 (`dataObject` → `tree`, `currentResource` → `resource`, `childResources` → `children`)
**Files touched:** 1

Changes:

- Renamed `dataObject` → `tree`, `currentResource` → `resource`, `childResources` → `children`.
- Lifted inner `addResourceToDataObject` to module scope as `addToTree`, passing `tree` and `allResources` as explicit parameters.

### `useResourceReorder.ts`

**Size delta:** 157 → 154 lines (−3 lines)
**Symbols renamed:** 2 (`updateData` → `reorderPayload`, `previous` → `acc`)
**Files touched:** 1

Changes:

- Renamed `updateData` → `reorderPayload` (unambiguous about what it carries).
- Renamed `previous` → `acc` in the `reduce` callback (conventional accumulator name).
- Renamed the `resource` finder lambda parameter to `r` to match terse style used elsewhere in the file.

---

## API routes (`frontend/app/api/resource/*` and `frontend/app/api/project-resources/*`)

**Total size delta across all 10 route files:** 1235 → 1071 lines (−164 lines, 13% smaller)
**Symbols renamed:** 0
**Files touched:** 10

### `resource/route.ts` (42 → 40 lines)

- Fixed import source: `next/dist/server/web/spec-extension/response` → `next/server`.
- Inlined `body` parse: single destructure from `(await req.json())` instead of intermediate variable.

### `[resource-id]/route.ts` (91 → 91 lines, structural improvement)

- Fixed redundant double-await: `await (await params)["resource-id"]` → `(await params)["resource-id"]`.
- `sidecar?.["name"]` → `sidecar?.name` (unnecessary bracket notation).

### `[resource-id]/rename/route.ts` (114 → 111 lines)

- Extracted `errorMessage(error, fallback)` helper to deduplicate the repeated `error instanceof Error ? error.message : fallback` pattern.
- Removed `RenameResourceResponse` and `ErrorResponse` single-use interfaces; widened return type to `Promise<NextResponse>`.
- Removed `{ status: 200 }` on successful `NextResponse.json` calls (200 is the default).

### `[resource-id]/delete/route.ts` (42 → 42 lines)

- Fixed `await (await params)` double-await.
- `sidecar?.["name"]` → `sidecar?.name`.

### `[resource-id]/sidecar/route.ts` (38 → 38 lines)

- Fixed `await (await params)` double-await.

### `[resource-id]/file/route.ts` (75 → 70 lines)

- `sidecar?.["file"]` → `sidecar?.file`.
- Simplified ENOENT guard: removed triple-check chain before the cast.

### `resource/upload/route.ts` (103 → 103 lines)

- Nothing meaningful to do; already clean.

### `resource/revision/[resource-id]/route.ts` (604 → 441 lines, 27% smaller)

- Removed per-handler `@param`/`@returns` JSDoc lines that only restated the obvious — module-level doc already documents all routes.
- Removed `GetRevisionResponse`, `SaveRevisionBody`, `DeleteRevisionBody`, `SetCanonicalRevisionBody` field-level JSDoc that restated the types.
- Removed the `deleteRevisionById` private helper — it called `listRevisions` a second time unnecessarily. Inlined the `fs.rm` call directly.

### `project-resources/route.ts` (65 → 74 lines, +9 lines — clarity improvement)

- Converted `getProjectResource` from sync to `async` using `fs/promises`, eliminating `fs.existsSync` / `fs.readFileSync` (sync I/O in an async route handler).
- Replaced `if (fs.existsSync(path)) { ... readFileSync ... }` pairs with `try/await fs.readFile/catch`.
- Removed comments that restated what the code below them does.

### `project-resources/excerpts/route.ts` (61 → 61 lines)

- Nothing meaningful to do; already clean.

---

## Test files fixed (gate-blocking baseline errors)

### `tests/unit/resource-templates-export.test.ts`

- Renamed `exists` → `isExisting` — fixes pre-existing `@typescript-eslint/naming-convention` error (boolean variables must have `is/has/should/can/did/will` prefix).

---

## Cross-file orchestrator work

No new cross-file helper files were created. The slice's cross-file "unification" goal was the headline data-vs-builder split of `resource-templates.ts`. The conservative approach was taken: safe structural improvements were applied (ensureDir inlining, dead-code removal, any-cast tightening) without forcing the three-branch `createResourceFromTemplate` unification, which is deferred.

The slice introduced no new knip findings — the knip output after the slice is identical to the pre-slice baseline.

---

## Gate result

| Check                                  | Result                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm typecheck`                       | PASS (0 errors — same as baseline)                                        |
| `pnpm exec vitest run <slice filters>` | PASS — 14 test files, 73 tests                                            |
| `pnpm lint` (slice files)              | PASS — no errors in any slice source file; 7 pre-existing errors resolved |
| `pnpm knip`                            | Pre-existing baseline failures only — no new findings introduced          |

Lint total: 411 problems (88 errors, 323 warnings) → 388 problems (81 errors, 307 warnings).

---

## Deferred

1. **`createResourceFromTemplate` three-branch unification** — the text/image/audio branches in `createResourceFromTemplate` share significant structure. A per-type config table (`ext`, `initialContent`, factory function) would collapse ~80 lines to ~30. Safe in principle but involves non-trivial restructuring with behavioral nuances (different filename extensions, different content defaults). Recommended as a targeted follow-up once characterization tests are added for this function.
2. **`import/no-anonymous-default-export` warnings** on `resource.ts`, `sidecar.ts`, `trash.ts`, `resource-templates.ts` (default export objects) — fixing would require assigning the object to a named const, which changes the module's `.name` property. Out of scope for this slice.
