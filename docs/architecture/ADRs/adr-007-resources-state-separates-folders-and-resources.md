# ADR-007: Resources State Separates Folders and Resources

**Date:** 2026-05-13
**Status:** Accepted

## Context

Resource state should stay simple and easy to reason about. Components need fast access to the currently selected resource, and folders are handled differently from non-folder resources in several flows.

## Decision

`resourcesSlice` keeps separate state for:

- `selectedResourceId`
- `resources` (non-folder resources)
- `folders`

## Options Considered

1. Store folders and non-folder resources in one unified collection
   - Simplifies one part of storage shape.
   - Requires repeated filtering and conditional logic because folders have different behavior.
2. Keep folders and non-folder resources separate (chosen)
   - Keeps read/write paths clearer for most component usage.
   - Avoids extra filtering in common flows.

## Trade-offs

- Some views (such as resource trees) require explicit composition logic to combine folders and non-folder resources.

## Consequences

- Most component-level resource access remains straightforward.
- Folder-specific behavior is easier to isolate.
- Combined views require additional merge logic, which is accepted as a reasonable cost.
