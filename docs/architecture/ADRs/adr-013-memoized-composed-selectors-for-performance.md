# ADR-013: Memoized and Composed Selectors for Performance

**Date:** 2026-05-13
**Status:** Accepted

## Context

Selector composition and memoization were chosen to keep the UI responsive by reducing unnecessary rerenders. Mixed views such as resource trees also require combining folder and non-folder resource data in a repeatable way.

## Decision

Selector logic is centralized, memoized, and composed, including selectors that combine folders and non-folder resources for shared consumption.

## Options Considered

1. Combine and transform data in each consuming component
   - Keeps logic close to usage.
   - Increases duplication and maintenance burden, and can lead to inconsistent behavior.
2. Centralized memoized/composed selectors (chosen)
   - Reduces duplication and supports consistent derivation patterns.
   - Improves performance by limiting recomputation and rerenders.

## Trade-offs

- Additional code and conventions are required.
- Teams must follow selector patterns consistently for benefits to hold.

## Consequences

- Better rendering efficiency in data-heavy or mixed-resource views.
- Shared selector logic is easier to reason about and test.
- Some upfront complexity is accepted in exchange for predictable performance and maintainability.
