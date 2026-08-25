# ADR-010: Revision State Reset and Stale Result Guards

**Date:** 2026-05-13
**Status:** Accepted

## Context

Revision state must remain clean and aligned with the currently selected resource. Without safeguards, async responses from prior selections can apply after context has changed, risking incorrect or unrelated revision updates.

## Decision

When resource selection changes, revision state resets immediately, and stale async revision results are ignored using request/resource guard checks.

## Options Considered

1. Allow revision state and async responses to flow without strict reset/guard behavior
   - Fewer safeguards to implement.
   - Risks stale updates applying in the wrong resource context.
2. Reset on selection change and gate async results with staleness guards (chosen)
   - Keeps revision state aligned to current selection.
   - Prevents cross-resource update contamination.

## Trade-offs

- No major downsides were identified.
- Additional guard logic is accepted as a straightforward reliability safeguard.

## Consequences

- Revision behavior is safer under rapid selection changes.
- Async response handling remains predictable.
- Users are less likely to encounter accidental overwrites on unrelated resources.
