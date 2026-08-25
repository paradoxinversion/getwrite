# ADR-002: Request-Then-Dispatch State Flow

**Date:** 2026-05-13
**Status:** Accepted

## Context

For v1 of GetWrite, all application logic is user-triggered and local. There is no hosted backend server, no pub/sub, and no requirement for real-time collaboration or optimistic UI updates. All state changes are performed in response to explicit user actions, and the Redux store is updated only after the corresponding local operation completes. This approach may be revisited in future versions if collaborative or multi-device features are introduced.

## Decision

State changes in GetWrite follow a request-then-dispatch flow:

- User actions trigger explicit requests (e.g., create, update, delete)
- The application performs the local operation (filesystem, etc.)
- Only after successful completion is the Redux store updated via dispatch
- There is no real-time sync, pub/sub, or optimistic update layer

## Options Considered

1. **Real-time sync/collaboration** — Not considered for v1, as the product is local-first and single-user only.
2. **Request-then-dispatch (current)** — Chosen for v1, as it fits the local-first, single-user model and avoids unnecessary complexity.

## Trade-offs

- **Pros:**
  - Simpler implementation for local-first, single-user use case
  - No risk of sync conflicts or race conditions
  - Predictable, explicit state transitions
- **Cons:**
  - Collaborative editing is not feasible in v1
  - No support for multi-device or real-time updates

## Consequences

- The architecture is simple and robust for v1's requirements
- Future support for collaboration or real-time sync will require architectural changes
- No optimistic UI updates; all state is confirmed before updating the Redux store

## Related

- See `/docs/standards/typescript-implementation.md` for state management patterns
- See `/docs/architecture/state-management.md` for further details
