# Slice 12 — Common UI primitives

**Risk:** 🟡 — imported broadly across UI slices. **~2k lines.** Layer: UI + toast utils.

## Scope

- **UI:** `components/common/UI/*` — `Tabs/Tabs.tsx` (160),
  `ContextMenu/EditContextMenu.tsx` (170), `common/UI/hooks/*`,
  shared modals/dialogs (`ConfirmDialog`, `Chip`, `CollapsibleSection`,
  `MenuItemButton`, `LabeledField`, `TagsManagerModal` 183).
- **Utils:** `lib/toast-service.ts` (130), `src/hooks/use-toast.ts` (45).

## Goal

These primitives are reused everywhere; small clarity wins propagate. Unify
controlled/uncontrolled value patterns (see `useSyncedControlledValue`).

## Watch out for

- Because every UI slice imports these, **freeze the prop contracts** — run the
  prop-contract-auditor. Changing a shared component's props is a cross-slice change.
- Ideally land **after** the UI domain slices so their usages are settled, or treat
  prop signatures as immutable.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/ui-foundation confirmDialog chip collapsibleSection menuItemButton \
  labeledField editContextMenu useSyncedControlledValue tagsManagerModal
```

Then `pnpm knip` at repo root.
