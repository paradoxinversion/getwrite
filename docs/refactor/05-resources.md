# Slice 05 — Resources / Templates / Trash

**Risk:** 🟡 **~4k lines.** Layer: core + store + api + UI. Contains a >1000-line file.

## Scope

- **Core:** `resource.ts` (42), `resource-factory.ts` (257), `resource-persistence.ts` (285),
  `resource-templates.ts` (1012 ⚠️), `template-service.ts` (95), `sidecar.ts` (128),
  `trash.ts` (293), `folder-utils.ts` (84).
- **Store:** `resourcesSlice.ts` (181).
- **API:** `app/api/resource/*` (id, rename, delete, sidecar, upload, file),
  `app/api/project-resources/*`.
- **UI:** `components/ResourceTree/` (1382 — `ResourceTree` 360, `CreateResourceModal` 268,
  `FolderTreePicker` 243).

## Goal

`resource-templates.ts` (1012) is the brevity target — likely large static
template literals + scaffolding logic that can be split (data vs builder).
ResourceTree context-menu / modal logic can be tightened.

## Watch out for

- Soft-delete preserves IDs and moves content + sidecar into `.trash/` — paths and
  ID preservation must not change.
- Template integrity standard (`docs/standards/template-integrity.md`): prefer
  minimal patch-style edits to template-derived data.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/resource-persistence unit/trash unit/template-service unit/builtin-templates \
  resources-slice-guards resourceTree createResourceModal renameResourceModal \
  folderTreePicker reorder-persistence nullify-resource-refs
```

Then `pnpm knip` at repo root.
