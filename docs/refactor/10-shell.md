# Slice 10 — Layout / Shell

**Risk:** 🔴 high — wires every feature together. Do near the end.
**~3.5k lines.** Layer: UI. Contains the single largest file in the codebase.

## Scope

- **UI:** `components/Layout/AppShell.tsx` (1637 ⚠️ largest file),
  `components/Layout/ShellModalCoordinator.tsx` (454),
  `components/Layout/ShellSettingsMenu.tsx` (239),
  `components/WorkArea/Views/*` (ViewSwitcher / Organizer entry),
  `app/` page entries (~860 across pages).

## Goal

`AppShell.tsx` (1637) is the top brevity target — almost certainly multiple
responsibilities (layout, routing of views, modal orchestration, keyboard) that can
be extracted into focused child controllers. `ShellModalCoordinator` overlaps and
should be considered together.

## Watch out for

- AppShell composes every other slice; extractions must preserve prop wiring and
  render order exactly. Do this **after** the domains it hosts are stable.
- Timeline gating logic is tested (`appShellTimelineGating`) — keep it intact.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  shellModalCoordinator appShellTimelineGating viewSwitcher
```

Then `pnpm knip` at repo root. A broad `pnpm exec vitest run` before merge is wise.
