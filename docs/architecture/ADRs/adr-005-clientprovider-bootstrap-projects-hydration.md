# ADR-005: ClientProvider Bootstraps Projects Hydration

**Date:** 2026-05-13
**Status:** Accepted

## Context

A clear, lightweight entry point was needed to provide Redux state to the app and perform initial store setup reliably. A dedicated provider component allows setup logic to evolve without scattering bootstrap behavior across the app shell.

## Decision

`ClientProvider` owns the initial `GET /api/projects` bootstrap and dispatches project hydration into the Redux store on mount.

## Options Considered

1. **Use Redux `Provider` directly with bootstrap logic elsewhere**
   - Simpler in file count, but spreads initialization concerns and makes startup flow harder to reason about.
2. **Use dedicated `ClientProvider` (chosen)**
   - Centralizes startup behavior in one place while keeping the wrapper intentionally lightweight.

## Trade-offs

- Adds one additional module to maintain.
- Minor maintenance overhead is outweighed by clearer initialization flow and easier future extension.

## Consequences

- Store initialization has a single, predictable entry point.
- Future startup requirements can be added without touching unrelated components.
- Developer experience remains strong because bootstrap concerns are centralized.
