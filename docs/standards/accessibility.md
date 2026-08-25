# Accessibility Standard

This document applies when building or changing any user-facing UI.

GetWrite is a tool people spend hours writing in. Accessibility here is not a
compliance exercise — long editing sessions, keyboard-driven navigation, and
readable type are the product.

---

## 1. Target

- **WCAG 2.1 AA** is the working target for user-facing surfaces.
- Both colour modes must meet it. A contrast fix that passes in light mode and
  fails in dark mode is not done.

---

## 2. Semantics First

- Every interactive element must be reachable by its **accessible role and
  name**. The existing a11y tests assert this way (`getByRole("button", { name })`),
  and new components are expected to be testable the same way.
- Prefer a native element over a div with handlers. A `<button>` is a button.
- Where a pattern is non-trivial — dialog, context menu, popover, tabs, listbox —
  use the Radix primitive already in the dependency tree rather than hand-rolling
  focus management and ARIA wiring.

---

## 3. Keyboard Operability

- Every action available by pointer must be reachable by keyboard.
- Focus must be visible, must not be trapped, and must return somewhere sensible
  when a dialog or menu closes.
- Respect the established global keys: `Esc` closes menus and modals,
  `Cmd/Ctrl + K` opens the resource palette. Do not rebind them locally.

---

## 4. Colour Is Never the Only Signal

- State conveyed by colour must also be conveyed by text, icon, or shape.
- Per STYLING.md, **red is reserved for position and canonical-state indicators**
  — never for actions or alerts. Do not introduce a second meaning for it.

---

## 5. Reading Comfort Is an Accessibility Concern

- Editor body line height stays at **1.8 or greater** (STYLING.md). This is a
  hard floor, not a default to tune down.
- Respect the reduced-motion preference; it is a real user setting, not decoration.

---

## 6. Testing

- Component-level accessibility tests live in `frontend/tests/a11y/` and are named
  `*.a11y.test.tsx` (see `docs/standards/testing.md`).
- Storybook runs `@storybook/addon-a11y`; a new component's story is expected to
  be clean under it.
- Editor-specific behaviour is covered by `frontend/e2e/editor-accessibility.e2e.spec.ts`.
- A new shared primitive under `components/common/UI/` should arrive with an
  a11y test, matching the fourteen that already exist.

---

## 7. When You Cannot Meet This

Say so in the feature spec's Out of Scope section with a reason. An unmet
accessibility requirement that is written down can be scheduled; one that is
silently skipped cannot.
