# ADR-009: Project Selection Separate from Resource Hydration

**Date:** 2026-05-13
**Status:** Accepted

## Context

Project selection and project content hydration represent different responsibilities. In normal usage, resources and folders should be populated only after a project is selected and loaded, keeping the flow simple and explicit.

## Decision

Project selection is handled separately from resource/folder population, with distinct dispatches after project load.

## Options Considered

1. Couple selection and all resource/folder population into one broader flow
   - Fewer explicit steps.
   - Blurs boundaries and makes data-availability timing harder to reason about.
2. Keep selection and hydration as distinct steps (chosen)
   - Preserves clear separation of concerns.
   - Keeps loading behavior explicit and easier to maintain.

## Trade-offs

- Some project-related rendering/manipulation flows require additional retrieval logic.

## Consequences

- Data flow is clearer and easier to reason about.
- Loading behavior aligns with local-first user actions.
- Certain cross-cutting flows need explicit integration logic when deeper project data is required.
