# ADR-014: Centralized Project Actions Controller

**Date:** 2026-05-13
**Status:** Accepted

## Context

Multi-step project operations touch multiple state domains and can drift when orchestration is spread across components. Centralizing these flows reduces the number of files that must change together and lowers the chance of missed updates.

## Decision

Multi-step project operations are centralized in a controller module rather than implemented independently in UI components.

## Options Considered

1. Component-level orchestration for each flow
   - Keeps logic local to each screen.
   - Increases duplication, raises mental overhead, and makes consistency harder to maintain.
2. Centralized controller orchestration (chosen)
   - Provides one place for cross-slice and multi-step operation flow.
   - Reduces drift risk and improves maintainability.

## Trade-offs

- No major downsides were identified at decision time.
- Introduces a dedicated orchestration layer that must remain clean and focused.

## Consequences

- Fewer files need coordinated updates for project operation changes.
- Operational behavior is easier to audit and reason about.
- Developer experience improves through clearer responsibility boundaries.
