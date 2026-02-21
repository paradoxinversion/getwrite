# Tasks: Implement Project Types Create Flow (Feature 003)

Feature: Integrate Project Types into Create Flow
Spec: [specs/003-add-project-types/spec.md](specs/003-add-project-types/spec.md)

Phase 1 — Setup

- [x] T001 Create `getwrite-config/templates/project-types` directory and add example template `getwrite-config/templates/project-types/novel_project_type.json`
- [x] T002 [P] Add sample Project Type JSON examples in `getwrite-config/templates/project-types/*.json`

Phase 2 — Foundational

- [x] T003 [P] [FOUND] Add Zod schema for Project Type templates in `frontend/src/lib/models/schemas.ts`
- [x] T004 Implement Project Type loader utility in `frontend/src/lib/projectTypes.ts` with exports `listProjectTypes()` and `getProjectType(id)`
- [x] T005 [P] Add unit tests for loader & schema in `frontend/tests/unit/project-types.spec.ts`
- [x] T006 Add contract test ensuring `createProjectFromType(name, projectTypeId)` returns a `Project` shape — satisfied by `frontend/src/tests/unit/project-creator.test.ts` (uses helper `createAndAssertProject` which calls `createProjectFromType` and validates the returned `project` via `validateProject`).

Phase 3 — User Stories (priority order)

User Story 1 - Create Project from Project Type (Priority: P1)

- [x] T007 [US1] Update `frontend/components/Start/CreateProjectModal.tsx` to load Project Types on modal open and render a dropdown with name/description
- [x] T008 [US1] Wire Create button in `frontend/components/Start/CreateProjectModal.tsx` to call `createProjectFromType(projectName, projectTypeId)` in `frontend/src/lib/models/project-creator.ts`
- [x] T009 [US1] Prevent double-submissions and show progress state in `frontend/components/Start/CreateProjectModal.tsx` (disable Create while creating)
- [x] T010 [P] [US1] Add integration/mocked test `frontend/tests/create-project-modal.spec.tsx` asserting the modal calls `createProjectFromType` and opens a project

User Story 2 - Resource Tree shows generated resources (Priority: P1)

- [ ] T011 [US2] Update `frontend/components/Tree/ResourceTree.tsx` to accept a persisted `Project` object and render folders/resources from that data
- [ ] T012 [P] [US2] Add unit tests `frontend/tests/unit/resource-tree.spec.ts` covering folder order and default resource presence
- [ ] T013 [US2] Ensure Resource Tree ordering follows `folders.orderIndex` or Project Type declaration; update data mapping in `frontend/src/lib/models/project-creator.ts` if needed

User Story 3 - Project Type selection UX & validation (Priority: P2)

- [ ] T014 [US3] Surface template validation errors in the modal; show user-friendly messages for missing `id` or `folders` (UI in `frontend/components/Start/CreateProjectModal.tsx`)
- [ ] T015 [P] [US3] Improve dropdown UX: add client-side search/filter and show `description` as secondary text in `frontend/components/Start/CreateProjectModal.tsx`
- [ ] T016 [US3] Add unit tests for invalid/malformed templates `frontend/tests/unit/project-type-validation.spec.ts`

Cross-cutting / Polish

- [ ] T017 [P] Add developer docs `specs/003-add-project-types/README.md` describing the JSON template format and examples
- [ ] T018 [P] Add accessibility tests for modal/dropdown (keyboard navigation) `frontend/tests/a11y/create-project-modal.a11y.ts`
- [ ] T019 Add error handling UX: toast/modal for IO or creation failures (`frontend/components/notifications/*` or `frontend/components/Start/CreateProjectModal.tsx`)
- [ ] T020 Create PR, request review, and address feedback (CI: run `pnpm exec vitest run` and Playwright tests where applicable)

Dependencies

- Story completion order: US1 → US2 → US3 (US1 creates persisted project that US2 renders; US3 is UX improvement and validation)
- Blocking tasks:
    - `T004` must be done before `T007`
    - `T006` (contract test) should be in place before heavy UI integration tests (`T010`, `T012`)

Parallel execution examples

- `T003`, `T005`, and `T017` are parallelizable (schema, unit tests, docs) — mark with `[P]`.
- `T011` (ResourceTree) and `T007` (modal UI) can be developed in parallel once `T004` (loader) exposes the types/shape.

Independent test criteria (per story)

- US1 Independent Test: Open Start → Create Project → choose Project Type → enter name → click Create → assert `createProjectFromType` invoked and UI opens new project (integration test `frontend/tests/integration/create-project-modal.spec.ts`).
- US2 Independent Test: Given a persisted `Project` from `createProjectFromType`, open Create Interface → Resource Tree shows top-level folders in correct order and default resources appear (`frontend/tests/unit/resource-tree.spec.ts`).
- US3 Independent Test: Select a malformed Project Type in dropdown → Create is disabled and a validation error is shown (`frontend/tests/unit/project-type-validation.spec.ts`).

Implementation strategy

- MVP first: implement loader (`T004`), modal wiring (`T007`/`T008`), and Resource Tree rendering (`T011`) so a minimal end-to-end flow works with one sample Project Type.
- Incrementally add tests and UX polish: validation (`T014`), search (`T015`), accessibility (`T018`), and docs (`T017`).
- Use mocks for `createProjectFromType` in UI tests while contract/unit tests validate the real implementation.

Files introduced/edited (summary)

- `frontend/src/lib/projectTypes.ts` (new)
- `frontend/src/lib/models/project-type-schema.ts` (new)
- `frontend/components/Start/CreateProjectModal.tsx` (edit)
- `frontend/src/lib/models/project-creator.ts` (verify/adjust)
- `frontend/components/Tree/ResourceTree.tsx` (edit)
- `frontend/tests/unit/*.spec.ts` and `frontend/tests/integration/*.spec.ts` (new tests)
- `specs/003-add-project-types/README.md` (new)

MVP scope recommendation

- Minimum deliverable (MVP): `T003`, `T004`, `T007`, `T008`, `T011`, and `T010` (loader, modal wiring, create call, Resource Tree rendering, and integration test).
