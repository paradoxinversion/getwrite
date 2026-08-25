# Slice 04 — Metadata & Schema

**Risk:** 🟡 **~5.5k lines.** Layer: core + store + api + UI. Contains two of the
five >1000-line files.

## Scope

- **Core:** `metadata-schema.ts` (1095 ⚠️), `default-metadata-schema.ts` (35),
  `field-values.ts` (150)_ , `tags.ts` (261). _(field-values may also be claimed by
  slice 07; assign to whichever agent touches it first and note it.)\*
- **Store:** `metadata-schema-transport-service.ts` (302).
- **API:** `app/api/project/metadata-schema/route.ts` (464), `app/api/project/tags/*`.
- **UI:** `components/SchemaManager/` (1941 — `SchemaManager` 1151 ⚠️,
  `MigrationPreview` 358, `OptionsRemovalPreview` 320), `Sidebar/MetadataSidebar.tsx` (568),
  `Sidebar/AddFieldForm.tsx` (376), `Sidebar/controls/*`.

## Goal

`metadata-schema.ts` and `SchemaManager.tsx` are the two biggest brevity wins in the
codebase. Decompose by responsibility (field defs, migration, validation). The
migration/removal preview components likely share structure.

## Watch out for

- Schema migration changes user data — migration and validation behavior must be
  byte-identical. Characterization tests recommended before touching migration paths.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/metadata-schema-api unit/field-values unit/tags \
  schemaManager metadataSidebar add-field-form sidebarDynamicControls controls
```

Then `pnpm knip` at repo root.
