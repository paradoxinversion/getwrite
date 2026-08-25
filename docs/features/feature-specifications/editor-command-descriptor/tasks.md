# Editor Command Descriptor — Task List

> **Status:** Implementation complete. One task remaining: parity tests against `useToolbarCommands`.

---

### Task 1: Write `useToolbarCommands` parity tests

**What:** Add Vitest unit tests that call `useToolbarCommands` directly with a mock editor/state and assert structural correctness of the resolved output.

**Files:** `frontend/tests/editorMenuBar.test.tsx` (add a new `describe` block to the existing file)

**Done when:**

- A test asserts `useToolbarCommands(...)` returns exactly `toolbarCommandSchema.length` groups
- A test asserts every command `id` in each group produces a `ResolvedToolbarItem` with the correct `kind` (matching the schema's `kind`)
- A test asserts `onClick` (icon), `onChange` (input), and `onSelectColor` (color-submenu) are `typeof === "function"` for every resolved item in the schema
- All three assertions pass under `pnpm test:ci`

**Depends on:** none (implementation is already complete)

**Estimate:** 2

**Notes:** `useToolbarCommands` is a `useMemo` hook — tests will need `renderHook` from `@testing-library/react`. The mock editor from `createEditorDouble` in the same file can be reused. The mock `MenuBarState` from `beforeEach` can be passed directly. The `setParagraphLeading` chain command is not in the existing mock — add it or keep the mock's `run()` generic (since parity is about structure, not command execution).

**Done:** [x]

---

## Summary

- Total tasks: 1
- Total estimated effort: 2 story points
- Critical path: Task 1 only
- Risks: None — implementation is complete, this is purely additive test coverage.
