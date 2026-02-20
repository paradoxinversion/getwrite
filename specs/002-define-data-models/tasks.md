# Implementation Tasks: Define Data Models (002-define-data-models)

Phase 1: Setup

- [x] T001 [P] Create models directory and index in `frontend/src/lib/models/index.ts`
- [x] T002 [P] Add runtime schema file `frontend/src/lib/models/schemas.ts` (use `zod`-style schemas)
- [x] T003 [P] Create unit test folder `frontend/src/tests/unit/models` and a placeholder test `frontend/src/tests/unit/models/index.test.ts`

Phase 2: Foundational

- [x] T004 [P] Implement UUID utility `frontend/src/lib/models/uuid.ts` (generate/validate UUID v4)
- [x] T005 [P] Implement sidecar read/write helpers `frontend/src/lib/models/sidecar.ts` (read/write `resource-<id>.meta.json`)
- [x] T006 Implement revision storage helper `frontend/src/lib/models/revisions.ts` (create path, list revisions, prune logic per `maxRevisions`)
    - Acceptance: `revisions.ts` exports a `selectPruneCandidates(resourceId, revisions, maxRevisions, options)` deterministic pure function that unit tests can call. Add unit tests that assert selection order, preservation tag handling, and behavior when only canonical remains.

Phase 3: User Story Implementation (priority order)

**User Story: Create a new project from a project type (Priority: P1)**

- [x] T007 [US1] Implement `Project` TypeScript model in `frontend/src/lib/models/project.ts`
- [x] T008 [P] [US1] Implement Project config and loader `frontend/src/lib/models/project-config.ts` (load `project.json`, apply defaults e.g., `maxRevisions: 50`)
- [x] T009 [US1] Implement project-creator that instantiates folder/resource placeholders from `specs/002-define-data-models/project-types/*` in `frontend/src/lib/models/project-creator.ts`
- [x] T010 [US1] Add unit tests for project creation `frontend/src/tests/unit/project.test.ts`

**User Story: Add and manage resources and revisions (Priority: P1)**

- [ ] T011 [US2] Implement `ResourceBase`, `TextResource`, `ImageResource`, `AudioResource` models in `frontend/src/lib/models/resource.ts`
- [ ] T012 [P] [US2] Implement `Revision` model and persistence in `frontend/src/lib/models/revision.ts`
- [ ] T013 [US2] Implement revision-manager `frontend/src/lib/models/revision-manager.ts` to create revisions, enforce `maxRevisions`, and set canonical revision
- [ ] T014 [US2] Add unit tests for revision invariants `frontend/src/tests/unit/revision.test.ts` (ensure canonical exists, prevents deleting canonical, prompt-delete behavior simulated)
- [ ] T014a Add unit tests for prune algorithm `frontend/src/tests/unit/revision-prune.test.ts` covering:
    - selection of oldest non-canonical revisions
    - skipping preserved revisions (`metadata.preserve=true`)
    - headless behavior when `autoPrune=true` and when `autoPrune=false` (abort)
- [ ] T015 [P] [US2] Implement TipTap/plain-text conversion helpers `frontend/src/lib/tiptap-utils.ts` (persist both `plainText` and `tiptap` forms)

**User Story: Modify or create Project Types (Priority: P2)**

- [ ] T016 [US3] Add project-type validator `specs/002-define-data-models/project-types/validate.ts` (validate `folders`, `defaultResources` schema)
- [ ] T017 [P] [US3] Add unit tests for project-type validation `frontend/src/tests/unit/project-type.test.ts`
- [ ] T018 [US3] Add example custom project-type `specs/002-define-data-models/project-types/example_custom.json`

Final Phase: Polish & Cross-Cutting Concerns

- [ ] T019 Update `specs/002-define-data-models/data-model.md` with links to implemented TypeScript files (docs)
- [ ] T020 Add example sidecar metadata files under `specs/002-define-data-models/project-types/` to demonstrate `resource-<id>.meta.json`
- [ ] T021 Add integration notes to `specs/002-define-data-models/quickstart.md` explaining how to run tests and validate models
- [ ] T022 Audit and remove remaining `any` types: ensure `data-model.md` and TypeScript model stubs use concrete types (e.g., `MetadataValue`, `TipTapDocument`) and add unit tests for TipTap conversion helpers

Additional Resource Features (proposed)

- [ ] T023 [US2] Tagging: Add project-scoped tagging and assignment APIs
    - Acceptance: Define `Tag` type and zod schema; implement CRUD operations to create/delete tags and assign/unassign tags to resources; persist tags in project config or `meta/tags.json`; provide `listResourcesByTag(tag)` helper; include unit tests verifying creation, assignment, and filtering.

- [ ] T024 [US2] Backlinks & Cross-Resource References
    - Acceptance: Provide an API `computeBacklinks(projectRoot)` that scans `plainText` and `tiptap` fields to produce a mapping `resourceId -> referencedResourceIds`; persist backlink index under `meta/backlinks.json`; add unit tests that assert backlinks are discovered and updated after edits.

- [ ] T025 [US2] Incremental Full-Text Indexing
    - Acceptance: Implement a per-project incremental inverted index stored in `meta/index/` with APIs `indexResource(resource)`, `removeResourceFromIndex(resourceId)`, and `search(query)` returning ranked result ids; index updates on resource save and revision creation; include unit tests verifying indexing and search correctness.

- [ ] T026 [US1] Soft-Delete / Recycle Bin
    - Acceptance: Implement `softDeleteResource(resourceId)` which moves resource files and sidecars to a `.trash/` subfolder preserving metadata; implement `restoreResource(resourceId)` and `purgeResource(resourceId)`; unit tests must verify restore preserves identity and purge permanently removes data.

- [ ] T027 [US1] Resource Templates & Duplication
    - Acceptance: Add `createResourceFromTemplate(templateId, overrides)` and `duplicateResource(resourceId)` helpers that clone metadata and initial revision while generating new identities; unit tests should validate metadata cloning and id uniqueness while preserving content.

- [ ] T028 [US2] Resource Previews (thumbnails & audio waveforms)
    - Acceptance: Add preview metadata generation APIs that produce lightweight preview artifacts (JSON thumbnails/waveforms) and persist them in `meta/previews/<resourceId>.json`; include unit tests that mock generation and verify preview metadata is written and retrievable.

Dependencies

- Foundational tasks (T004, T005, T006) must be completed before most model implementations (T007, T011, T012).
- Project creation tasks (T009) depend on project-config loader (T008) and project-type validation (T016).
- Revision-manager (T013) depends on revision persistence (T012) and sidecar helpers (T005).

Parallel Execution Examples

- Implementing schema/runtime-vs-types: `T002`, `T011`, and `T012` can run in parallel as they target different files and only require interface-level agreements.
- Tests can be authored in parallel with implementation: `T010`, `T014`, `T017` are parallelizable with the code tasks marked `[P]`.
- Sidecar helpers `T005` and UUID util `T004` are safe to implement in parallel.

Independent Test Criteria (per user story)

- **[US1]**: Given a `novel` project-type JSON, running the project-creator creates a project folder structure with `Workspace` first and creates declared default resources (unit tests pass and example project folder exists in temp dir).
- **[US2]**: Creating a resource produces at least one `Revision` file; adding a new revision above `maxRevisions` triggers prune flow (simulated in tests); canonical revision invariants hold across operations.
- **[US3]**: Editing or adding a `project-type` JSON is validated by the project-type validator; creating a project from the edited type reflects changes.

Suggested MVP Scope

- Implement only the core models and revision storage (T011, T012, T013, T014, T006) and the `novel` project-type creation (T007, T009, T010). This provides a working MVP: create project → add text resource → create revisions.

Implementation Strategy

- Start with small, well-tested TypeScript interfaces and zod runtime schemas to ensure both compile-time and runtime safety.
- Deliver minimal working functions for local filesystem read/write using existing project utilities; mock filesystem in unit tests where necessary.
- Iteratively extend project-types and examples after core invariants are validated by tests.

Task counts

- Total tasks: 21
- Tasks per user story: `US1` = 4, `US2` = 5 (+2 parallel helpers), `US3` = 3
