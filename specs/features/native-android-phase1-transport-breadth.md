# ADR-021 Phase 1 — Transport Breadth (Generalized In-Process Collapse)

## Overview

Phase 0 proved the transport-collapse seam end-to-end on a real device, but
only for one path: search. That proof lives as a bespoke structure
(`runtime.ts` + a hand-written `SearchTransport` interface + a dynamically
imported native backend) in `frontend/src/store/transport/`. The rest of the
app's data layer — revisions, saved queries, metadata schemas, feature
flags, hosted-auth status, and update checks — still only works over HTTP,
which means none of it functions in the native, server-less Android runtime.
Phase 1 generalizes the search seam into one reusable mechanism and applies
it to the remaining six `*-transport-service.ts` files, so the app's full
data layer — not just search — runs in-process on native.

## Goals

- One reusable transport-collapse helper exists and is the sole mechanism
  used by all seven transport services (search plus the six from this
  phase) — no bespoke per-service HTTP/native switching structure remains.
- Revision, query, metadata-schema, and feature-config each have a
  transport-agnostic operation core, reused unmodified by both their
  existing HTTP route and a new in-process native backend.
- Auth-status and update-check return correct native short-circuit values
  (`{ hostedAuthActive: false }` and a no-update result, respectively) on
  the native runtime, without core-lifting or a server dependency.
- Hosted/desktop behavior and build output are provably unchanged: every
  existing HTTP route, its tests, and `pnpm build` output remain exactly as
  they were before this phase.
- Native code for all seven services stays out of the web bundle, preserving
  the dynamic-import discipline proven in Phase 0.

## Non-goals

- Full-app WebView wiring against real built frontend assets, or
  media/base64 handling at scale (Phase 2).
- Android signing, packaging, or Play Store submission (Phase 3).
- Any change to the on-device harness, device gating, or the physical/
  emulator verification process established in Phase 0.
- Core-lifting auth-status or update-check — they get a native short-circuit
  branch only, not an in-process operation core.
- Any new shipping dependency.

## User stories

- As a GetWrite engineer, I want one generalized transport-collapse helper
  instead of one-off structures per service, so that adding or maintaining
  a native path doesn't require re-deriving the seam each time.
- As a GetWrite engineer, I want revision creation, canonical-flip, prune,
  and restore to work in-process on native, so that on-device editing has a
  working revision history without a server.
- As a GetWrite engineer, I want saved-query execution and metadata-schema
  reads/writes to work in-process on native, so that smart folders and
  custom fields function on device.
- As a GetWrite engineer, I want per-project feature flags to work
  in-process on native, so that feature gating behaves consistently across
  desktop, hosted, and native builds.
- As a GetWrite maintainer, I want auth-status and update-check to resolve
  correctly on native without attempting any server call, so that native
  builds don't fail or hang on features that have no on-device meaning.
- As a GetWrite maintainer, I want the search seam refactored onto the same
  generalized helper, so that the codebase has one transport-collapse
  mechanism, not two, going forward.

## Functional requirements

1. A single, reusable transport-collapse helper must be extracted with a
   signature of the shape `createTransport<T>(httpImpl: T, loadNative: () =>
   Promise<T>): () => Promise<T>` (or an equivalently-typed factory). It
   centralizes the `resolveRuntime()` branch, dispatch to the selected impl,
   and error handling. Each service supplies `loadNative` as a thunk
   containing a literal dynamic import (e.g. `() =>
   import("./native-revision-backend")`) so Turbopack's `resolveAlias` can
   swap it for a web-stub in the web build, exactly as Phase 0 does for
   search. The helper must not accept the native module path as a runtime
   variable — a computed/non-literal import specifier would break aliasing.
2. The existing search transport (`search-transport.ts`,
   `native-search-backend.ts`, and the web-stub/alias wiring) must be
   refactored to use the new generalized helper — `resolveSearchTransport`
   becomes a thin call into `createTransport` — with no behavior change to
   its HTTP path and no regression in its existing tests or on-device
   verification.
3. Each of revision, query, metadata-schema, and feature-config must have
   its route operation(s) lifted into a transport-agnostic core module
   (no HTTP/`next` request or response concerns), reused unmodified by both
   the existing HTTP route handler and a new native backend. Query/saved,
   metadata-schema, and features routes are thin dispatchers over pure
   `lib/models/*` functions and lift directly; `app/api/project/query/
   evaluate/route.ts` already exports a pure `executeEvaluate(projectRoot,
   ast)`; revision's private helpers are already `NextRequest`-free. Where a
   route currently resolves its project root via `resolveProjectPath(projectId)`
   (which returns a `NextResponse` on failure), the lifted core must
   re-derive project-root resolution as a plain function that returns
   null/throws instead — matching search's existing `findProjectRoot` — not
   by reusing `resolveProjectPath` itself.
4. Each new native backend (revision, query, metadata-schema,
   feature-config) must run its lifted core inside `runInStorageContext`
   over the app-lifetime-bound native `StorageContext` established in
   Phase 0, with no per-operation re-binding. Revision's native backend
   must expose one `RevisionTransport` interface with multiple methods
   (create, in-place update, canonical-flip, delete, read) backed by a
   single `native-revision-backend` module and a single `resolveAlias`
   entry — matching the single revision route file and its single
   `RevisionRequestContext` — rather than several single-operation
   transports.
5. Each of the four core-lifted services must be wired through the
   generalized helper from FR1, with its native backend imported only under
   the native runtime.
6. Auth-status must be wired through the same generalized helper from FR1,
   with a trivial native impl that returns the constant
   `{ hostedAuthActive: false }` and pulls in no server-only imports (it
   must not call the `server-only` `isHostedAuthActive()`). Because this
   native impl has no server-only imports, it needs no `resolveAlias`
   web-stub entry — this keeps auth-status on the one transport-collapse
   mechanism rather than a separate inline guard.
7. Update-check must be wired through the same generalized helper from FR1,
   with a trivial native impl that returns a no-update result constant and
   pulls in no server-only imports (it must not invoke the GitHub release
   check or any HTTP call), needing no `resolveAlias` web-stub entry for the
   same reason as FR6.
8. Existing HTTP routes for all six services must be preserved exactly —
   same request/response shapes, same status codes, same error handling —
   verified by the existing route test suites passing unmodified.
9. Native code (native backends, native short-circuit branches, and any
   server-only imports they pull in) must not be included in the web
   bundle; each native-only module must be imported only under the native
   runtime, consistent with the existing `next.config.mjs`
   `turbopack.resolveAlias` exclusion pattern from Phase 0.
10. No existing Vitest suite (route tests, transport-service tests, Phase 0
    conformance and search on-device verification) may regress as a result
    of this phase's changes.
11. `pnpm build` for hosted/desktop must produce byte-for-byte identical
    output to pre-Phase-1 output; this phase is additive only.
12. No new shipping dependency may be introduced to implement the
    generalized helper or any of the six services' native paths.

## Decisions

Resolved during open-questions triage (2026-07-25):

- **Helper shape.** `createTransport<T>(httpImpl: T, loadNative: () =>
  Promise<T>): () => Promise<T>` (or an equivalently-typed factory). It owns
  the `resolveRuntime()` branch, dispatch, and error handling. Every
  service, including search's refactored `resolveSearchTransport`, passes
  its native module as a thunk containing a literal dynamic import so
  Turbopack's `resolveAlias` can still substitute a web-stub — the exact
  mechanism proven in Phase 0. The helper must never take the native module
  path as a runtime variable. See FR1, FR2.
- **Core separability confirmed.** Verified directly against the codebase,
  not left open: `app/api/project/query/evaluate/route.ts` already exports
  a pure `executeEvaluate(projectRoot, ast)`; query/saved, metadata-schema,
  and features routes are thin dispatchers over pure `lib/models/*`
  functions; revision's private helpers are already `NextRequest`-free. The
  one recurring HTTP wrinkle is `resolveProjectPath(projectId)`, which
  returns a `NextResponse` on failure — the lifted core re-derives
  project-root resolution as a plain function returning null/throwing,
  matching search's existing `findProjectRoot`, rather than reusing
  `resolveProjectPath`. See FR3.
- **Revision transport shape.** One `RevisionTransport` interface with
  multiple methods (create, in-place update, canonical-flip, delete, read),
  backed by one `native-revision-backend` module and one `resolveAlias`
  entry — matching the single revision route file and its single
  `RevisionRequestContext` — instead of several single-operation
  transports. See FR4.
- **Auth-status and update-check routing.** Both route through the same
  generalized helper from FR1 as trivial native impls returning their
  constant result (`{ hostedAuthActive: false }` and a no-update result,
  respectively), with no server-only imports and therefore no
  `resolveAlias` web-stub entry required. The native auth-status branch
  hardcodes `false` — it cannot call the `server-only`
  `isHostedAuthActive()`. This keeps the codebase on one transport-collapse
  mechanism rather than a separate inline guard, satisfying the Goals
  bullet. See FR6, FR7.
- **Test strategy.** Generalize the existing
  `transport-collapse.spike.test.ts` and
  `native-search-backend-web-exclusion.test.ts` patterns to cover the new
  helper: (a) web routes go through the http impl with no fetch-to-server
  on native, (b) the native impl is never eagerly imported under the web
  runtime, and (c) each lifted core is reused by both the HTTP route and
  the native backend. Every service's existing route/transport test suites
  are kept unmodified as regression coverage. See FR8, FR10.
- **Branch strategy.** Phase 0's PR #167 merges to `main` first; Phase 1
  branches from a clean `main` rather than from
  `feat/adr-021-phase0-native-android-skeleton` or proceeding in parallel
  with a planned rebase. (Execution detail, not reflected in a numbered FR.)

## Open questions

None — all resolved during triage (2026-07-25). See Decisions above.

## Out of scope (deferred)

- Full-app WebView wiring against real built frontend assets (Phase 2).
- Media/base64 handling at scale on native (Phase 2).
- Android signing, packaging, and Play Store submission (Phase 3).
- Any change to the on-device harness or device-gating process from Phase 0.
- Core-lifting auth-status or update-check beyond their native
  short-circuit branch.
