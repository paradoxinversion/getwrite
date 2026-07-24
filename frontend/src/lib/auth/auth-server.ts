// Last Updated: 2026-07-22

import "server-only";

import { betterAuth, type Auth } from "better-auth";
import { Pool } from "pg";
import { isHostedAuthActive } from "./auth-config";
import { sendResetPassword, sendVerificationEmail } from "./email";
import { isEmailAllowlisted } from "./signup-allowlist";

/**
 * @module auth-server
 *
 * Builds and memoizes the `betterAuth(...)` server instance for GetWrite's
 * hosted authentication path (Slice 6, `specs/features/auth-provider.md`).
 *
 * This module owns the *only* place a `pg.Pool` is constructed for auth
 * purposes, and the only place `betterAuth(...)` is called. It mirrors
 * `app/api/_tenant/storage-backend.ts`'s `cachedObjectStoreAdapter` idiom:
 * the instance is expensive to build (it opens a Postgres connection pool)
 * and stateless across requests, so it is built lazily on first use and
 * reused for the lifetime of the process, with a `__resetAuthServerForTests()`
 * hook so tests can force a fresh build after toggling env.
 *
 * **Lazy, gated construction is the FR5/FR10 guarantee made mechanical.**
 * {@link getAuthServer} throws {@link AuthServerNotActiveError} — without
 * constructing a `Pool` or calling `betterAuth(...)` at all — when
 * {@link isHostedAuthActive} is `false`. Callers (`identity-source.ts`'s
 * `betterAuthIdentitySource`, the `/api/auth/[...all]` route handler) are responsible
 * for checking `isHostedAuthActive()` themselves before calling this
 * function; this function's own guard exists as defense in depth, not as
 * the primary gate — it is what makes "no Postgres connection is ever
 * attempted when hosted auth is inactive" true even if a caller forgets the
 * check, rather than merely a documented expectation.
 *
 * **Config shape, verified against the installed `better-auth@1.6.24` /
 * `@better-auth/core@1.6.24` type definitions** (not just the spec's
 * snippet — see `node_modules/.../@better-auth/core/dist/types/init-options.d.mts`):
 * - `database`: `BetterAuthOptions["database"]` accepts a `pg.Pool`
 *   (matched by its `PostgresPool` member) directly — no explicit Kysely
 *   dialect wrapper is required in this version. better-auth detects the
 *   Postgres dialect from the pool itself.
 * - `advanced.database.generateId`: confirmed as the exact key path; `"uuid"`
 *   is a supported literal (alongside a custom function, `false`, and
 *   `"serial"`), matching FR6's requirement to mint lowercase UUIDs that
 *   satisfy the tenant directory allowlist.
 * - `rateLimit.storage`: confirmed as `"memory" | "database" |
 *   "secondary-storage"`; `"database"` is used per FR16.
 * - `session.cookieCache`: confirmed shape — `{ enabled, maxAge, strategy,
 *   refreshCache }`. Enabled so `betterAuthIdentitySource`'s session read
 *   (`identity-source.ts`, Task 3) does not require a Postgres round-trip on
 *   every request, per FR17. **`maxAge` is pinned to
 *   {@link SESSION_COOKIE_CACHE_MAX_AGE_SECONDS} (10s), not better-auth's
 *   5-minute default** — see the FR26 review's finding M1: with the 5-minute
 *   default, `getSession()` served the signed cookie snapshot without a DB
 *   read for a full 5 minutes, so `revokeSessions()` ("log out everywhere")
 *   did not take effect on any session with a warm cache — including the
 *   stolen device the action targets. A 10-second window keeps the
 *   per-request DB saving for bursts of activity while bounding revocation
 *   latency to ~10s. (Dropping the cache entirely would make revocation
 *   instant at the cost of a DB session read on every tenant request; the
 *   short cache is the deliberate middle.)
 *
 * No divergence from the spec's snippet was found: the installed v1.6.24
 * API matches the spec's intent (and key paths) exactly for every option
 * this task configures.
 *
 * **Email callbacks are wired to the `nodemailer` SMTP transport (FR14).**
 * `emailAndPassword.sendResetPassword` and
 * `emailVerification.sendVerificationEmail` are `./email.ts`'s
 * `sendResetPassword`/`sendVerificationEmail`, which send real emails over
 * SMTP (configured via `SMTP_*` env — see `email.ts`'s module doc). Those
 * functions throw `email.ts`'s `SmtpNotConfiguredError` if required SMTP
 * config is missing when an email is actually attempted.
 *
 * **Signup is gated by an env-configured allowlist, not `disableSignUp`
 * (FR12).** `emailAndPassword.disableSignUp` is `false` here — Task 1 had
 * set it `true`, but that option is an unconditional kill switch better-auth
 * checks (`sign-up.mjs`'s `signUpEmail` handler) before any user-creation
 * hook runs, for both the HTTP endpoint and any programmatic
 * `auth.api.signUpEmail(...)` call. It has no per-call override, so it
 * cannot be "combined with" an invite/allowlist check to selectively admit
 * specific users — it can only block everyone or no one. The actual gate is
 * `databaseHooks.user.create.before`: it runs immediately before
 * better-auth would insert a new user row, and only for genuinely new users
 * (an existing-email signup attempt never reaches it — see the next
 * paragraph). Returning `false` from it makes better-auth's
 * `createWithHooks` return `null`, which the signup endpoint turns into a
 * generic "failed to create user" `BAD_REQUEST` — not a distinguishable
 * "you're not invited" error. The gate policy itself
 * (`./signup-allowlist.ts`'s `isEmailAllowlisted`) is env-configured via
 * `AUTH_SIGNUP_ALLOWLIST`: unconfigured means open signup (the self-host
 * default per FR12's "this slice does not mandate a specific policy for
 * self-host"); configured, it's an allowlist of exact emails and/or
 * `@domain.com` wildcards. See `signup-allowlist.ts`'s module doc for the
 * exact format.
 *
 * **FR15's signup anti-enumeration requirement is met by existing config,
 * not new code.** Verified directly against the installed
 * `sign-up.mjs`: the endpoint computes
 * `shouldReturnGenericDuplicateResponse = requireEmailVerification ||
 * autoSignIn === false`, and when that's `true` and the submitted email
 * already has an account, it does not throw a distinguishing error — it
 * hashes the submitted password anyway (to equalize timing) and returns a
 * normal-looking `200` with a synthetic fake user (`token: null`),
 * structurally indistinguishable from a genuine new-signup response, and
 * never touches the real account. `emailAndPassword.requireEmailVerification`
 * is already `true` below (Task 1), so this module makes no further changes
 * for FR15 — the existing config combination already satisfies it. (The
 * `databaseHooks.user.create.before` gate above never even sees an
 * existing-email attempt, since better-auth's duplicate-email branch short-
 * circuits before user creation is attempted.)
 */

/**
 * How long (seconds) better-auth may serve a session from the signed
 * `session_data` cookie cache before it must re-read the database. Pinned short
 * (not better-auth's 5-minute default) to bound "log out everywhere" revocation
 * latency — see the module doc's `session.cookieCache` note and FR26 finding M1.
 */
const SESSION_COOKIE_CACHE_MAX_AGE_SECONDS = 10;

/** Raised by {@link getAuthServer} when hosted auth is not active. */
export class AuthServerNotActiveError extends Error {
  constructor() {
    super(
      "getAuthServer() was called while hosted auth is inactive. Callers " +
        "must check isHostedAuthActive() before calling getAuthServer() — " +
        "this error is a defense-in-depth guard, not the primary gate.",
    );
    this.name = "AuthServerNotActiveError";
  }
}

/**
 * The type of the object `betterAuth(...)` returns for this module's exact
 * options shape. Exported so downstream modules (`identity-source.ts`'s
 * `betterAuthIdentitySource`, the route handler) can type a reference to the
 * server instance without re-deriving it from `betterAuth` themselves.
 *
 * Deliberately typed against `ReturnType<typeof buildAuthOptions>` rather
 * than the bare `Auth<BetterAuthOptions>` default: `betterAuth`'s return
 * type is generic over the exact options object passed in (it narrows
 * `emailAndPassword`, `advanced`, etc. to their literal shapes), and
 * `Auth<T>` is not covariant enough for a `Auth<OurOptions>` instance to
 * widen to `Auth<BetterAuthOptions>` — so this alias must track the real
 * options shape instead of the generic default.
 */
export type AuthServerInstance = Auth<ReturnType<typeof buildAuthOptions>>;

/**
 * Process-wide `betterAuth(...)` instance, built lazily on first call to
 * {@link getAuthServer}. Memoized because building it opens a Postgres
 * connection pool (`pg.Pool`) — an expensive, stateful resource that must
 * not be recreated per request.
 */
let cachedAuthServer: AuthServerInstance | null = null;

/**
 * Test-only hook to clear the memoized auth server instance, so a test that
 * toggles the hosted-auth env observes a fresh build (or a fresh throw) on
 * its next {@link getAuthServer} call.
 */
export function __resetAuthServerForTests(): void {
  cachedAuthServer = null;
  hasWarnedMissingIpTrust = false;
  hasWarnedInsecureBaseUrl = false;
}

/**
 * Resolves better-auth's `advanced.ipAddress` config from env, so the client IP
 * that rate limiting (FR16) keys on is derived from a *trusted* source rather
 * than a spoofable client header.
 *
 * **Why this must be configured (FR26 review, finding H2).** Without it,
 * better-auth trusts a single-valued `x-forwarded-for` verbatim, so an attacker
 * bypasses login rate limiting entirely by rotating the header — and behind a
 * real load balancer that appends to `x-forwarded-for`, the header goes
 * multi-valued and every client collapses into one shared bucket (a DoS). The
 * correct value is deployment-specific and cannot be hard-coded:
 *
 * - `AUTH_TRUSTED_PROXIES` — comma/newline list of proxy/load-balancer IPs or
 *   CIDR ranges. better-auth strips the forwarded chain to the first hop that
 *   isn't one of these, so a client-prepended fake IP can't win.
 * - `AUTH_IP_ADDRESS_HEADERS` — comma/newline list of headers to read the
 *   client IP from instead of `x-forwarded-for` (e.g. a platform's dedicated,
 *   client-unforgeable client-IP header).
 *
 * Returns `undefined` when neither is set, in which case {@link buildAuthOptions}
 * emits a one-time warning and leaves better-auth on its (spoofable) default —
 * acceptable for the smoke/local, not for a real hosted deployment.
 */
function resolveIpAddressConfig():
  | { trustedProxies?: string[]; ipAddressHeaders?: string[] }
  | undefined {
  const trustedProxies = parseCsvEnv(process.env.AUTH_TRUSTED_PROXIES);
  const ipAddressHeaders = parseCsvEnv(process.env.AUTH_IP_ADDRESS_HEADERS);
  const config: { trustedProxies?: string[]; ipAddressHeaders?: string[] } = {};
  if (trustedProxies.length > 0) config.trustedProxies = trustedProxies;
  if (ipAddressHeaders.length > 0) config.ipAddressHeaders = ipAddressHeaders;
  return config.trustedProxies || config.ipAddressHeaders ? config : undefined;
}

/** Splits a comma/newline-separated env var into trimmed, non-empty entries. */
function parseCsvEnv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** One-shot per process so building the memoized instance doesn't spam logs. */
let hasWarnedMissingIpTrust = false;
function warnMissingIpTrust(): void {
  if (hasWarnedMissingIpTrust) return;
  hasWarnedMissingIpTrust = true;
  console.warn(
    "[getwrite] Hosted auth is active but neither AUTH_TRUSTED_PROXIES nor " +
      "AUTH_IP_ADDRESS_HEADERS is set. better-auth will trust the client-supplied " +
      "x-forwarded-for header verbatim, which lets an attacker bypass login " +
      "rate limiting (FR16) by rotating the header. Set AUTH_TRUSTED_PROXIES to " +
      "your proxy/load-balancer IPs (or AUTH_IP_ADDRESS_HEADERS to your platform's " +
      "trusted client-IP header). See the README self-host environment table.",
  );
}

/**
 * Warns when hosted auth is active but `BETTER_AUTH_URL` is not https (FR26
 * review, finding M2). better-auth derives the session cookie's `Secure` flag
 * from this protocol, so an http base URL ships session cookies without
 * `Secure` — sendable over plaintext and interceptable. The warning is
 * non-fatal because local hosted-auth testing legitimately runs on
 * http://localhost; a real deployment must set an https `BETTER_AUTH_URL`.
 */
let hasWarnedInsecureBaseUrl = false;
function warnIfInsecureBaseUrl(baseUrl: string): void {
  if (hasWarnedInsecureBaseUrl) return;
  let protocol = "";
  try {
    protocol = new URL(baseUrl).protocol;
  } catch {
    protocol = "";
  }
  if (protocol === "https:") return;
  hasWarnedInsecureBaseUrl = true;
  console.warn(
    `[getwrite] Hosted auth is active but BETTER_AUTH_URL (${baseUrl}) is not ` +
      "https. better-auth derives the session cookie's Secure flag from this " +
      "URL, so sessions will be issued without Secure and can be sent over " +
      "plaintext HTTP. Set an https BETTER_AUTH_URL in any real deployment " +
      "(a non-https localhost value is fine for local testing only).",
  );
}

/**
 * Resolves `BETTER_AUTH_URL`, better-auth's `baseURL` option.
 *
 * Unlike `isHostedAuthActive()`'s hard-required env vars, `BETTER_AUTH_URL`
 * has a sensible local default so a developer who has set `DATABASE_URL`
 * and `BETTER_AUTH_SECRET` (e.g. to run the live smoke test locally against
 * a docker-compose Postgres) is not also forced to set the base URL by
 * hand. Mirrors `projects-dir.ts`'s `defaultProjectsDir()` env-with-fallback
 * pattern: check the env var first, fall back to a documented default
 * otherwise. Real deployments (hosted and self-host) must still set
 * `BETTER_AUTH_URL` explicitly per FR23 — the fallback here is a local-dev
 * convenience, not a production-safe default.
 */
function resolveBaseUrl(): string {
  const configured = process.env.BETTER_AUTH_URL;
  return configured && configured.trim().length > 0
    ? configured
    : "http://localhost:3000";
}

/**
 * Builds the `betterAuth(...)` options object. Split out from
 * {@link getAuthServer} so the config shape can be exercised without a real
 * Postgres connection: constructing this object does not itself open the
 * pool's first connection (a `pg.Pool` connects lazily, on first query).
 */
function buildAuthOptions() {
  const databaseUrl = process.env.DATABASE_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!databaseUrl || !secret) {
    // Unreachable in practice — getAuthServer() only calls this after
    // isHostedAuthActive() has confirmed both are set — but keeps this
    // function correct in isolation rather than trusting the caller.
    throw new AuthServerNotActiveError();
  }

  const ipAddress = resolveIpAddressConfig();
  if (!ipAddress) {
    warnMissingIpTrust();
  }

  const baseURL = resolveBaseUrl();
  warnIfInsecureBaseUrl(baseURL);

  return {
    database: new Pool({ connectionString: databaseUrl }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      disableSignUp: false,
      // FR26 review L3: pin an explicit password-length policy rather than
      // relying on better-auth's 8-char default. 12 is a modest modern minimum;
      // the max is a sanity cap (a hasher can be DoS'd by an unbounded input).
      // Breach screening (e.g. the haveibeenpwned plugin) is deliberately NOT
      // added here — it introduces an external network dependency on every
      // signup/reset and needs a package-selection sign-off (docs/standards).
      minPasswordLength: 12,
      maxPasswordLength: 128,
      sendResetPassword,
    },
    emailVerification: { sendVerificationEmail },
    databaseHooks: {
      user: {
        create: {
          before: async (user: { email: string }) => {
            if (!isEmailAllowlisted(user.email)) {
              return false;
            }
          },
        },
      },
    },
    advanced: {
      database: { generateId: "uuid" as const },
      // Only present when configured (FR16/H2); absent keeps better-auth's
      // default IP resolution, with a one-time warning emitted above.
      ...(ipAddress ? { ipAddress } : {}),
    },
    rateLimit: { storage: "database" as const },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
      },
    },
    secret,
    baseURL,
  };
}

/**
 * Returns the process-wide {@link AuthServerInstance}, building it lazily on
 * first call and memoizing it thereafter.
 *
 * @throws {AuthServerNotActiveError} When {@link isHostedAuthActive} is
 *   `false` — no `Pool` is constructed and `betterAuth(...)` is never
 *   called.
 */
export function getAuthServer(): AuthServerInstance {
  if (!isHostedAuthActive()) {
    throw new AuthServerNotActiveError();
  }

  if (!cachedAuthServer) {
    cachedAuthServer = betterAuth(buildAuthOptions());
  }

  return cachedAuthServer;
}
