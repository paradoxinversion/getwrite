# Quickstart: Using the Data Models

1. Open the spec: `specs/002-define-data-models/spec.md` to review shapes and invariants.
2. Review the TypeScript interfaces in `data-model.md`.
3. Implement models under `frontend/src/lib/models` and add unit tests under `frontend/src/tests/unit` using `vitest`.
4. Example commands:

```bash
# from repo root
pnpm install
pnpm -w -F frontend run test
```

5. Use `zod` to validate sidecar JSON files when loading projects. Ensure `maxRevisions` in project config defaults to 50.

## Integration notes

Quick reference for running the frontend model tests and validating model artifacts during development:

- Ensure Node version matches project expectations (tested with Node 22.16.0):

```bash
nvm use 22.16.0
```

- Install workspace deps and run the full frontend test suite (Vitest):

```bash
pnpm install
pnpm -w -F frontend run test
```

- Run a single test file (helpful when iterating on a model):

```bash
cd frontend
pnpm exec vitest run src/tests/unit/revision.test.ts --reporter verbose
```

- Runtime validation: the project provides `zod` schemas under `frontend/src/lib/models/schemas.ts`. Unit tests exercise these validators — expand tests under `frontend/src/tests/unit/` to cover new model invariants.

- Example sidecar JSON files demonstrating typical metadata shapes live in:
    - `specs/002-define-data-models/sidecar-examples/resource-title-page.meta.json`
    - `specs/002-define-data-models/sidecar-examples/resource-chapter-1.meta.json`
    - `specs/002-define-data-models/sidecar-examples/resource-image.meta.json`
    - `specs/002-define-data-models/sidecar-examples/resource-audio.meta.json`

These can be used as fixtures for integration tests or manual validation against the `zod` schemas.
