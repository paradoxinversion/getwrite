# Slice 11 — Timeline

**Risk:** 🟢 low — self-contained feature. Good early/calibration slice.
**~1.2k lines.** Layer: UI.

## Scope

- **UI:** `components/Timeline/` — `Timeline.tsx` (439), `TimelineRow.tsx` (292),
  `TimelineTooltip.tsx` (176), plus the view toggle.

## Goal

Tighten `Timeline.tsx` and row rendering; unify tooltip/row date-formatting helpers.

## Watch out for

- Visibility/gating of the Timeline view is enforced in AppShell (slice 10) — don't
  duplicate or move that logic here.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  timelineTooltip timelineViewToggle timelineView unit/timelineUtils
```

Then `pnpm knip` at repo root.
