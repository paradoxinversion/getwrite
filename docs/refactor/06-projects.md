# Slice 06 — Projects & Types

**Risk:** 🟡 **~6k lines.** Layer: core + store + api + UI. Contains a >1000-line file.

## Scope

- **Core:** `project-creator.ts` (346), `project-loader.ts` (100), `project-config.ts` (95),
  `projects-dir.ts` (15), `project.ts` (64), `project-view.ts` (22),
  `project-view-adapter.ts` (111), `project-features.ts` (110),
  `lib/projectTypes.ts` (169), `lib/user-preferences.ts` (304),
  `update-check.ts` (161), `update-notice-suppression.ts` (58).
- **Store:** `projectsSlice.ts` (1058 ⚠️), `project-actions-controller.ts` (115),
  `editorConfigSlice.ts` (61), `feature-config-transport-service.ts` (63),
  `update-check-transport-service.ts` (24).
- **API:** `app/api/project/*` (id, rename, delete, preferences, editor-config,
  features, revision-settings), `app/api/projects/*`, `app/api/project-types/`,
  `app/api/version-check/`.
- **UI:** `components/Start/` (1215), `components/project-types/` (1011),
  `components/preferences/` (1570).

## Goal

`projectsSlice.ts` (1058) is the brevity target — decompose by concern
(selection, metadata, reorder, lifecycle). `Start/` and `preferences/` share form
patterns worth unifying.

## Watch out for

- Project creation scaffolds the on-disk folder tree from a project-type spec —
  folder layout and default metadata must be unchanged.
- `projects-dir.ts` honors `GETWRITE_PROJECTS_DIR` (Electron) — keep that behavior.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/project-loader unit/project-config unit/project-type unit/project-types \
  unit/user-preferences unit/version-check-route projectFeatureToggles start \
  create-project-modal createProjectModal.error update-notice shellSettingsMenuVersion
```

Then `pnpm knip` at repo root.
