# ADR-018: Tenant Resolution — Mapping a Request to a Per-User Data Root

**Date:** 2026-07-10
**Status:** Accepted

## Context

ADR-017 made GetWrite's storage layer _tenant-capable_: `resolveProjectsDir()` and the storage adapter now resolve from an `AsyncLocalStorage`-backed `StorageContext` (`{ tenantRoot, adapter }`), established per request by `withStorageContext` and per background task by `runForTenant`. That slice shipped in 1.2.0.

But nothing yet _chooses_ a tenant. `withStorageContext` binds `tenantRoot` to a hardcoded `defaultProjectsDir()` — the same directory for every request. The app can _hold_ a tenant root; it cannot yet _select a different one per user_. That missing link — turning an inbound request into a specific user's data root — is what stands between "architecturally multi-tenant" and "actually serves multiple users."

Constraints in force at the time of the decision:

- **No auth existed.** GetWrite had no login, sessions, or user records — a greenfield identity surface. A full auth provider is a large, separate decision (vendor lock-in, sessions, signup, account recovery) that should not block proving the resolution mechanism.
- **Local-first is non-negotiable.** The desktop (Electron) and local-dev experiences must keep working entirely offline with no account, resolving to `defaultProjectsDir()` exactly as they do today. The product direction (see the hosted-service memory) is that desktop users may _optionally_ sign in later for hosted sync/backup — so identity must be _nullable_, not required.
- **Directory-per-tenant on a shared filesystem.** ADR-017 chose `<data-root>/<userId>/` per user. Deriving a filesystem path from a user-supplied identifier introduces a path-traversal risk: a crafted `userId` such as `../otherUser` or an absolute path could resolve outside `<data-root>` and read or clobber a sibling tenant's data. Any resolution mechanism had to defend this boundary.
- **The seam should not force the adapter question.** ADR-017 explicitly deferred migrating the ~22 model files that call `node:fs` directly onto the `StorageAdapter`; that migration is only needed for a non-filesystem backend (e.g. S3), not for shared-disk multi-user. Tenant resolution had to work on top of today's path-based isolation without depending on that migration.

## Options considered

### Option 1: Bind auth provider and resolution together in one slice

Pick an authentication stack (e.g. Auth.js, Clerk, or custom sessions) and build login, session management, user provisioning, and request→dataRoot resolution as a single unit. Resolution reads the authenticated session to get the user id.

**Pros:**

- Delivers "real," end-to-end multi-user in one landing — a hosted user can sign up, log in, and get isolated storage.
- No throwaway stub code; the identity source is the real one from the start.
- Forces the account model (signup, sessions, recovery) to be settled now rather than later.

**Cons:**

- Large blast radius and many coupled product decisions (which vendor, session storage, signup flow, email verification) up front, all gating the storage-isolation mechanism that is independently valuable.
- Auth-vendor choice becomes load-bearing before the resolution seam has been proven, risking rework if the vendor is later swapped.
- Hard to test the resolution/provisioning/path-safety logic in isolation because every test path drags in a full auth session.

### Option 2: Resolver seam with a pluggable identity source (nullable user)

Introduce a single resolution function — `resolveTenant(request) → { userId, dataRoot }` — that `withStorageContext` calls in place of the hardcoded default. Identity comes from a pluggable `IdentitySource` interface with a trivial implementation now (a dev stub / signed header) and a real auth provider later. `userId` is nullable: `null` means "no account," which resolves to `defaultProjectsDir()` (the ADR-017 fallback), so desktop and local dev stay offline-first and untouched. A non-null `userId` is validated and canonicalized, then resolves to `<data-root>/<userId>/`, which is provisioned (created if missing) on first request. A path-safety guard rejects any `userId` that, once joined, escapes `<data-root>`.

**Pros:**

- Small, fully testable slice: resolution, provisioning, and the traversal guard can be unit-tested with a fake identity source and no auth infrastructure.
- Proves the whole hosted multi-tenant path end-to-end before committing to any auth vendor; the vendor plugs into `IdentitySource` additively later.
- Nullable user preserves local-first exactly (null → existing fallback) while the type already admits a signed-in user, matching the "optional account on desktop" direction — no reshape when real auth arrives.
- Isolates the path-traversal defense in one reviewable place rather than scattering it across routes.

**Cons:**

- Ships an interim identity source (dev stub / signed header) that is not production auth and must not be exposed on a real hosted deployment without the real provider behind it — a footgun if misconfigured.
- Two landings (seam now, provider later) instead of one; "real login" is not user-visible at the end of this slice.
- The `IdentitySource` abstraction is designed against one-and-a-half implementations, so its shape may need adjustment when the real provider lands.

### Option 3: Resolve tenant per-route from an explicit parameter

Skip a central resolver; have each hosted route read a `userId`/tenant from its own request (header, query, or body) and pass the corresponding `dataRoot` into `withStorageContext` itself.

**Pros:**

- No new abstraction; each route is explicit about where its tenant comes from.
- Maximum flexibility per route.

**Cons:**

- Duplicates the userId-validation and path-traversal guard across every route — the exact class of security check that must never be forgotten in one place. A single missed route is a cross-tenant data breach.
- No single seam for the future auth provider to plug into; adding real auth means editing every route again.
- Inconsistent with ADR-017's established pattern of one `withStorageContext` wrapper owning context establishment.

## Decision

We adopt **Option 2**: a single `resolveTenant(request) → { userId, dataRoot }` seam, backed by a pluggable `IdentitySource` and a nullable user, wired into `withStorageContext`, with first-request provisioning and a centralized path-traversal guard.

The deciding factors were **preserving local-first with zero change** (a `null` user falling through to the existing `defaultProjectsDir()` fallback is the cleanest possible expression of "desktop needs no account") and **decoupling the resolution mechanism from the auth-vendor decision**. This mirrors the sequencing that worked for ADR-017: build and prove the seam first, then land the heavy backend (there, object storage; here, the real auth provider) as an additive plug-in. Option 1 couples an unproven vendor choice to a mechanism that is independently valuable and independently testable. Option 3 scatters the single most security-critical check — the traversal guard — across every route, where one omission is a tenant breach; centralizing it in `resolveTenant` makes that guard reviewable in one place.

## Consequences

### Positive

- Hosted requests resolve to isolated per-user roots (`<data-root>/<userId>/`) through one code path, and the future auth provider plugs into `IdentitySource` without touching routes.
- Desktop and local dev remain byte-for-byte unchanged: a `null` user resolves to `defaultProjectsDir()` via the ADR-017 fallback, keeping the offline-first guarantee intact.
- The path-traversal defense lives in exactly one function and is unit-testable against crafted ids (`../x`, absolute paths, encoded separators) with no auth or filesystem-permission setup.
- First-request provisioning means a newly signed-in user gets a working, empty workspace with no separate onboarding/migration step.
- Resolution, provisioning, and the guard are testable with a fake `IdentitySource`, so the slice lands with real coverage before any auth vendor is chosen.

### Negative

- The slice ships an interim identity source (dev stub / signed header) that is **not** production authentication; deploying the hosted service with it exposed — without the real provider in front — would let anyone assert any `userId` and read that tenant's data. This must be gated by configuration and called out loudly until the real provider lands.
- "Real login" is not delivered in this slice; a hosted user still cannot sign up or authenticate through a UI at the end of it. Multi-user is _mechanically_ proven but not _product-complete_.
- The `IdentitySource` interface is designed against a stub and a sketch of the real provider, so its shape may need revision when the real auth integration is built — some rework risk is accepted.
- Adds a per-request resolution + (occasional) provisioning step to every hosted request; provisioning does an extra `stat`/`mkdir` on the cold path for a user's first request after process start.

### Neutral

- `withStorageContext` changes from binding a constant to calling `resolveTenant`; its call sites (the 4 tenant-resolving routes) are unchanged because they already delegate context establishment to the wrapper.
- Tenant isolation continues to rest on `tenantRoot` (the resolved path), not on the adapter — consistent with ADR-017. The `node:fs`-direct model files remain uncovered by the adapter seam and are still fine, because path-based isolation is what enforces the boundary.
- The `userId` becomes a filesystem directory name, coupling the identity namespace to filesystem-safe characters (a constraint the guard enforces regardless).

## Revisit conditions

- **When the real auth provider is chosen and integrated.** If its user-identifier shape (opaque token, email, UUID) or session model doesn't fit the `IdentitySource` interface cleanly, revisit the seam's shape.
- **If the storage backend moves off a shared filesystem** (S3/object storage, container-per-tenant per ADR-017's revisit conditions). Path-string traversal ceases to be the relevant threat model, and `dataRoot` may become a bucket prefix or a routing key rather than a directory path — the guard and provisioning step would be reconceived.
- **If tenant identity needs to be more than one user** (teams, shared workspaces, org-level tenancy). A flat `userId → <data-root>/<userId>/` mapping no longer suffices and the resolver must map to a tenant that several users share.
- **If per-request provisioning cost becomes measurable** under load, move provisioning to an explicit account-creation step instead of first-request lazy creation.
