# Follow-up Work: Node Display

## 2026-06-12 — Footer text contrast (WCAG AA) — design-system debt

**Context:** During Task 2 (NodeTypeIndicator), running the Storybook a11y addon
in `"error"` mode surfaced a color-contrast violation:

- `text-gw-secondary` (light mode `#7a7870`) on `bg-gw-chrome` (light `#f5f4f0`)
  measures **4.01:1**, below WCAG AA's **4.5:1** for normal-size text.
- `#f5f4f0` is the real editor-footer background, so this reflects production,
  not a Storybook artifact.

**Why deferred:** This is a **pre-existing** deficiency. The shipping word-count
label in the editor footer (`EditView.tsx`) already uses
`text-gw-secondary text-gw-small` and has the same 4.01:1 contrast. Per spec
FR-7, `NodeTypeIndicator` intentionally matches the surrounding footer tokens, so
it inherits — but does not introduce — the issue. Decision (2026-06-12): keep the
Node Display at parity with the word count and leave the Storybook a11y addon in
`"todo"` mode (the repo's shipped default), rather than diverging one footer item
or changing the global token under this task.

**To address later (whole-footer or design-system scope, with design sign-off):**

- Option A — darken the footer text to a contrast-safe token (e.g. `text-gw-ink`
  ~13:1, or a darkened secondary) for **both** the word count and the Node
  Display, keeping them consistent. Scope: `EditView.tsx` footer only.
- Option B — raise `--color-gw-secondary-light` (e.g. `#7a7870` → ~`#67655e`,
  ~5:1) so every muted label app-wide meets AA. Scope: global token; affects all
  muted text; needs design review.
- If/when fixed, flip `.storybook/preview.tsx` `a11y.test` from `"todo"` to
  `"error"` to enforce it in CI.

**Verification note:** `.storybook/preview.tsx` was temporarily set to
`a11y.test: "error"` to obtain the measurement above, then reverted to `"todo"`.
All four NodeTypeIndicator stories render cleanly in Chromium; contrast is the
only finding.

## 2026-06-12 — Atom / non-text node selections show the placeholder

**Context:** During Task 3, `nodeAncestriesFromSelection` only emits labels for
**textblocks** (paragraph, heading, code block). Selecting a non-text leaf node
— a `GetWriteImage`, a block math node, or a table cell boundary — produces no
labelable block, so `deriveNodeTypeLabels` returns `[]` and the indicator shows
the neutral `—` placeholder rather than e.g. "Image" or "Equation".

**Why deferred:** Spec FR-2 enumerates only text node types (Body, Heading,
lists, blockquote, code block); images/equations are out of the current scope.
The placeholder is a reasonable, non-misleading fallback for v1.

**To address later (if desired):** extend the label table in `node-display.ts`
(e.g. `image` → "Image", `blockMath` → "Equation", `table` → "Table") and relax
the `isTextblock` filter in `nodeAncestriesFromSelection` to also capture
selected leaf/atom block nodes. No change needed to the indicator component.

## 2026-06-12 — Shared `<BrandedTooltip>` wrapper — optional consolidation

**Context:** `NodeTypeIndicator` was switched from a native `title` attribute to
`react-tooltip` for consistency with the rest of the app. As part of that, the
branded `TOOLTIP_STYLE` constant (previously duplicated in `Chip`) was extracted
to `components/common/UI/tooltipStyle.ts` and is now shared by `Chip` and
`NodeTypeIndicator`.

**What remains shared only at the style level:** each consumer still imports
`react-tooltip` directly and wires up its own `data-tooltip-id` /
`data-tooltip-content` anchor plus a co-located `<Tooltip>` (the pattern in
`Chip`, `MenuBar`, and `EditorMenuInput`). Only the _style_ is centralized.

**Why deferred:** Out of scope for the Node Display feature, and not worth a new
abstraction for the current handful of call sites. The duplication is the
boilerplate wiring, not the styling (which is now DRY).

**To address later (if tooltips proliferate):** introduce a thin
`<BrandedTooltip>` wrapper in `components/common/UI/` that bundles the
`react-tooltip` import, `TOOLTIP_STYLE`, and the anchor/`<Tooltip>` wiring behind
a small prop surface (e.g. `content`, `place`), then migrate `Chip`, `MenuBar`,
`EditorMenuInput`, and `NodeTypeIndicator` to it.
