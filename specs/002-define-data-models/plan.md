````markdown
# Implementation Plan: Define Data Models (002-define-data-models)

**Branch**: `002-define-data-models` | **Date**: 2026-02-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `spec.md`

## Summary

Define strongly-typed TypeScript data models for Projects, Folders, Resources (Text, Image, Audio), Revisions, and Metadata. Provide example Project Type configuration files and sidecar metadata format. Produce docs (`research.md`, `data-model.md`, `quickstart.md`) and contract artifacts (`contracts/`) to enable implementation and tests. Text resources will save both plain-text and TipTap-compatible representations.

## Technical Context

- **Language/Version**: TypeScript (project uses Node/Next.js frontend)
- **Primary Dependencies**: none required for models; use `zod` or similar for runtime schema validation (RECOMMENDED)
- **Storage**: Local filesystem (project is local-first) — sidecar JSON + revision folders
- **Testing**: `vitest` for unit tests (existing project uses Vitest)
- **Target Platform**: Web frontend (Next.js) local-first projects
- **Project Type**: Single-page web app with local file-based project persistence
- **Performance Goals**: N/A for in-memory models; ensure model operations are synchronous and efficient for projects up to tens of thousands of small resources; revisit if large binary sets expected.
- **Constraints**: Offline-capable, local filesystem semantics, support binary resources (images/audio) and TipTap content for text resources.

## Deployment Checklist (MVP - local-first)

- Local storage only: ensure file layout documented and reversible.
- No server migrations required for this phase.
- Contract tests (unit + integration) required before wiring into UI.

## Constitution Check

All constitutional gates pass for Phase 0; testing standards require unit tests for all models and validation functions. Observability and performance SLOs deferred to later phases.

## Project Structure (feature artifacts)

``text
specs/002-define-data-models/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md (created by /speckit.tasks later)

```

### Source layout suggestion (existing repo is Next.js frontend)

``text
frontend/
└── src/
    ├── lib/
    │   └── models/       # TypeScript model definitions (Project, Folder, Resource, Revision)
    └── tests/
        └── unit/         # unit tests for models and validation
```

## Phase 0: Research (deliver `research.md`)

- Resolve open design choices (done): `maxRevisions=50` default, UUID v4 IDs + optional slug, sidecar JSON metadata, full-file revision storage, per-resource revisions folder layout.
- Recommend using `zod` for runtime validation and schema parsing; Vitest for tests.

## Phase 1: Design (deliver `data-model.md`, `contracts/`, `quickstart.md`)

1. Create `data-model.md` with TypeScript interfaces and JSON schema examples, including TipTap/plain-text variants for text resources.
2. Produce `contracts/` with minimal OpenAPI or JSON schema definitions for Project/Folder/Resource endpoints (used later for backend or language-agnostic contracts).
3. Provide `quickstart.md` describing how to consume the models in the frontend and run unit tests.

## Phase 2: Tasks (created by `/speckit.tasks`)

- Implement TypeScript models in `frontend/src/lib/models`
- Add unit tests under `frontend/src/tests/unit`
- Wire model validation into project creation flows (out of scope for this plan)

## Acceptance Criteria

- `data-model.md` contains complete interfaces for Projects, Folders, Resources, Revisions, and Metadata, including example sidecar JSON and TipTap/plain-text storage requirements.
- `research.md` documents decisions and rationale (resolving any NEEDS CLARIFICATION items).
- `contracts/` contains JSON schema or OpenAPI fragments for use in tests.
- A `quickstart.md` demonstrates how to run tests and validate models locally.
````
