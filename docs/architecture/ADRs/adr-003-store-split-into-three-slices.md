# ADR-003: Store Split into Three Slices

**Date:** 2026-05-13
**Status:** Accepted

## Context

The Redux store is split into three slices: `projects`, `resources`, and `revisions`. These slices represent the core data that users interact with and modify most frequently. This structure is designed to keep state management simple and focused on the actual needs of the application, reflecting the main domains of user activity.

## Decision

The store will use three distinct slices:

- `projects`: Handles project selection and metadata
- `resources`: Manages resources and folder hierarchy
- `revisions`: Tracks revision/version history

This separation aligns with user interaction patterns and keeps logic for each domain isolated and maintainable.

## Options Considered

1. **Single slice for all state (e.g., `projectsSlice`)**
   - Would complicate logic for rendering and manipulating multiple projects and their resources/revisions.
   - Increases coupling and reduces clarity.
2. **Three-slice structure (chosen)**
   - Simple, clear, and matches how users interact with the app.
   - Each slice is responsible for a single domain, improving maintainability and testability.

## Trade-offs

- **Boilerplate**: Slightly more code required to set up and maintain multiple slices.
- **Complexity**: Minimal increase, outweighed by clarity and maintainability.

## Consequences

- State logic remains focused and easy to reason about.
- Adding new domains or features can follow the same pattern, supporting future growth.
- Boilerplate is manageable and does not outweigh the benefits of separation.

---

_Generated with @.github/prompts/write-adr.prompt.md_
