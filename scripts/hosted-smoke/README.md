# Hosted-auth live smoke (auth-provider plan, Task 8)

The automated gate (`pnpm test:ci`) mocks better-auth and PostgreSQL by design,
so it proves the code compiles and its units behave — but never that the hosted
authentication path works end to end against real infrastructure. This directory
is that missing test: real Postgres, a real SMTP sink, a real production build of
the app, driven through the full account lifecycle.

It exists because Slice 5 (ADR-019) shipped an object-store backend that passed
its entire conformance suite while the app was still broken on that backend; only
a live smoke caught it. Auth has a worse failure mode — credential compromise or
cross-tenant data exposure — so it gets the same treatment before real-credential
go-live (which is separately gated on the FR26 independent security review).

## What it checks

`smoke.mjs` drives, against a running server:

- **Signup gating (FR12/FR15)** — a non-allowlisted address is rejected, and the
  rejection does not disclose the gating.
- **Verification + login (FR11/FR13/FR14)** — allowlisted signup → verification
  email arrives over SMTP → login is refused until the mailed link is consumed →
  login succeeds after.
- **Anti-enumeration (FR15)** — a duplicate signup returns a generic success, not
  a distinguishable "already exists" error.
- **Tenant isolation (ADR-017/018)** — user A creates a project; it lands on disk
  under `GETWRITE_DATA_ROOT/<A-uuid>/`; user B sees none of it; the minted user id
  satisfies the `^[a-z0-9_-]{1,64}$` tenant-path allowlist.
- **Route enforcement (FR9/FR18/FR20)** — anonymous tenant request → 401;
  cross-origin and origin-less mutations → 403 (CSRF, fail-closed); anonymous page
  request → redirect to `/login`; authenticated page request → 200.
- **Rate limiting (FR16)** — repeated failed logins from one IP get a 429.
- **Revocation (FR17)** — see **Findings** below.

Informational probes (never pass/fail, printed as `NOTE`) record two real
behaviors worth the security reviewer's attention: multi-hop `x-forwarded-for`
handling, and that the CSRF origin comparison ignores port.

## Prerequisites

- Docker (Compose v2). `docker compose version` should work.
- The frontend built for production: `pnpm --filter getwrite-frontend build`.
- The pinned `@better-auth/cli` devDependency (already in `frontend`).

## Run book

All commands from the repo root unless noted.

```bash
# 1. Bring up Postgres (host :55432) and Mailpit (SMTP :51025, UI :58025).
docker compose -f scripts/hosted-smoke/compose.yml up -d

# 2. Create the auth schema in that Postgres. Uses the CLI-only config
#    (frontend/better-auth.config.ts) — auth-server.ts can't be used by the CLI
#    (lazy export + server-only guard). This emits user/account/session/
#    verification AND the rateLimit table (the config declares database storage).
cd frontend
DATABASE_URL='postgres://getwrite:getwrite@localhost:55432/getwrite_auth' \
BETTER_AUTH_SECRET='smoke-secret-not-for-production-0123456789' \
BETTER_AUTH_URL='http://localhost:3000' \
  pnpm exec better-auth migrate --config better-auth.config.ts -y

# 3. Start the app with the hosted-auth env. GETWRITE_DATA_ROOT is a throwaway
#    tenant root the smoke inspects directly for on-disk isolation.
DATABASE_URL='postgres://getwrite:getwrite@localhost:55432/getwrite_auth' \
BETTER_AUTH_SECRET='smoke-secret-not-for-production-0123456789' \
BETTER_AUTH_URL='http://localhost:3000' \
SMTP_HOST=localhost SMTP_PORT=51025 SMTP_USER=smoke SMTP_PASS=smoke \
SMTP_FROM=noreply@getwrite.test \
AUTH_SIGNUP_ALLOWLIST='@allowed.test' \
GETWRITE_DATA_ROOT="$(mktemp -d)" \
  node .next/standalone/frontend/server.js &
#    (`pnpm start` also works but warns under output:standalone; the standalone
#     server.js is the deployment artifact and the more faithful target.)

# 4. Drive the smoke (from the repo root), pointing it at the SAME data root.
GETWRITE_DATA_ROOT='<the mktemp dir from step 3>' \
ALLOWED_DOMAIN=allowed.test \
  node scripts/hosted-smoke/smoke.mjs

# 5. Tear down (throws the database away — ephemeral by design).
docker compose -f scripts/hosted-smoke/compose.yml down
```

Mailpit's web UI at <http://localhost:58025> shows every captured message if you
want to eyeball the verification/reset mail.

The smoke exits `0` only when every hard check passes. All checks are hard gates,
including the FR17 revocation check — a failure anywhere is a real regression.

## Findings

### FR17 — "log out everywhere" revocation latency — RESOLVED (M1)

**Status: fixed.** `auth-server.ts` now pins `session.cookieCache.maxAge` to 10
seconds (`SESSION_COOKIE_CACHE_MAX_AGE_SECONDS`) instead of better-auth's 5-minute
default.

Background: `revokeSessions()` deletes the user's session rows in Postgres, and
the smoke confirms a session token with the cache cookie stripped is immediately
dead (401). But better-auth serves a **signed session snapshot from the
`better-auth.session_data` cookie for its `maxAge`** without consulting the
database, and `betterAuthIdentitySource` calls `getSession()` on every tenant
request — so with the 5-minute default, any session with a warm cache cookie
(including the device "log out everywhere" is meant to kill) kept full access for
up to 5 minutes after revocation. The cache exists to avoid a per-request Postgres
round-trip (FR17), so the fix shortens the window rather than removing the cache:
10 seconds keeps the DB saving for bursts of activity while bounding revocation
latency to ~10s. The smoke's revocation check now waits past that window and hard-
asserts the revoked session is unreachable.

(If a deployment wants instant revocation instead, disable `cookieCache` entirely,
accepting a DB session read on every tenant request.)

## Files

- `compose.yml` — Postgres 17 + Mailpit, ephemeral, non-default host ports.
- `smoke.mjs` — the end-to-end driver (Node, no dependencies).
- `../../frontend/better-auth.config.ts` — CLI-only better-auth config for schema
  generation/migration (step 2).
