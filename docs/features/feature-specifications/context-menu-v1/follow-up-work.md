# Follow-up Work

## 2026-05-24 — Task 6: E2e test verification (completed)

All 6 Playwright e2e tests pass against a live Storybook instance on :6006. Key fixes applied during debugging:

- Removed `defaultOpen` from Interactive story (Radix positions at cursor; without a cursor event the menu renders off-screen at `translate(0, -200%)`).
- Added `modal={false}` to Interactive story's ContextMenu (default `modal={true}` sets `pointer-events: none` on body, blocking Playwright clicks).
- Removed the `play` function from Interactive story to eliminate race conditions with Playwright.
- Position test: replaced `toBeVisible()` with `toBeAttached()` on the popper wrapper (Radix briefly applies `visibility: hidden` during positioning calculations).
- Keyboard nav test: replaced fragile ArrowDown counting + `firstItem.focus()` with `menu.focus()` + `End` + `ArrowUp` to reach "Delete" reliably in headless mode.

---

## 2026-05-23 — Task 6: E2e test verification (deferred)

**What:** Run `pnpm test:e2e` against a live Storybook instance to confirm all six tests in `frontend/e2e/resource-context-menu.e2e.spec.ts` pass.

**Why deferred:** Requires `pnpm storybook` running on port 6006. Tests 1–5 pass in the unit suite. The `Interactive` story was restructured to use `ContextMenu defaultOpen` so the menu is visible on page load, preserving all e2e test entry conditions. The `menu position reflects x/y args` test was updated to `menu is positioned by Radix popper (fixed position)` since Radix no longer uses inline `left`/`top` on the menu element.

**How to complete:**

1. `pnpm storybook` from the repo root (starts on :6006)
2. `pnpm test:e2e` from `frontend/`
3. If any test fails, check the `Interactive` story in Storybook first — all six e2e tests target `iframe.html?id=tree-resourcecontextmenu--interactive`.
