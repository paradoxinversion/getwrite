# Slice 08 — Editor (TipTap)

**Risk:** 🟡 **~3k lines.** Layer: UI + editor utils. Good early/leaf-ish slice.

## Scope

- **Utils:** `lib/tiptap-utils.ts` (69), `lib/node-display.ts` (121),
  `lib/node-display-selection.ts` (108), `lib/editor-heading-settings.ts` (204),
  `lib/editor-body-settings.ts` (55).
- **UI:** `components/TipTapEditor.tsx` (484), `components/Editor/*`
  (MenuBar: `EditorMenuInput` 195, `EditorMenuColorSubmenu` 187, …),
  `components/WorkArea/EditView.tsx` (405),
  `components/preferences/HeadingSettingsModal.tsx` (396).

## Goal

`TipTapEditor.tsx` and `EditView.tsx` are the brevity targets. MenuBar submenu
components likely share structure. Clarify the node-display selection logic.

## Watch out for

- Editor extension config, keymaps, and paste handling drive document behavior —
  verify via `tiptap-utils`, `list-keymap`, `normalizePastedHTML`, `editorMenuBar`
  tests. Editor body line-height (1.8+ min) is a brand invariant — don't regress it.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/tiptap-utils unit/list-keymap node-display node-display-selection \
  editorHeadingSettings editorMenuBar editView normalizePastedHTML \
  media-drop-extension markdownSourceToggle stripExternalColor
```

Then `pnpm knip` at repo root.
