// Last Updated: 2026-07-22

import { randomUUID } from "node:crypto";
import { toNextJsHandler } from "better-auth/next-js";
import { isHostedAuthActive } from "../../../../src/lib/auth/auth-config";
import { getAuthServer } from "../../../../src/lib/auth/auth-server";

/**
 * @module route
 *
 * `/api/auth/[...all]` — the better-auth catch-all route handler (FR1,
 * `specs/features/auth-provider.md`). Mounts every better-auth endpoint
 * (sign-up, sign-in, sign-out, session, email verification, password reset,
 * etc.) behind the standard better-auth Next.js App Router integration.
 *
 * **Not a tenant-data route.** Unlike every route under `app/api/project*`,
 * `app/api/resource*`, etc., this route is intentionally *not* wrapped in
 * `withStorageContext` — it has nothing to do with `resolveTenant`/
 * `StorageContext`, and FR9 explicitly carves it out: "Auth API routes
 * themselves... remain reachable without an existing session." better-auth
 * manages its own session/CSRF concerns internally for these endpoints.
 *
 * **Inactive-path behavior (FR5/FR10 made mechanical for this route).** When
 * hosted auth is not configured (`isHostedAuthActive()` is `false` —
 * desktop/local, or a hosted deployment that simply hasn't set
 * `DATABASE_URL`/`BETTER_AUTH_SECRET`), every exported method responds `404`
 * without calling {@link getAuthServer} or `toNextJsHandler` at all — no
 * Postgres connection is attempted and no better-auth code path runs. `404`
 * is the chosen response because, in this deployment mode, the route
 * genuinely doesn't exist: it's not a config-error 500 (nothing is
 * misconfigured — hosted auth is simply off by design) and not a 401
 * (401 implies an auth *system* that exists but rejected the caller, which
 * FR9 reserves for tenant-data routes with a missing session — a different
 * concept from "this deployment has no auth system at all").
 *
 * **Handler is not memoized here.** `getAuthServer()` itself is already
 * memoized (`auth-server.ts`), and `toNextJsHandler(...)` is a cheap object
 * literal factory (five closures capturing the passed-in auth instance) —
 * re-calling it per request costs far less than the alternative of adding a
 * second memoization layer this module would have to reset in lockstep with
 * `auth-server.ts`'s own `__resetAuthServerForTests()`. Each exported method
 * below calls `toNextJsHandler(getAuthServer())` fresh and immediately
 * invokes the corresponding method.
 */

const NOT_FOUND = new Response(null, { status: 404 });

/** GET — session reads, OAuth callbacks (unused in this slice), etc. */
export async function GET(request: Request): Promise<Response> {
  if (!isHostedAuthActive()) return NOT_FOUND;
  return toNextJsHandler(getAuthServer()).GET(request);
}

/** POST — sign-up, sign-in, sign-out, password reset, email verification, etc. */
export async function POST(request: Request): Promise<Response> {
  if (!isHostedAuthActive()) return NOT_FOUND;

  const url = new URL(request.url);
  if (!url.pathname.endsWith("/sign-up/email")) {
    return toNextJsHandler(getAuthServer()).POST(request);
  }

  // Signup path: buffer the body once so it can be both forwarded to better-auth
  // and re-read to synthesize an anti-enumeration response if the allowlist gate
  // rejects the user (see maskAllowlistRejection).
  const bodyText = await request.text();
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: bodyText,
  });
  const response = await toNextJsHandler(getAuthServer()).POST(forwarded);
  return maskAllowlistRejection(response, bodyText);
}

/**
 * FR26 review, finding L1 — make a non-allowlisted signup indistinguishable
 * from an allowed one.
 *
 * The signup allowlist is enforced by `databaseHooks.user.create.before`
 * (`auth-server.ts`), which better-auth surfaces as `400 FAILED_TO_CREATE_USER`
 * — visibly different from the `200 { token: null, user }` an allowlisted (or
 * already-registered) email receives, letting an attacker probe who is invited.
 * This rewrites *exactly* that rejection into the same generic 200 better-auth
 * itself returns for an already-registered email under `requireEmailVerification`
 * (a synthetic user, `token: null`, no account created, no email sent). Because
 * better-auth hashes the password *before* the create hook runs, response
 * timing is unchanged by this rewrite. Only the allowlist rejection is masked:
 * genuine create failures surface as `422` (not `400`), and validation errors
 * (bad email, password too short) carry other `code`s, so none of them are
 * hidden behind a fake success.
 */
async function maskAllowlistRejection(
  response: Response,
  bodyText: string,
): Promise<Response> {
  if (response.status !== 400) return response;

  let code: unknown;
  try {
    code = ((await response.clone().json()) as { code?: unknown }).code;
  } catch {
    return response;
  }
  if (code !== "FAILED_TO_CREATE_USER") return response;

  let email: unknown;
  let name: unknown;
  try {
    const parsed = JSON.parse(bodyText) as { email?: unknown; name?: unknown };
    email = parsed.email;
    name = parsed.name;
  } catch {
    // Non-JSON body shouldn't reach here (better-auth would have 400'd earlier
    // with a different code), but fall through to a shapely generic response.
  }

  const now = new Date().toISOString();
  return Response.json({
    token: null,
    user: {
      id: randomUUID(),
      name: typeof name === "string" ? name : "",
      email: typeof email === "string" ? email.trim().toLowerCase() : "",
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
  });
}

/** PATCH — better-auth endpoints that support partial updates. */
export async function PATCH(request: Request): Promise<Response> {
  if (!isHostedAuthActive()) return NOT_FOUND;
  return toNextJsHandler(getAuthServer()).PATCH(request);
}

/** PUT — better-auth endpoints that support full replacement. */
export async function PUT(request: Request): Promise<Response> {
  if (!isHostedAuthActive()) return NOT_FOUND;
  return toNextJsHandler(getAuthServer()).PUT(request);
}

/** DELETE — better-auth endpoints that support deletion (e.g. session revocation). */
export async function DELETE(request: Request): Promise<Response> {
  if (!isHostedAuthActive()) return NOT_FOUND;
  return toNextJsHandler(getAuthServer()).DELETE(request);
}
