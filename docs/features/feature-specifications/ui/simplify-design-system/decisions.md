# Simplify Design System — Decisions

**Date:** 2026-05-19
**Status:** Proposed (awaiting ratification)
**Inputs:** [`simplify-design-system-spec.md`](./simplify-design-system-spec.md) · [`audit.md`](./audit.md) · [`tasks.md`](./tasks.md)

This document resolves the spec's three open questions plus one additional question the audit surfaced. Each decision uses the project's ADR Context / Decision / Consequences shape so it can be lifted into `docs/architecture/ADRs/` later if it proves load-bearing.

---

## Decision 1 — shadcn distribution path

**Question (from spec):** CLI-generated vs. hand-ported?

**Context.** The project doesn't currently use shadcn. shadcn ships components in two consumption modes:

1. **CLI-generated** — the `shadcn` CLI reads a `components.json` config and emits source files into a configured directory. New components are added with `pnpm dlx shadcn add <name>`. Files are owned by the consumer (no runtime dependency on a shadcn package).
2. **Hand-ported** — copy files from the shadcn registry by hand into the project. No `components.json`, no CLI.

Both paths produce the same source code; the difference is workflow.

**Decision.** Use the **CLI**, with `components.json` aliased to `frontend/components/common/UI/` (see Decision 2). Install `class-variance-authority`, `clsx`, and `tailwind-merge` (shadcn's runtime helpers) as direct dependencies. Files written by the CLI are committed and edited freely — shadcn does not own them after generation.

**Why.** The CLI is the lower-friction long-term mode: adding a new primitive in a future phase is one command. The alias mechanism (`components.json` → `aliases.components`) means we get the CLI's ergonomics _and_ the directory layout we want. Hand-porting buys us nothing the CLI doesn't already offer, and forfeits the future ergonomic win.

**Consequences.**

- `frontend/package.json` gains `class-variance-authority`, `clsx`, `tailwind-merge`. No `shadcn` runtime dependency.
- `frontend/components.json` is created; it pins the alias and the Tailwind/CSS variable conventions.
- A `cn()` helper lives at `frontend/components/common/UI/utils.ts` (shadcn convention) — used by every primitive.

---

## Decision 2 — Primitives directory

**Question (from spec):** `components/common/UI/` (existing `Chip` precedent) or new `components/ui/` root?

**Context.** Today's only shared primitive (`Chip`) lives at `frontend/components/common/UI/Chip/`. The shadcn CLI defaults to `components/ui/` at the project root.

**Decision.** **`frontend/components/common/UI/<Primitive>/`** — extends the existing precedent. Configure `components.json`:

```json
{
  "aliases": {
    "components": "components/common/UI",
    "utils": "components/common/UI/utils"
  }
}
```

**Why.**

- Zero import churn for the one existing primitive (`Chip`) and its consumer.
- Keeps the visual-design layer co-located with other shared `common/` modules (`MenuItemButton`, modal frames, etc., before their migration).
- The cost of the alternative (`components/ui/`) is a global rename for trivial benefit — shadcn's default path is not load-bearing.

**Consequences.**

- All primitive imports are `from "@/components/common/UI/<Name>/<Name>"` (or relative equivalents).
- `Chip` stays in place — Task 9 extends it in-situ rather than relocating it.
- Test files (`*.test.tsx`, `*.stories.tsx`) live alongside each primitive (matches existing `Chip` layout: `Chip.tsx` + `index.ts`).

---

## Decision 3 — Migration threshold

**Question (from spec):** What occurrence count makes a primitive worth migrating?

**Context.** The audit found ranges from 117 occurrences (Button) down to 5 (Chip parallel CSS systems). Below some threshold, the migration cost exceeds the LOC savings; above it, the duplication clearly justifies a primitive.

**Decision.** Phase-one migration target: **≥ 10 occurrences across ≥ 3 files**. Below this bar, leave the implementation alone for phase one. Tie-breaker for borderline categories: if the same visual concept already exists in a shared primitive (e.g. `Chip`), adopt it regardless of count, because the marginal cost is low and consistency wins are large.

**Why.**

- Drawing the line at 10/3 keeps every category the audit ranked top-six in scope (Button, Dialog, Card, Input family, section-merge, Chip adoption) and excludes Timeline-specific visuals (3 occurrences) and one-offs.
- The "shared primitive already exists" tiebreaker captures `Chip` adoption (5 callsites, but a primitive already exists) without changing the headline rule.

**Consequences.**

- `appshell-topbar-button` (4 occurrences) **is** migrated — it's part of the Button category total (117), not a separate category.
- `TimelineChip` (3 occurrences) **is not** migrated; it stays a separate component.
- `ViewSwitcher` (1 occurrence) **is not** migrated — single use, no duplication.
- Adding a new primitive in phase two means re-running the audit and re-checking the threshold; this doc does not gate phase-two scope.

---

## Decision 4 — CSS-class buttons (audit-surfaced)

**Question (from audit § 1):** Buttons styled via global CSS classes (`appshell-topbar-button`, `project-modal-button-{primary,secondary}`, `project-type-editor-action-button`, `compile-modal-generate-button`, `timeline-zoom-btn`, etc.) — fold into Tailwind-styled `Button` variants, or keep the CSS rules and pass them through `Button`'s `className` prop?

**Context.** The codebase has 14+ buttons whose styling lives in global CSS files, not in Tailwind classes. They predate the brand-token migration. Tasks 4 and 6 explicitly need to make this call.

**Decision.** **Absorb into Tailwind-styled `Button` / `Card` variants and delete the CSS rules.** Do not provide a `className`-passthrough escape hatch in the primitives' public API beyond what shadcn's default `cn(className)` merge supports.

**Why.**

- FR 8 of the spec: brand tokens are the single source of styling truth. Two parallel styling layers (Tailwind variants + global CSS rules) violate that.
- An escape hatch invites callers to bypass the primitive's variant system, which is exactly the kind of drift this whole feature is trying to remove.
- The blast radius is manageable — the audit lists the exact callers per CSS class.

**Consequences.**

- Tasks 4 and 6 delete CSS rules from the global stylesheets (`frontend/styles/*.css`) as part of each migration. Add to each task's done-when: "the CSS rule is deleted, and no remaining usage exists outside primitive files."
- Risk: a stylesheet rule might be referenced from non-component code (CLI tooling, generated output, Storybook test artifacts). **Mitigation:** grep both `frontend/` and `frontend/src/` for the class name before deletion, not just `frontend/components/`. Added to Task 4 risk notes in tasks.md.
- Genuine one-off overrides (e.g. a single button needs `mt-6` in one layout) still flow through `className` because shadcn primitives compose with `cn()` — but they don't reintroduce the "all styling lives in a CSS class" pattern.

---

## Phase-one migration scope (canonical for Tasks 4–10)

Restated from the audit so Tasks 4–10 can reference one place:

| Task | Primitive / Action                                                                                              | Source category in audit | Estimated LOC saved |
| ---- | --------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------: |
| 4    | `Button` (default / outline / ghost / icon variants)                                                            | § 1 Button               |                ~300 |
| 5    | `Dialog` (replaces `ModalOverlayShell`, `ProjectModalFrame`, `ConfirmDialog`'s overlay, inline `fixed inset-0`) | § 2 Dialog / Modal       |                ~400 |
| 6    | `Card` (chrome / chrome2 background, padding presets)                                                           | § 3 Card / Surface       |                ~150 |
| 7    | `Input` / `Textarea` / `Select` / `Checkbox`                                                                    | § 4 Inputs               |                ~150 |
| 8    | Merge `SidebarSection` + `CollapsibleSection`                                                                   | § 5                      |                 ~60 |
| 9    | Adopt existing `Chip` in `TagsSection`, `SearchBar`, `SearchFilterPanel`                                        | § 6                      |                 ~80 |
| 10   | `Toaster.tsx` token sweep + `TimelineTooltip` `#D44040` cleanup + general hex sweep                             | § 7 + § Baseline         |                 ~15 |

**Total projected savings:** ~1155 LOC across phase one. Spec goal of ≥ 30% reduction in targeted categories is comfortably clear.

**Explicit out-of-scope for phase one** (see audit "Deferred" section and tasks.md "Deferred" section):

- `MenuItem` migration (originally Task 7) — `MenuItemButton` already consolidated; container behavior is a hook concern, deferred.
- `TimelineChip`, `timeline-zoom-btn`, timeline cards — visually unique, ROI too low.
- Specialized inputs (`SearchBar` autocomplete, `ResourceCommandPalette`, `POVAutocomplete`, `MultiResourceRefInput`).
- `ViewSwitcher` → shadcn `Tabs`.
- TipTap editor menu bar (spec non-goal).
