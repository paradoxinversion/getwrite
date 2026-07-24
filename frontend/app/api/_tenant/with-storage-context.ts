// Last Updated: 2026-07-22

/**
 * @module with-storage-context
 *
 * The sanctioned seam for establishing a request-scoped {@link StorageContext}
 * around a Next.js App Router route handler.
 *
 * Routes that resolve the projects directory (via `resolveProjectsDir()`)
 * must establish a `StorageContext` before that resolution runs, or it falls
 * back to `defaultProjectsDir()`'s legacy env/cwd rules. Rather than
 * duplicating a `runInStorageContext(...)` call inline in every such route
 * handler — or introducing a `middleware.ts` (this repo has none, and this
 * feature does not add one) — route authors wrap their exported handler with
 * {@link withStorageContext} once, at the export site.
 *
 * The `tenantRoot` used here is resolved per-request by
 * `resolveTenant(request)` (`app/api/_tenant/resolve-tenant.ts`; ADR-018), not by
 * calling `resolveProjectsDir()` directly — doing that here would read the
 * very context this helper is responsible for establishing, which doesn't
 * exist yet at this point in the call stack. For an unauthenticated / no-account
 * request (the Electron/local-dev case), `resolveTenant` resolves `tenantRoot`
 * to `defaultProjectsDir()`, preserving byte-identical legacy behavior. For a
 * signed-in request, it resolves to that user's validated, provisioned
 * per-tenant data root instead.
 *
 * **401 enforcement (Slice 6, FR9/FR10).** When
 * {@link isHostedAuthActive} is `true` and `resolveTenant` resolves
 * `userId: null` (no valid session), this wrapper returns an HTTP 401
 * directly — the handler is never called, and no `runInStorageContext` scope
 * is ever entered for that request, since there is nothing safe to run
 * without an identity. Auth API routes themselves (signup, login, session,
 * verification, password reset) do not go through this wrapper, so they
 * remain reachable without a session, per FR9. **This check is a strict
 * no-op when hosted auth is inactive** (desktop/local — FR10): the
 * `isHostedAuthActive()` call gates the entire branch, so the pre-existing
 * null-user local-first path below is untouched, byte-for-byte, when it is
 * `false`.
 *
 * **CSRF enforcement (Slice 6, FR18).** Once a tenant route is reachable via
 * a session cookie, it becomes a CSRF target. For state-changing methods
 * (`POST`/`PUT`/`PATCH`/`DELETE`) on a request evaluated while hosted auth is
 * active, {@link passesCsrfCheck} verifies the request's `Origin` header
 * (falling back to `Referer`) names the same host as `BETTER_AUTH_URL`
 * before the handler runs; a mismatch (or the total absence of both headers)
 * returns HTTP 403. Like the 401 check above, this only ever runs when
 * hosted auth is active — in local/desktop mode there is no session cookie
 * for a forged cross-site request to ride on, so the check is skipped
 * entirely rather than evaluated-and-passed, preserving the same
 * byte-for-byte local-path invariant.
 */
import { runInStorageContext } from "../../../src/lib/models/storage-context";
import { defaultProjectsDir } from "../../../src/lib/models/projects-dir";
import { resolveTenant } from "./resolve-tenant";
import { resolveBackendAdapter } from "./storage-backend";
import { isHostedAuthActive } from "../../../src/lib/auth/auth-config";

/** HTTP methods this wrapper treats as state-changing for the CSRF check (FR18). */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Builds the uniform 401 response returned when hosted auth is active and a
 * request carries no valid session (FR9). The body is fixed and generic —
 * it must not vary based on the request, so it cannot be used to probe
 * anything about the target route.
 */
function unauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Builds the uniform 403 response returned when a state-changing request
 * fails the CSRF `Origin`/`Referer` check (FR18). Deliberately a distinct
 * status from {@link unauthorizedResponse}: this is a CSRF rejection (the
 * caller may well have a valid session), not "no session".
 */
function forbiddenCsrfResponse(): Response {
  return Response.json(
    { error: "Cross-site request rejected" },
    { status: 403 },
  );
}

/**
 * Resolves the host `Origin`/`Referer` must match for a state-changing
 * tenant request to pass the CSRF check (FR18): `BETTER_AUTH_URL`'s scheme
 * + hostname.
 *
 * **Port is deliberately not compared.** `BETTER_AUTH_URL` is the app's own
 * canonical base URL, but a hosted deployment is commonly reached through a
 * reverse proxy or load balancer that terminates TLS on a different
 * public-facing port than the one the Next.js process is configured with
 * internally — comparing ports here would risk false-rejecting legitimate
 * same-site requests in that (common) topology. Scheme + hostname is the
 * practical "same site" boundary this check enforces; if a deployment needs
 * port-level strictness, CSRF tokens (noted in FR18 as the stronger
 * alternative) are the better tool, not a stricter version of this check.
 *
 * Falls back to `http://localhost:3000` when `BETTER_AUTH_URL` is unset,
 * mirroring `auth-server.ts`'s `resolveBaseUrl()` local-dev convenience —
 * duplicated here (rather than imported) to keep this low-level wrapper
 * free of a dependency on `auth-server.ts`'s internals.
 */
function resolveAllowedOrigin(): string {
  const configured = process.env.BETTER_AUTH_URL;
  const base =
    configured && configured.trim().length > 0
      ? configured
      : "http://localhost:3000";
  const url = new URL(base);
  // `host` (not `hostname`) so the port is part of the comparison — a same-host
  // different-port origin is a distinct origin to the browser and must not pass
  // (FR26 review, finding L2). `host` omits the port only when it's the default
  // for the scheme, matching what browsers put in the Origin header.
  return `${url.protocol}//${url.host}`;
}

/** Extracts the scheme+hostname from a header value, or `null` if it isn't a parseable URL. */
function extractOrigin(headerValue: string | null): string | null {
  if (!headerValue) return null;
  try {
    const url = new URL(headerValue);
    // Include the port (`host`, not `hostname`) to match resolveAllowedOrigin —
    // see finding L2.
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Evaluates the CSRF `Origin`/`Referer` check for a state-changing tenant
 * request (FR18).
 *
 * Prefers `Origin`; falls back to `Referer` when `Origin` is absent, a
 * documented and common CSRF-check pattern (better-auth's own internal
 * origin-check middleware follows the same fallback). **Fail-closed:** if
 * neither header is present at all, this returns `false` — a same-origin
 * browser `fetch`/`XHR` always sends `Origin` for a state-changing request,
 * and a same-site form POST sends `Origin` in modern browsers (Chrome 76+),
 * so a state-changing request with neither header is treated as suspicious
 * rather than given the benefit of the doubt. This is a deliberately strict
 * default; if it proves too strict for some legitimate same-origin request
 * pattern this app actually makes, that would be a call worth revisiting
 * with real traffic data, not something to silently relax here.
 */
function passesCsrfCheck(request: Request): boolean {
  const allowed = resolveAllowedOrigin();
  const candidate =
    extractOrigin(request.headers.get("origin")) ??
    extractOrigin(request.headers.get("referer"));
  return candidate !== null && candidate === allowed;
}

/**
 * Wraps a Next.js route handler of any arity (`GET()`, `POST(req)`,
 * `GET(req, { params })`, etc.) so that, before the handler runs, a
 * {@link StorageContext} is established for the duration of its
 * (possibly asynchronous) execution.
 *
 * The wrapper is itself asynchronous: it extracts the inbound request as
 * `args[0]` (Next.js always passes it, even to handlers that appear
 * zero-arity) and awaits `resolveTenant(request)` to determine `tenantRoot`
 * before entering the storage context. The request is narrowed with
 * `instanceof Request` rather than an unchecked cast, so anything that is not
 * a `Request` — a handler invoked directly with no/other arguments, which
 * should not occur via Next.js routing but must not crash — safely falls back
 * to `defaultProjectsDir()` without calling `resolveTenant`, matching the
 * null-user behavior.
 *
 * Preserves the handler's exact call signature and return type so Next.js's
 * route-handler type inference continues to accept the wrapped export. The
 * handler's `Return` is constrained to `Response` (every route handler yields
 * one), which lets the auth short-circuits below return their `Response`
 * without a cast; the wrapper's return type widens to `Return | Response` to
 * cover those two early exits, both of which Next.js accepts.
 *
 * @param handler - The route handler to wrap.
 * @returns A handler with an identical signature that runs `handler` inside
 * a freshly established storage context, or short-circuits to a 401/403
 * `Response` when the auth gates reject the request.
 */
export function withStorageContext<
  Args extends unknown[],
  Return extends Response,
>(
  handler: (...args: Args) => Return | Promise<Return>,
): (...args: Args) => Promise<Return | Response> {
  return async (...args: Args) => {
    const request = args[0];

    // Both halves of the context are resolved per-request: `tenantRoot` (the
    // path prefix) and `adapter` (the storage backend, ADR-019). For a real
    // request both come from `resolveTenant`; the non-Request defensive branch
    // (which Next.js routing should never hit) still honors the backend env.
    if (request instanceof Request) {
      const { userId, dataRoot, adapter } = await resolveTenant(request);

      // Both gates below are entirely skipped when hosted auth is inactive
      // (FR10) — the `isHostedAuthActive()` check wraps both, so the
      // pre-existing local-first path (resolve → run in context → handler)
      // is unchanged, byte-for-byte, in that case.
      if (isHostedAuthActive()) {
        if (userId === null) {
          // No handler call, no storage context: nothing downstream is safe
          // to run without an identity (FR9).
          return unauthorizedResponse();
        }

        if (
          STATE_CHANGING_METHODS.has(request.method) &&
          !passesCsrfCheck(request)
        ) {
          return forbiddenCsrfResponse();
        }
      }

      return await runInStorageContext({ tenantRoot: dataRoot, adapter }, () =>
        handler(...args),
      );
    }

    return await runInStorageContext(
      { tenantRoot: defaultProjectsDir(), adapter: resolveBackendAdapter() },
      () => handler(...args),
    );
  };
}
