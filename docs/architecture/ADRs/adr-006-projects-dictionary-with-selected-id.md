# ADR-006: Projects Dictionary with Selected Project ID

**Date:** 2026-05-13
**Status:** Accepted

## Context

Users need to switch between projects quickly, and active-project logic should stay simple and predictable. Keeping minimal metadata for all projects in memory supports efficient rendering and manipulation on the start page, including rename, delete, and packaging operations.

## Decision

The projects store keeps:

- an ID-keyed projects dictionary for known projects
- a separate selectedProjectId for the currently active project

## Options Considered

1. Keep only one project in store at a time
   - Reduces in-memory project metadata.
   - Increases complexity for rendering and manipulating multiple projects on the start page.
2. Keep projects dictionary plus selectedProjectId (chosen)
   - Supports fast switching and straightforward active-project logic.
   - Keeps multi-project UI operations simple.

## Trade-offs

- Project-related data such as resources and revisions is not fully present in this slice and must be fetched separately when needed.

## Consequences

- Start-page flows are simpler and easier to maintain.
- Active project handling remains explicit and low-friction.
- Additional retrieval steps are required when deeper project data is needed.
