# ADR-012: Revision Normalization and Transport Service Separation

**Date:** 2026-05-13
**Status:** Accepted

## Context

Raw revision data structures are not ideal for direct UI/editor use. A normalized shape is easier to consume consistently across features such as diffing and revision views. Revision request handling also needs a single place to resolve project context and perform API calls to avoid duplicated logic.

## Decision

Revision records are normalized into a UI-facing `RevisionEntry` model, and revision API calls are isolated in a transport service that resolves project context from Redux state.

## Options Considered

1. Per-component processing of raw revision data
   - Keeps transformation close to usage sites.
   - Risks repeated or divergent logic, higher mental load, and inconsistent behavior.
2. Central normalization plus transport-service separation (chosen)
   - Provides a consistent data contract for UI features.
   - Centralizes request context resolution and API handling.

## Trade-offs

- Normalization logic must be maintained as raw revision structures evolve.
- Adds an additional abstraction layer that requires discipline to keep in sync.

## Consequences

- Revision-related UI features can rely on a stable, consistent model.
- API request behavior is easier to audit and update in one place.
- Maintenance requires coordinated updates when backend or persisted revision shape changes.
