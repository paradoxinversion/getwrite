# ADR-011: Single Canonical Revision Enforced Client-Side

**Date:** 2026-05-13
**Status:** Accepted

## Context

A single canonical revision provides a clear mental model for users and developers and keeps diff behavior explicit. Revision flows also need protection against stale update application when resource context changes.

## Decision

Canonical revision selection is enforced client-side as exactly one active canonical entry, with stale PATCH-result protection to prevent outdated updates from applying.

## Options Considered

1. No revisions, with one source of truth only
   - Simpler state model.
   - Prevents users from reviewing how content changed over time.
2. Revisions with a single canonical entry and stale-update safeguards (chosen)
   - Preserves historical visibility and explicit diffing.
   - Maintains a clear active baseline.

## Trade-offs

- Additional logic is required to keep revision state clean, correctly updated, and easy to manipulate.

## Consequences

- Users have a consistent canonical baseline for comparison and workflows.
- Revision history remains usable for change tracking.
- Guard logic improves correctness under async update conditions.
