# Chip Component — Implementation Tasks

Spec: `docs/features/feature-specifications/ui/reusable-chip-component/resuable-chip-compoent-spec.md`

---

### Task 1: Chip CSS classes

**What:** Adds all chip BEM classes to `getwrite-utilities.css` under `@layer components`.
**Files:** `frontend/styles/getwrite-utilities.css`
**Done when:** `getwrite-utilities.css` contains `.chip`, `.chip--sharp`, `.chip--rounded`, `.chip--sm`, `.chip--md`, `.chip--lg`, and `.chip__dismiss` with correct border-radius, font-size, padding, font-family (IBM Plex Mono), text-transform (uppercase), and letter-spacing (0.10em–0.14em) values per spec; no chip classes exist outside this file.
**Depends on:** none
**Estimate:** 2
**Done:** [x]

---

### Task 2: Core Chip component

**What:** Implements the `Chip` component skeleton covering label rendering, color prop, shape prop, size prop, and the span-vs-button conditional root element.
**Files:** `frontend/components/common/UI/Chip/Chip.tsx`, `frontend/components/common/UI/Chip/index.ts`
**Done when:** The component renders with `data-testid` or class-based verification showing: (a) label text appears; (b) `color` prop applies the value as both `borderColor` and `color` inline styles; (c) omitting `color` falls back to `--color-gw-border` / `--color-gw-secondary`; (d) `shape="sharp"` applies `.chip--sharp`, `shape="rounded"` applies `.chip--rounded`; (e) `size` applies the correct modifier class, defaulting to `.chip--md`; (f) passing `onClick` renders a `<button>`, omitting it renders a `<span>`; (g) `pnpm typecheck` passes with no new errors.
**Depends on:** Task 1
**Estimate:** 3
**Done:** [x]

---

### Task 3: Dismiss button

**What:** Adds the `onDismiss` prop to `Chip`, rendering an × button with correct ARIA label, focus ring, and propagation guard.
**Files:** `frontend/components/common/UI/Chip/Chip.tsx`
**Done when:** When `onDismiss` is provided a button element with `aria-label="Remove"` renders inside the chip to the right of the label; clicking it calls `onDismiss` and does not trigger an `onClick` on the chip root; keyboard focus on the button shows a visible focus ring (confirmed via Storybook visual or a11y addon); `pnpm typecheck` passes.
**Depends on:** Task 2
**Estimate:** 1
**Done:** [x]

---

### Task 4: Tooltip integration

**What:** Adds `tooltip` and `tooltipId` props to `Chip`, rendering a `react-tooltip` tooltip anchored to the chip when both are present.
**Files:** `frontend/components/common/UI/Chip/Chip.tsx`
**Done when:** When both `tooltip` and `tooltipId` are provided, a `<Tooltip>` from `react-tooltip` is rendered and hovering the chip in Storybook (or jsdom with pointer events) shows the tooltip text; omitting either prop renders no tooltip element; `pnpm typecheck` passes.
**Depends on:** Task 2
**Estimate:** 1
**Done:** [x]

---

### Task 5: Storybook stories and a11y verification

**What:** Produces a Storybook stories file covering all seven required scenarios with a11y checks passing.
**Files:** `frontend/stories/common/Chip.stories.tsx`
**Done when:** The stories file exports named stories for: Default, WithColor, SharpVsRounded, AllSizes, WithDismiss, WithTooltip, and InteractiveButton; `pnpm storybook` renders all seven without console errors; the `@storybook/addon-a11y` panel reports no violations on any story; keyboard Tab reaches the dismiss button and interactive chip in the WithDismiss and InteractiveButton stories.
**Depends on:** Task 3, Task 4
**Estimate:** 2
**Done:** [x]

---

## Summary

- Total tasks: 5
- Total estimated effort: 9
- Critical path: Task 1 → Task 2 → Task 3 → Task 5 (Tasks 3 and 4 are parallel; Task 3 has equal length to Task 4 so either can be on the critical path)
- Risks: Task 2 carries the most uncertainty — the span/button conditional root and inline-style color fallback to CSS vars need careful TypeScript typing and interaction testing. Task 5 depends on Tasks 3 and 4 both being complete before stories can demonstrate the full feature surface.
