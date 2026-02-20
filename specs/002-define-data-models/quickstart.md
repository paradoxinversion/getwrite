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
