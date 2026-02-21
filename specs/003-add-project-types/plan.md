# Implementation Plan: Integrate Project Types into Create Flow

**Branch**: `003-add-project-types` | **Date**: 2026-02-21 | **Spec**: [specs/003-add-project-types/spec.md](specs/003-add-project-types/spec.md)
**Input**: Feature specification from `/specs/003-add-project-types/spec.md`

## Summary

Add Project Type selection into the Create Project modal and wire creation to `createProjectFromType`. Project Type templates are JSON files under `getwrite-config/templates/project-types`. When a user creates a project the UI will call `createProjectFromType(name, projectTypeId)` and open the returned persisted project; `ResourceTree` will render the created project's folders and resources instead of placeholder data.

## Technical Context

**Language/Version**: TypeScript (Node/Next.js + React)  
**Primary Dependencies**: React, Next.js, Vitest (tests), TipTap (editor), Zod (validation)  
**Storage**: Local filesystem persistence via `createProjectFromType` (existing model code)  
**Testing**: `vitest` for unit tests, Playwright for E2E where available  
**Target Platform**: Web (frontend) — desktop-first responsive  
**Project Type**: Web application (frontend changes only)  
**Performance Goals**: Project Type list should load within ~2s on typical dev machine; project creation UI should open the new project within ~3s after Create click (manual QA targets).  
**Constraints**: Must be offline-capable (local-file persistence), keep UX responsive (do work off main thread if parsing becomes heavy).  
**Scale/Scope**: Single-user/local project creation; number of project types typically small (dozens)

## Deployment Checklist (web apps)

- This change is frontend-only and modifies local-first project creation flows. No server infra changes required.
- Smoke tests: add unit tests for Project Type parsing and contract tests for `createProjectFromType` usage.
- Rollback: revert branch or disable modal change if regressions found.

## Constitution Check

Gates (must be satisfied):

- Testing: Unit tests for parsing/validation and a contract-level test for `createProjectFromType` (vitest).
- Accessibility: Dropdown and modal must be keyboard operable and plan includes basic accessibility verification (tab order, labels).
- MVP Simplicity: Implementation will be incremental — start with modal-open parsing and session cache.

Status: PASS — planned work includes unit tests, basic accessibility checks, and keeps persistence local per constitution.

## Project Structure

Documentation added to: `specs/003-add-project-types/` (plan.md, research.md, data-model.md, quickstart.md, contracts/openapi.yaml)

Source changes (primary files to edit):

- `frontend/components/Start/CreateProjectModal.tsx` — add Project Type dropdown, load templates, validate selection, call `createProjectFromType`.
- `frontend/src/lib/models/project-creator.ts` — ensure `createProjectFromType(name, projectTypeId)` returns a persisted `Project` shape (or adapt in tests/mocks).
- `frontend/components/Tree/ResourceTree.tsx` — accept `Project` data and render created folders/resources instead of placeholder items.
- `frontend/src/lib/models/schemas.ts` or `frontend/src/lib/models/*` — add JSON schema/Zod validators for Project Type templates.
- Tests: `frontend/tests/unit/project-type.spec.ts`, contract tests mocking `createProjectFromType`.

**Structure Decision**: Work inside existing `frontend/` app (no backend changes). All new tests and helpers live under `frontend/tests` and `frontend/src/lib/models`.

## Phase Plan

Phase 0 — Research (complete):

- Decisions recorded in `research.md`: JSON-only templates; parse on modal open and cache; `createProjectFromType` contract returns persisted `Project`.

Phase 1 — Design & Contracts (deliverables created):

- `data-model.md` (canonical TS interfaces) — created and references `specs/002-define-data-models/data-model.md`.
- `contracts/openapi.yaml` — lightweight contract for create endpoint/behavior.
- `quickstart.md` — developer usage notes.

Phase 2 — Implementation (tasks):

1. Add Project Type loader utility

- Implement `frontend/src/lib/projectTypes.ts` (or similar) to read JSON files from `getwrite-config/templates/project-types`, parse with Zod, and cache results.
- Expose `listProjectTypes(): Promise<ProjectType[]>` and `getProjectType(id): Promise<ProjectType | undefined>`.

2. Update Create Project modal

- Edit `frontend/components/Start/CreateProjectModal.tsx` to call `listProjectTypes()` on modal open, display a searchable dropdown with name/description, validate selection, and prevent Create on invalid template.
- Disable Create button while creation is in progress and prevent double submissions.

3. Ensure `createProjectFromType` contract

- Confirm `frontend/src/lib/models/project-creator.ts` exports `createProjectFromType(name, projectTypeId): Promise<Project>` that returns a persisted project scaffold. Add/update unit tests to assert return shape.

4. Wire ResourceTree to created project

- Update `frontend/components/Tree/ResourceTree.tsx` to accept `Project` data from global app state or creation callback and render real folders/resources.
- Ensure tree ordering follows `folders.orderIndex` or declaration order.

5. Validation & Error handling

- Add Zod schemas for Project Type templates and surface friendly errors in UI.
- On creation failure, show error toast/modal and rollback UI state.

6. Tests

- Unit tests for `projectTypes` loader and validators.
- Unit/contract tests for `createProjectFromType` invocation from modal (mock backend/model where necessary).
- Accessibility check: keyboard navigation tests for modal and dropdown.

7. Documentation

- Update `quickstart.md` and add brief README for `getwrite-config/templates/project-types` format/examples.

Phase 3 — Review & Merge

- Peer review PR, run unit and E2E tests, address feedback, and merge. Optionally push branch and create PR for review.

## Estimates & Milestones

- Phase 2 implementation: 1–2 days of focused work (edit modal, loader, tree wiring, tests).
- Code review and fixups: 0.5–1 day.

## Risks & Mitigations

- Risk: Parsing many large templates could block the UI. Mitigation: parse on a worker or debounce parsing; cache results.
- Risk: `createProjectFromType` contract mismatch. Mitigation: add contract tests and iterate on model implementation; mock in UI tests.

## Next Actions

1. Begin Phase 2 — implement `projectTypes` loader and unit tests.
2. Implement modal changes and connect to `createProjectFromType`.
3. Update `ResourceTree` to render created project resources.
