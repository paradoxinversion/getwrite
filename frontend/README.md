# frontend — GetWrite UI scaffold

This folder contains the UI-only frontend scaffold for the GetWrite feature. It includes a Next.js app, Storybook stories, Tailwind styling, and Vitest-based tests. The implementation is UI-only (placeholder data) and intended for component-first development.

Quickstart

1. Install dependencies

```bash
cd frontend
pnpm install
```

2. Start the Next.js development server

```bash
pnpm dev
```

3. Start Storybook (component development)

```bash
pnpm storybook
```

4. Run tests (unit/component)

```bash
pnpm test -- --run
```

Developer notes

- Node: tested with Node.js 22.x (use `nvm use 22.16.0` for CI parity)
- Package manager: `pnpm` (recommended)
- Storybook: configured with `@storybook/nextjs-vite` and `@storybook/addon-a11y`
- Tests: Vitest + Testing Library (run from `frontend/`)

Conventions

- Components live under `frontend/components/` and are developed with Storybook stories in `frontend/stories/`.
- Tests are under `frontend/tests/` and should remain fast and deterministic.
- Accessibility: aim for WCAG 2.1 AA; basic keyboard/focus behaviors are implemented in core components.

Useful commands

- `pnpm dev` — Next.js dev server
- `pnpm storybook` — Storybook UI for component development
- `pnpm build-storybook` — build static Storybook site
- `pnpm test` — run Vitest tests

If you need CI integration, prefer running tests from `frontend/` and pin Node to 22.16.0 to avoid Vite/Vitest ESM/CJS interop issues.

License & attribution
This scaffold is part of the GetWrite project and follows the repository license.

---

If you'd like, I can add a short troubleshooting section (node version, common test failures), or create a `frontend/CONTRIBUTING.md` with local dev tips.
