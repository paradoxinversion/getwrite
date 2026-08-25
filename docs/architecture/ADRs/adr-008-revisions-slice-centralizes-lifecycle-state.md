# ADR-008: Revisions Slice Centralizes Lifecycle State

**Date:** 2026-05-13
**Status:** Accepted

## Context

Revision behavior should be easy to reason about and implemented consistently. Centralizing revision list state and request lifecycle flags in one slice keeps development focused and avoids fragmented handling across components.

## Decision

`revisionsSlice` owns revision list data and related lifecycle flags (loading, saving, fetching, deleting, and error state).

## Options Considered

1. Distribute revision state and lifecycle handling across components
   - Can reduce slice responsibilities.
   - Risks inconsistent behavior and higher mental load.
2. Centralize revision state and lifecycle in `revisionsSlice` (chosen)
   - Keeps revision behavior consistent and straightforward.
   - Aligns with the existing domain-slice pattern.

## Trade-offs

- No major downsides were identified at decision time.
- Centralized ownership was considered the most direct and maintainable approach.

## Consequences

- Revision behavior is easier to maintain and audit.
- Async lifecycle handling is consistent across revision operations.
- Future revision features have a clear extension point.
