# Reusable Chip Component

**Status:** Implemented  
**Component path:** `frontend/components/common/UI/Chip`  
**Implementation note:** Use the `getwrite-component` skill.

---

## Overview

A reusable `Chip` component providing a compact, labeled UI element for surfacing metadata values, status indicators, and categorical tags across the application. Currently, chip-like surfaces (`metadata-sidebar-tag`, `start-page-chip`, `revision-control-badge`) are implemented as one-off component-scoped CSS classes rather than a shared primitive, making it difficult to maintain visual consistency and extend behavior. A canonical `Chip` eliminates that duplication and ensures all chip-like surfaces evolve together.

## Goals

- A single `Chip` component is sufficient for all current chip-like use cases
- Chips render in any caller-supplied CSS color
- Chips optionally display a dismiss button that fires a caller-supplied callback
- Chips optionally display a tooltip via `react-tooltip` on hover
- Both shape variants — hard-edged (`sharp`) and pill (`rounded`) — are available and visually distinct
- Three size variants (`sm`, `md`, `lg`) cover the full range of chip use cases, with `md` as the default

## Non-goals

- Migrating existing chip-like elements (`metadata-sidebar-tag`, `start-page-chip`, etc.) to use `Chip`
- Chip groups, chip input fields, or autocomplete-style multi-select behavior
- Animated chip enter/exit transitions

## User stories

- As a developer, I want to render a chip with a custom color so that I can surface categorical metadata without writing a new one-off style each time.
- As a developer, I want an optional dismiss button so that users can remove a chip without the parent managing custom close UI.
- As a user, I want to hover over a chip and see a tooltip so that I can understand abbreviated or truncated chip labels.
- As a developer, I want to choose between hard-edged and rounded shapes so that the chip fits its surrounding UI context.
- As a developer, I want to choose a chip size so that I can match the chip's visual weight to its surrounding content density.

## Functional requirements

1. The component must accept a `label` prop (string) and render it in IBM Plex Mono, uppercase, with letter-spacing matching the brand type scale (`0.10em`–`0.14em`).
2. The component must accept an optional `color` prop (any valid CSS color string). When provided, `color` sets the chip's border color and text color; background remains transparent. When omitted, the chip uses `--color-gw-border` and `--color-gw-secondary`.
3. The component must accept a `shape` prop (`"sharp" | "rounded"`). `sharp` must render with `border-radius: 0`; `rounded` must render with `border-radius: 9999px`.
4. The component must accept an optional `onDismiss` callback. When provided, an × icon button must render inside the chip to the right of the label.
5. The dismiss button must carry `aria-label="Remove"` and display a visible focus ring on keyboard focus.
6. The component must accept optional `tooltip` (string) and `tooltipId` (string) props. When both are present, the chip must render a `react-tooltip` tooltip anchored to itself.
7. The component must accept an optional `onClick` callback. When provided without `onDismiss`, the chip root element renders as a `<button>`. When omitted, it renders as a `<span>`. When both `onClick` and `onDismiss` are provided, the root renders as a non-interactive `<span>` containing a `chip__label-action` `<button>` for the label and a sibling dismiss `<button>` — this avoids nesting interactive controls (ARIA `nested-interactive` violation). The `onClick` and `onDismiss` handlers must not propagate to each other.
8. The component must accept a `size` prop (`"sm" | "md" | "lg"`) defaulting to `"md"`. Sizes must map to the following values:

   | Size | Font size | Padding    |
   | ---- | --------- | ---------- |
   | `sm` | 9px       | `2px 6px`  |
   | `md` | 10px      | `3px 8px`  |
   | `lg` | 12px      | `5px 12px` |

9. All chip CSS classes must live in `getwrite-utilities.css` under `@layer components`, following the existing BEM-like naming convention (e.g. `chip`, `chip--sharp`, `chip--rounded`, `chip--sm`, `chip--lg`, `chip__dismiss`).
10. The component must ship with a Storybook story demonstrating: default, with color, sharp vs rounded, all three sizes, with dismiss button, with tooltip, and as an interactive button.
11. The component must pass a11y checks: keyboard navigation reaches all interactive elements, focus rings are visible, the dismiss button is labeled.

## Open questions

None — all questions resolved prior to implementation.

| Question                 | Decision                                                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OQ-1: Color model        | Arbitrary CSS color string (`color?: string`); contrast is caller's responsibility                                                                                                                                                                                 |
| OQ-2: Shape semantics    | `sharp` = `border-radius: 0`; `rounded` = `border-radius: 9999px`                                                                                                                                                                                                  |
| OQ-3: Base interactivity | Chip renders as `<button>` when `onClick` is provided alone, `<span>` otherwise. When both `onClick` and `onDismiss` are present, root is a non-interactive `<span>` with sibling `chip__label-action` + dismiss buttons to satisfy ARIA nested-interactive rules. |
| OQ-4: Size variants      | Three sizes: `sm` (9px, 2/6px), `md` (10px, 3/8px, default), `lg` (12px, 5/12px)                                                                                                                                                                                   |

## Out of scope (deferred)

- Animated chip transitions (enter/exit)
- Chip group layout or multi-select input patterns
- Refactoring existing chip-like implementations (`metadata-sidebar-tag`, `start-page-chip`, `revision-control-badge`) to use this component
