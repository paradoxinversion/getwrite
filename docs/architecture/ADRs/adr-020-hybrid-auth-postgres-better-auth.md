# ADR-020: Hybrid Identity — better-auth + PostgreSQL Alongside Filesystem/Object-Store Tenant Content

**Date:** 2026-07-22
**Status:** Accepted

## Context

ADR-017/018/019 built GetWrite's hosted-storage foundation: request-scoped `StorageContext`, tenant resolution from a pluggable `IdentitySource`, route enforcement, and an object-store backend adapter — but identity itself remained an interim stub. `getIdentitySource()` resolved a `userId` from an `x-getwrite-dev-user` request header gated by `GETWRITE_ENABLE_DEV_IDENTITY`, and ADR-018 explicitly recorded that this stub "must not be exposed on a real hosted deployment" — anyone could assert any `userId` and read that tenant's data. ADR-018 deliberately deferred choosing a real auth provider to a later slice, to avoid coupling an unproven vendor choice to the tenant-resolution mechanism before that mechanism was proven.

This slice (`specs/features/auth-provider.md`) is that later slice: replacing the dev-header stub with production authentication for real, unrelated users at scale. Constraints in force at the time of the decision:

- **GetWrite is local-first by thesis**, and that must not change: the desktop/Electron build and local dev must keep working with no account, no login screen, and no database dependency of any kind, exactly as before.
- **GetWrite is also a real hosted, multi-tenant product**, and the same codebase must remain self-hostable by third parties running their own instance — so the identity mechanism cannot be Saboteur-infrastructure-specific.
- **Identity carries genuine security consequences that tenant content storage does not.** Password hashing, session issuance/revocation, email verification, password reset, and brute-force rate-limiting are the exact class of code where hand-rolled implementations are most dangerous — a defect in any one of them is a credential-compromise or account-takeover bug, not a formatting bug.
- **The pre-built seam already anticipated this decision.** `IdentitySource.getUserId` (`frontend/app/api/_tenant/identity-source.ts`) was designed by ADR-018 as the single swap point for a real provider, and its return type already accommodated widening to an async signature so a session-store-backed source could be added without a second reshape.
- **`docs/standards/package-selection.md` requires justifying and version-verifying any new dependency**, and specifically weighs against adding a second dependency that duplicates a capability an existing or planned dependency already provides (e.g. a second ORM).
- **The tenant-directory allowlist is lowercase-only.** `tenant-path.ts:83`'s `^[a-z0-9_-]{1,64}$` validates any `userId` used as a filesystem/object-key path segment; whatever identifier the chosen auth provider mints as a user id has to satisfy this without weakening the allowlist (weakening it to accept mixed case would break injectivity on case-insensitive filesystems, exactly the failure mode the allowlist exists to prevent).

## Options considered

### Option 1: Filesystem-backed, hand-rolled authentication

Store user records, password hashes, and session tokens as JSON files under the existing `projects/`-style filesystem layout, with custom code for hashing, session issuance/revocation, verification tokens, and rate-limiting — consistent with GetWrite's "no database" thesis for every other kind of state.

**Pros:**

- No new runtime dependency (Postgres) and no deviation from "no database" as an absolute rule.
- Reuses the same locking/atomic-write primitives (`locks.ts`, `atomicWriteFile`) already proven for tenant content.

**Cons:**

- Every security-critical primitive — password hashing, constant-time comparison, session-token generation and revocation, rate-limit/lockout bookkeeping, single-use expiring verification/reset tokens — becomes custom code, at exactly the point where custom code is most dangerous. This is the general case ADR-018 already flagged as out of scope for that slice.
- No credible path to server-side session revocation, brute-force protection, or audited security review without reinventing what mature identity libraries already provide and have been reviewed for.
- Filesystem writes for identity records are a different consistency and concurrency problem than they are for tenant content (a single click "log out everywhere" must revoke atomically across however many session records exist); the existing lock primitives were built for a different access pattern (single project, single writer-at-a-time) and were not designed against this one.

### Option 2: Auth.js (NextAuth) with the Credentials provider

Adopt Auth.js, the incumbent auth library for Next.js App Router apps, using its `Credentials` provider for email+password.

**Pros:**

- First-class Next.js App Router integration and broad ecosystem familiarity.
- If OAuth providers are ever added, Auth.js has the largest provider catalog of any Next.js auth library.

**Cons:**

- Auth.js's `Credentials` provider is explicitly second-class in its own design: it forces JWT-only sessions (no database-backed session record Auth.js manages for you), which blocks clean server-side revocation — there is no built-in "log out everywhere" or single-session invalidation without hand-building a database session store and wiring it in as if `Credentials` weren't there.
- Auth.js ships no built-in email-verification, password-reset, or rate-limiting flow for email+password out of the box — those would all be hand-rolled on top of the library, defeating the point of adopting a library for exactly the primitives that matter most here (the same class of risk as Option 1, just partially adopted instead of fully hand-rolled).
- Choosing Auth.js for its OAuth catalog would be optimizing for a non-goal: this slice explicitly excludes OAuth/magic-link providers (see the spec's Non-goals).

### Option 3: better-auth, email+password as a first-class method, Postgres via better-auth's built-in Kysely adapter

Adopt better-auth, a newer auth library that treats email+password as a first-class authentication method (not a fallback provider), backed by PostgreSQL through better-auth's own built-in Kysely database adapter — no separate ORM dependency.

**Pros:**

- Database-backed, genuinely revocable sessions out of the box: single-session logout and "log out everywhere" are library features (`revokeSession`/`revokeSessions`), not something bolted onto a JWT.
- Email verification, password reset, and rate-limiting/lockout ship as audited library features (`emailAndPassword.requireEmailVerification`, `emailVerification.sendVerificationEmail`, `emailAndPassword.sendResetPassword`, `rateLimit`) rather than custom security code — directly addressing the risk that made Option 1 and the uncovered half of Option 2 unacceptable.
- better-auth's built-in Kysely Postgres adapter avoids introducing Drizzle or Prisma as a second ORM dependency, satisfying `package-selection.md`'s bar against redundant dependencies (see FR3).
- `advanced.database.generateId: "uuid"` mints lowercase UUIDs, satisfying the existing tenant-directory allowlist (`tenant-path.ts:83`) unchanged — no allowlist change and no second identifier-mapping layer between the auth provider's user id and the tenant directory key.
- Password hashing is handled entirely by better-auth's built-in hasher (scrypt-based by default), removing the argon2 native-module/Electron-bundling question the prior tenant-resolution work had flagged as an open question — moot here regardless, since all auth code is server-only and never reaches the Electron bundle's client code.

**Cons:**

- better-auth is a newer library than Auth.js and has not accumulated the same multi-year battle-testing across large production deployments — a real, named risk (see Consequences → Negative).
- Smaller ecosystem/community than Auth.js if this slice's scope were ever to expand into OAuth/magic-link providers (out of scope for this slice, per the spec's Non-goals).

## Decision

We adopt **Option 3**: better-auth, with email+password as a first-class method, backed by PostgreSQL through better-auth's built-in Kysely adapter — configured via `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`, integrated into Next.js App Router route handlers (`app/api/auth/[...all]/route.ts`), and reached through the existing `IdentitySource` seam (`betterAuthIdentitySource` in `identity-source.ts`).

This is a deliberate **hybrid architecture**, not a reversal of GetWrite's local-first thesis: tenant _content_ (projects, resources, revisions, indexes) keeps living on the filesystem/object store exactly as ADR-017/019 established — completely unaffected by this slice. _Identity_ — accounts, credentials, sessions, verification tokens — runs as a normal backend service with a real relational database, because identity at this security and scale bar is a solved problem with mature libraries, and Postgres is the right tool for a domain that genuinely needs relational integrity (unique email constraints, session foreign keys, atomic revocation across a user's session rows) that a directory-per-tenant filesystem layout does not provide and was never designed to provide.

The deciding factors were **not hand-rolling security-critical primitives** and **not adopting a library whose own design treats email+password as second-class**. Option 1 was rejected because it reproduces exactly the class of risk ADR-018 already flagged and deferred — hand-written password hashing, session handling, and rate-limiting are precisely the wrong place to save a dependency. Option 2 was rejected on a specific, verifiable technical limitation, not general distrust of Auth.js: the `Credentials` provider's JWT-only session model blocks the server-side revocation this slice requires (FR17's "log out everywhere"), and Auth.js's lack of built-in verification/reset/rate-limiting for email+password would have meant hand-rolling the same risky code Option 1 was rejected for, just wrapped in a partially-adopted library. better-auth was chosen because it is purpose-built for exactly this slice's requirements: database-backed revocable sessions, and verification/reset/rate-limiting as first-class, audited features rather than custom code layered on top.

## Consequences

### Positive

- The security-critical baseline this slice requires — password hashing, database-backed revocable sessions, email verification, password reset, and rate-limiting — is delivered as library-provided, audited functionality rather than custom code, directly reducing the surface area of code this project has to get right on its own for credential handling.
- The `IdentitySource` seam ADR-018 built specifically to decouple tenant resolution from an unproven auth-vendor choice is now proven end-to-end: `betterAuthIdentitySource` plugs in without any change to `resolveTenant → dataRootForUser → StorageContext` or to any model/API code downstream of the seam.
- `generateId: "uuid"` means the better-auth user id is used unchanged as the tenant directory key — no second identifier-mapping table or translation layer between "who the user is" and "which directory their data lives in."
- Desktop/Electron, which never configures `DATABASE_URL`/`BETTER_AUTH_SECRET`, stays account-free _and_ database-free: `isHostedAuthActive()` gates every hosted-auth-specific code path (the better-auth server instance, the identity source, the 401/CSRF enforcement, the page-route redirect), so the local-first path is byte-for-byte unchanged and no Postgres connection is ever attempted when hosted auth is inactive.
- better-auth's built-in Kysely adapter means this slice introduces exactly one new persistence dependency (`pg`, a mature, pure-JS Postgres client) rather than two (a Postgres client plus a separate ORM), keeping the dependency surface this decision adds as small as the requirements allow.
- Self-hosters get the same stack (Postgres + better-auth + SMTP) Saboteur's hosted instance uses, with no dependency on Saboteur-specific infrastructure — the same code path serves both, per FR14/FR23.

### Negative

- **better-auth is genuinely newer and less battle-hardened than Auth.js.** This is an accepted risk, not a dismissed one: fewer years in production across fewer large-scale deployments means a materially higher chance of finding an edge case or security-relevant bug that a more mature library would already have had surfaced and fixed by its wider user base. The mitigation is threefold and ongoing, not a one-time action: the installed version is pinned (`better-auth@1.6.24`) rather than left on a floating range, security advisories for the package are to be actively monitored, and — the design-level mitigation — the `IdentitySource` seam is deliberately kept clean specifically so the provider remains swappable if this risk materializes later. This last point is a direct carry-forward of a design goal ADR-018 stated explicitly when it first built the seam.
- **A real, verified divergence from the spec's initial framing: `disableSignUp` ended up `false`, not `true`.** The spec (and this slice's Task 1) initially assumed better-auth's `emailAndPassword.disableSignUp: true` could be "combined with an invite/allowlist check" to selectively admit specific users. Implementation (Task 5) discovered this is not how the option works: `disableSignUp: true` is an unconditional kill switch that better-auth's `signUpEmail` handler checks _before_ any user-creation hook runs, for both the HTTP endpoint and any programmatic call — it has no per-call override and can only block everyone or no one, not selectively admit an allowlisted subset. The actual gate that ships is `databaseHooks.user.create.before` (`auth-server.ts`), which runs immediately before better-auth would insert a new user row and consults `signup-allowlist.ts`'s env-configured `AUTH_SIGNUP_ALLOWLIST` policy; `disableSignUp` itself is configured `false`. This is recorded here plainly, as a genuine implementation-time correction, not glossed over as if the spec's original framing had been accurate.
- Postgres is a new operational dependency this codebase did not previously have anywhere: the hosted service (and any self-hoster enabling hosted auth) now has a stateful database to provision, back up, and keep available, alongside the existing filesystem/object-store tenant-content path. This is accepted because identity genuinely needs relational guarantees the directory-per-tenant filesystem layout does not provide (see Decision), but it is a real new piece of infrastructure to operate, not a cost-free addition.
- Rate-limit state correctness across multiple hosted-service instances currently depends on `rateLimit.storage: "database"` — i.e. on Postgres being reachable and performant enough for rate-limit bookkeeping on every credential-bearing request. A future move to `"secondary-storage"` (e.g. Redis) is a documented possible upgrade, not something this decision builds now, so this remains a real dependency of the current rate-limiting story on Postgres availability/latency.

### Neutral

- Password hashing uses better-auth's default scrypt-based hasher rather than argon2id; this was an explicit choice (FR2) made possible by identity code being strictly server-only, which removed the Electron/native-module bundling concern that would otherwise have weighed in argon2id's favor.
- The tenant-content storage decisions (ADR-017/019) are entirely unaffected: this slice adds identity behind the `IdentitySource` seam and changes nothing about how projects, resources, or the object-store backend are stored or accessed.
- `pg` and `better-auth` remain present as inert, pure-JS, server-only dependencies in the Electron/desktop build even though no code path in that build ever exercises them — this is expected and harmless (FR5/FR27), not a packaging defect to fix.

## Revisit conditions

- **Before real-credential go-live on the primary Saboteur-hosted instance.** Per FR26, before the invite/allowlist-gated primary instance (FR12) admits real users with real credentials, the better-auth integration — configuration, the verification/reset/rate-limit callback wiring, and the session/cookie and CSRF posture — must receive a focused independent security review: a second set of eyes distinct from the implementer. This is a rollout/process requirement this ADR records but does not itself satisfy; invite/allowlist gating limits blast radius while trust in the library accrues, but it is not a substitute for that review. This gates real-user go-live, not the merging of this slice's code.
- **If a better-auth security advisory or production incident materializes** that the "newer, less battle-hardened" risk above anticipated. The clean `IdentitySource` seam is the intended off-ramp: a replacement provider (a more mature library, or a vendor-hosted identity service) would implement the same `IdentitySource` interface, and `resolveTenant`/`withStorageContext`/every route downstream would not need to change.
- **If Postgres availability or rate-limit-check latency becomes a measurable problem** under real hosted load. `rateLimit.storage: "secondary-storage"` (e.g. Redis) is the documented future upgrade path (FR16); this decision does not need to be revisited to make that swap, only the rate-limit storage config.
- **If GetWrite ever needs OAuth or magic-link authentication.** Both are explicitly out of scope for this slice; better-auth's plugin model is expected to accommodate them later behind the same session/identity seam, but that expectation should be validated against the installed version at the time, not assumed to still hold.
