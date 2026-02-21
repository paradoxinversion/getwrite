# GetWrite

GetWrite is a local-first writing workspace focused on structured projects, resource templates, and reproducible project scaffolding. This monorepo contains the frontend app, CLI tooling, specs, and documentation used to develop, test, and extend GetWrite.

## Quick links

- Docs: `docs/features` (project types, sidecars, data types)
- Specs examples: `specs/002-define-data-models/project-types/`
- Runtime templates: `getwrite-config/templates/project-types/`
- Frontend source: `frontend/src`

## Requirements

- Node.js >= 22.16.0 (we use nvm in CI/dev). If using nvm:

```bash
nvm use 22.16.0
```

- pnpm (preferred package manager). Install with npm if needed:

```bash
npm install -g pnpm
```

## Setup

1. Install dependencies (repo root):

```bash
pnpm install
```

2. Install frontend workspace dependencies (if working in `frontend` alone):

```bash
cd frontend
pnpm install
```

## Development

- Run frontend unit tests:

```bash
cd frontend
pnpm exec vitest
```

- Run the repo test task (runs frontend tests used by CI):

```bash
pnpm run test
```

- Start a local frontend dev server (when implemented / for app development):

```bash
cd frontend
pnpm run dev
```

## Project structure (high level)

- `frontend/` — Next.js frontend, components, tests, and runtime models
- `getwrite-config/` — example runtime configuration and templates shipped alongside the app
- `specs/` — specification artifacts and example project-type definitions used for docs and tests
- `docs/` — user- and developer-facing documentation (see `docs/features`)
- `src/cli/` and `dist-cli/` — CLI code and built CLI artifacts

## Runtime models & validation

Key model files live under `frontend/src/lib/models/`:

- `schemas.ts` — Zod runtime schemas and helpers (use `validateProjectType()` / `validateProjectTypeFile()`)
- `project-creator.ts` — scaffolding helper `createProjectFromType()` which validates specs and creates folders/resources
- `sidecar.ts` — read/write helpers for sidecar metadata

See `docs/features` for more detailed docs on project types, sidecars, and data types.

## Adding project-types and templates

- Examples and tests reference `specs/002-define-data-models/project-types/`.
- Runtime-discoverable templates belong in `getwrite-config/templates/project-types/`.
- When adding or changing project-type schemas, update `frontend/src/lib/models/schemas.ts` and add unit tests under `frontend/src/tests/unit`.

## Tests

- Unit & integration tests run with Vitest in the `frontend` workspace.
- The repository `pnpm run test` target executes the CI test runner for the frontend workspace.

## Contributing

- Open issues and PRs against the `002-define-data-models` branch for data model changes.
- Follow repository standards found under `standards/` (TypeScript implementation, package selection, template integrity).
- Run and update unit tests for any model/schema changes.

## Troubleshooting

- If tests fail due to Node version mismatch, run `nvm use 22.16.0`.
- Validation errors for project types include Zod error messages — use `validateProjectTypeFile()` locally to inspect problems.

## Where to look next

- `docs/features/project-types.md` — project-type spec guidance
- `docs/features/sidecars.md` — sidecar metadata guidance
- `docs/features/data/data-types.md` — data type reference

---

If you want, I can also open a PR for the docs and defensive changes made to the scaffolder.
