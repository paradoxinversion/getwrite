Title: Define data models, add project-type validation, scaffolding fixes, and docs

Summary

This branch implements the data model foundation and related documentation needed to scaffold projects from JSON project-type specs and to support sidecar metadata and revision handling.

Key changes

- Runtime schema and validation
    - Added Zod-based project-type validation helpers in `frontend/src/lib/models/schemas.ts`.
    - Exported `validateProjectType()` and `validateProjectTypeFile()` for runtime use and tests.

- Scaffolding and runtime behavior
    - Updated `createProjectFromType()` in `frontend/src/lib/models/project-creator.ts` to load and validate specs (object or file path) before scaffolding.
    - Added defensive handling for name/folder slugification to avoid runtime errors when specs omit `folder` in `defaultResources`.

- Tests
    - Added unit tests for project-type validation: `frontend/src/tests/unit/project-type.test.ts`.
    - Adjusted project-creator test helper to exercise the file-path validation path.
    - Verified unit tests: all frontend unit tests pass locally (`pnpm run test`): 55 files, 103 tests passed, 1 skipped.

- Example templates and config
    - Added `getwrite-config/templates/project-types/example_custom.json` as a shipped runtime example template.
    - Updated `specs/002-define-data-models/tasks.md` to mark T018 complete and point to the `getwrite-config` location.

- Documentation
    - Added `docs/features/project-types.md` and `docs/features/sidecars.md`.
    - Added a data-types reference: `docs/features/data/data-types.md`.
    - Added root `README.md` summarizing the repo and dev instructions.

Why this matters

These changes centralize runtime validation of project-type specs, prevent a class of runtime errors during scaffolding, and provide clear documentation and example templates for contributors and users. It enables the CLI and UI scaffolding code to rely on well-defined, validated input and improves test coverage around model invariants.

Files changed (high level)

- frontend/src/lib/models/schemas.ts (added project-type zod schemas + validators)
- frontend/src/lib/models/project-creator.ts (validate specs before scaffolding; defensive slugify handling)
- frontend/src/tests/unit/project-type.test.ts (new)
- frontend/src/tests/unit/helpers/project-creator.ts (adjusted to pass spec-file path)
- getwrite-config/templates/project-types/example_custom.json (new)
- docs/features/project-types.md (new)
- docs/features/sidecars.md (new)
- docs/features/data/data-types.md (new)
- README.md (root, new)
- specs/002-define-data-models/tasks.md (updated T018)

Tests

- Local test run under Node 22.16.0 (nvm): `pnpm run test` — all tests pass.

Checklist for PR reviewers

- [ ] Confirm runtime validation logic in `schemas.ts` aligns with intended data model and acceptance criteria.
- [ ] Review `createProjectFromType()` changes — confirm error handling and fallback behavior are acceptable.
- [ ] Verify docs and example template placement: `getwrite-config/templates/project-types/` is intended runtime location.
- [ ] Run full test suite locally (see README `pnpm run test`).

Suggested reviewers

- @paradoxinversion (repo owner)
- Maintainers of frontend tests/components

Notes

- If we prefer stricter behavior, we can make `folder` required in `defaultResources` within the Zod schema and update example specs accordingly; current approach is intentionally permissive to avoid breaking existing example specs.
