# Software Testing Standard

This document applies when running or writing tests.

---

## 1. Environment

- Working directory must be the repo root for all test commands

---

## 2. Commands

| Mode                | Command                                     |
| ------------------- | ------------------------------------------- |
| Watch (development) | `pnpm test`                                 |
| CI / single pass    | `pnpm test:ci`                              |
| Targeted by file    | `pnpm test:ci <filename-without-extension>` |
| E2E                 | `pnpm test:e2e`                             |

- E2E tests require Storybook running on port 6006; start with `pnpm storybook` before running `pnpm test:e2e`

---

## 3. Test File Locations

- Unit / integration / component / a11y: `tests/`
- E2E: `e2e/`

### Naming Policy

- Vitest files: `*.test.ts` / `*.test.tsx`
- Accessibility-focused Vitest files: `*.a11y.test.tsx`
- Playwright files: `*.e2e.spec.ts`
- `__tests__` directories are not allowed

---

## 4. Scope

- Unit tests: models, schemas, utilities
- Component tests: UI components in isolation
- E2E tests: full user flows against Storybook

### Component Tests

Component tests verify rendered React component behavior in isolation.

- **Location**: `tests/*.test.tsx`
- **Framework**: React Testing Library + Vitest
- **What to test**:
  - Component renders correctly given props
  - User interactions (click, input, keyboard) produce expected DOM changes
  - Conditional rendering (loading states, empty states, error states)
- **What not to test**:
  - Redux slice internals — test those as unit tests in `tests/unit/`
  - Filesystem operations — those belong in model unit tests
  - Full navigation flows — those belong in E2E tests
