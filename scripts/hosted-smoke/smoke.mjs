#!/usr/bin/env node
/**
 * Live end-to-end smoke test for GetWrite's hosted-auth path (auth-provider
 * plan, Task 8 — `specs/features/auth-provider.md`).
 *
 * The automated gate (`pnpm test:ci`) mocks better-auth and Postgres, so it can
 * never answer the question this script answers: does the hosted path actually
 * work, end to end, against a real database, a real SMTP server, and a real
 * Next.js production build? Slice 5 (ADR-019) shipped an object-store backend
 * that passed its full conformance suite while the app was still broken on that
 * backend; only a live smoke caught it. This is the equivalent check for auth,
 * where the failure mode is credential compromise or cross-tenant data leakage
 * rather than a 404.
 *
 * Prerequisites (see scripts/hosted-smoke/README.md for the full run book):
 *   1. docker compose -f scripts/hosted-smoke/compose.yml up -d
 *   2. better-auth migrate against the compose Postgres
 *   3. a GetWrite server running with the hosted-auth env set
 *
 * Usage:
 *   node scripts/hosted-smoke/smoke.mjs
 *
 * Env (all have smoke-appropriate defaults except GETWRITE_DATA_ROOT):
 *   APP_URL             default http://localhost:3000
 *   MAILPIT_URL         default http://localhost:58025
 *   GETWRITE_DATA_ROOT  required — the tenant data root the server was given,
 *                       so on-disk isolation can be verified directly
 *   ALLOWED_DOMAIN      default allowed.test — must match AUTH_SIGNUP_ALLOWLIST
 *
 * Exits non-zero if any check fails.
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:58025";
const DATA_ROOT = process.env.GETWRITE_DATA_ROOT;
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN ?? "allowed.test";

if (!DATA_ROOT) {
  console.error("GETWRITE_DATA_ROOT must be set (same value the server uses).");
  process.exit(2);
}

// A unique run tag keeps re-runs from colliding on the unique email index
// without needing to drop the database between runs.
const RUN = `r${Date.now().toString(36)}`;
const PASSWORD = "smoke-Passw0rd!";

const results = [];
let currentPhase = "";

function phase(title) {
  currentPhase = title;
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

function record(ok, name, detail) {
  results.push({ ok, name, phase: currentPhase, detail });
  const mark = ok ? "\x1b[32m  PASS\x1b[0m" : "\x1b[31m  FAIL\x1b[0m";
  console.log(`${mark}  ${name}${detail ? `\n        ${detail}` : ""}`);
}

function check(name, ok, detail) {
  record(Boolean(ok), name, ok ? undefined : detail);
  return Boolean(ok);
}

function note(text) {
  console.log(`\x1b[36m  NOTE\x1b[0m  ${text}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * better-auth applies a default rate-limit rule of 3 requests per 10s window to
 * every /sign-in* and /sign-up* path, keyed by (client IP, path) — and in
 * production it resolves that IP only from `x-forwarded-for`. Each simulated
 * user therefore gets its own forwarded IP so the two users do not share a
 * bucket, and credential calls are paced within a user.
 */
function ipFor(label) {
  const octet = 10 + (label.charCodeAt(0) - "a".charCodeAt(0)) * 10;
  return `203.0.113.${octet}`;
}

class Session {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  absorb(response) {
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }
  }

  header() {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get authenticated() {
    return [...this.cookies.keys()].some((name) =>
      name.includes("session_token"),
    );
  }
}

/**
 * One HTTP call against the app. `origin` defaults to the app's own origin
 * because the tenant routes reject state-changing requests whose Origin/Referer
 * does not match (`with-storage-context.ts`'s CSRF check) — the smoke has to
 * behave like a browser to test anything past that gate.
 */
async function call(
  pathname,
  { method = "GET", body, session, origin = APP_URL, ip, redirect = "manual" } = {},
) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (origin !== null) headers.origin = origin;
  if (ip) headers["x-forwarded-for"] = ip;
  const cookie = session?.header();
  if (cookie) headers.cookie = cookie;

  const response = await fetch(`${APP_URL}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect,
  });
  if (session) session.absorb(response);

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text, response };
}

async function mailpit(pathname, init) {
  const response = await fetch(`${MAILPIT_URL}${pathname}`, init);
  if (!response.ok) {
    throw new Error(`mailpit ${pathname} -> ${response.status}`);
  }
  return response.status === 200 ? response.json() : undefined;
}

async function clearMail() {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

/**
 * Polls Mailpit for a message to `to`, returning its plain-text body. When
 * `subjectIncludes` is given, only a message whose subject contains it matches —
 * needed to pick the reset email out of an inbox that also holds the earlier
 * verification email.
 */
async function waitForMail(to, { subjectIncludes, timeoutMs = 20_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await mailpit(
      `/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const message = (found?.messages ?? []).find(
      (m) => !subjectIncludes || m.Subject?.toLowerCase().includes(subjectIncludes.toLowerCase()),
    );
    if (message) {
      const full = await mailpit(`/api/v1/message/${message.ID}`);
      return { subject: message.Subject, text: full.Text ?? "", raw: full };
    }
    await sleep(400);
  }
  throw new Error(`no mail for ${to} within ${timeoutMs}ms`);
}

function firstUrl(text) {
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0].replace(/[).,]+$/, "") : null;
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** Signs a user up, verifies via the mailed link, and logs in. */
async function onboard(label, email) {
  const session = new Session(label);
  const ip = ipFor(label);

  const signup = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: `Smoke ${label.toUpperCase()}`, email, password: PASSWORD },
    ip,
  });
  check(
    `${label}: signup accepted for allowlisted address`,
    signup.status === 200,
    `status ${signup.status} ${signup.text.slice(0, 160)}`,
  );

  const mail = await waitForMail(email, { subjectIncludes: "verify" });
  check(
    `${label}: verification email delivered over SMTP`,
    /verify/i.test(mail.subject),
    `subject was ${JSON.stringify(mail.subject)}`,
  );

  const link = firstUrl(mail.text);
  check(`${label}: verification email contains a link`, Boolean(link), mail.text.slice(0, 200));

  // Pace: /sign-in and /sign-up share one 3-per-10s bucket per IP.
  await sleep(1_000);
  const preVerify = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password: PASSWORD },
    ip,
  });
  check(
    `${label}: login refused before email verification`,
    preVerify.status === 403,
    `expected 403, got ${preVerify.status} ${preVerify.text.slice(0, 160)}`,
  );

  const verify = await fetch(link, { redirect: "manual" });
  check(
    `${label}: verification link consumed`,
    verify.status < 400,
    `status ${verify.status}`,
  );

  await sleep(1_000);
  const login = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password: PASSWORD },
    session,
    ip,
  });
  check(
    `${label}: login succeeds after verification`,
    login.status === 200 && session.authenticated,
    `status ${login.status}, cookies=${[...session.cookies.keys()].join(",")}`,
  );

  return { session, ip, email, userId: login.json?.user?.id };
}

async function main() {
  console.log(`GetWrite hosted-auth smoke — run ${RUN}`);
  console.log(`  app        ${APP_URL}`);
  console.log(`  mailpit    ${MAILPIT_URL}`);
  console.log(`  data root  ${DATA_ROOT}`);
  await clearMail();

  // ---------------------------------------------------------------- preflight
  phase("Preflight");
  const status = await call("/api/auth-status");
  check(
    "server reports hosted auth active",
    status.json?.hostedAuthActive === true,
    `GET /api/auth-status -> ${status.status} ${status.text.slice(0, 120)}`,
  );

  // ------------------------------------------------------------ signup gating
  // L1 (FR26): a non-allowlisted signup must be INDISTINGUISHABLE from an
  // allowlisted one — same 200 { token, user } shape — while silently creating
  // no account. Compare its response to a genuine allowlisted signup, then prove
  // no account was actually made (login yields "no such account", not the
  // "unverified" an allowlisted-but-unverified signup would give).
  phase("Signup gating + anti-enumeration (FR12, FR15, L1)");
  const blockedEmail = `${RUN}-blocked@blocked.test`;
  const blocked = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: "Blocked", email: blockedEmail, password: PASSWORD },
    ip: "203.0.113.99",
  });
  const allowedProbeEmail = `${RUN}-probe@${ALLOWED_DOMAIN}`;
  const allowedProbe = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: "Probe", email: allowedProbeEmail, password: PASSWORD },
    ip: "203.0.113.97",
  });
  const shape = (r) =>
    r.status === 200 && r.json && typeof r.json === "object"
      ? JSON.stringify({
          token: r.json.token ?? null,
          userKeys: Object.keys(r.json.user ?? {}).sort(),
        })
      : `status:${r.status}`;
  check(
    "non-allowlisted signup is indistinguishable from an allowlisted one (L1)",
    blocked.status === 200 && shape(blocked) === shape(allowedProbe),
    `blocked=${shape(blocked)} allowed=${shape(allowedProbe)}`,
  );
  check(
    "response never discloses the allowlist",
    !/allow|invite|permitted|not.*create/i.test(blocked.text),
    `body leaked gating detail: ${blocked.text.slice(0, 160)}`,
  );
  // Prove no account was created for the blocked email: login must fail as
  // "no account" (401), not as "unverified" (403 EMAIL_NOT_VERIFIED).
  await sleep(1_000);
  const blockedLogin = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: { email: blockedEmail, password: PASSWORD },
    ip: "203.0.113.99",
  });
  check(
    "no account was actually created for the non-allowlisted email (L1)",
    blockedLogin.status === 401,
    `expected 401 (no account), got ${blockedLogin.status} ${blockedLogin.text.slice(0, 160)}`,
  );

  // ------------------------------------------------------------- user A flow
  phase("User A onboarding (FR11, FR13, FR14)");
  const emailA = `${RUN}-alice@${ALLOWED_DOMAIN}`;
  const a = await onboard("a", emailA);

  phase("Anti-enumeration on duplicate signup (FR15)");
  await sleep(10_000); // clear A's sign-up/sign-in rate-limit window
  const duplicate = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: "Someone Else", email: emailA, password: "another-Passw0rd!" },
    ip: "203.0.113.98",
  });
  check(
    "duplicate signup returns a generic success, not a distinguishable error",
    duplicate.status === 200,
    `status ${duplicate.status} ${duplicate.text.slice(0, 160)}`,
  );

  // --------------------------------------------------- password reset (FR13/H1)
  // Full click-through, on a dedicated user so it doesn't disturb A/B. This is
  // the regression guard for FR26 finding H1: the reset link used to 302 to
  // /reset-password?token=… which 404'd because the app only had a [token]
  // path-segment route. The flow must now: request → email link → follow
  // (302 to the query-param page) → page renders 200 → set a new password →
  // log in with it.
  phase("Password reset flow (FR13, H1 regression guard)");
  const emailC = `${RUN}-carol@${ALLOWED_DOMAIN}`;
  const c = await onboard("c", emailC);
  await sleep(1_000);
  const resetRequest = await call("/api/auth/request-password-reset", {
    method: "POST",
    body: { email: emailC, redirectTo: "/reset-password" },
    ip: c.ip,
  });
  check(
    "c: password-reset request accepted",
    resetRequest.status === 200,
    `status ${resetRequest.status} ${resetRequest.text.slice(0, 160)}`,
  );

  const resetMail = await waitForMail(emailC, { subjectIncludes: "reset" });
  const resetLink = firstUrl(resetMail.text);
  check("c: reset email contains a link", Boolean(resetLink), resetMail.text.slice(0, 200));

  // Follow better-auth's validation endpoint; it 302s to the callback page with
  // the validated token as a query param.
  const followed = await fetch(resetLink, { redirect: "manual" });
  const resetLocation = followed.headers.get("location") ?? "";
  check(
    "c: reset link redirects to the app reset page with a token",
    (followed.status === 302 || followed.status === 307) &&
      resetLocation.includes("/reset-password") &&
      resetLocation.includes("token="),
    `status ${followed.status} location=${resetLocation || "(none)"}`,
  );

  // The H1 assertion: this page must render, not 404.
  const resetPage = await call(
    resetLocation.startsWith("http")
      ? resetLocation.slice(APP_URL.length)
      : resetLocation,
  );
  check(
    "c: reset page renders (H1: was a 404 before the fix)",
    resetPage.status === 200,
    `expected 200, got ${resetPage.status}`,
  );

  const resetToken = new URL(resetLocation, APP_URL).searchParams.get("token");
  const NEW_PASSWORD = "smoke-Reset1!";
  const doReset = await call("/api/auth/reset-password", {
    method: "POST",
    body: { newPassword: NEW_PASSWORD, token: resetToken },
    ip: c.ip,
  });
  check(
    "c: new password accepted via the reset token",
    doReset.status === 200,
    `status ${doReset.status} ${doReset.text.slice(0, 160)}`,
  );

  await sleep(1_000);
  const cReloginNew = new Session("c-new");
  const loginNew = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: { email: emailC, password: NEW_PASSWORD },
    session: cReloginNew,
    ip: c.ip,
  });
  check(
    "c: can log in with the new password",
    loginNew.status === 200 && cReloginNew.authenticated,
    `status ${loginNew.status}`,
  );

  // -------------------------------------------------------- tenant isolation
  phase("Tenant isolation (ADR-017/018 + FR7/FR8)");
  check("user id resolved from session", Boolean(a.userId), "no user id in login response");
  check(
    "user id satisfies the tenant-path allowlist ^[a-z0-9_-]{1,64}$",
    typeof a.userId === "string" && /^[a-z0-9_-]{1,64}$/.test(a.userId),
    `userId=${a.userId}`,
  );

  const emptyA = await call("/api/projects", { session: a.session, ip: a.ip });
  check(
    "A starts with an empty workspace",
    emptyA.status === 200 && Array.isArray(emptyA.json) && emptyA.json.length === 0,
    `status ${emptyA.status} body ${emptyA.text.slice(0, 160)}`,
  );

  const created = await call("/api/projects", {
    method: "POST",
    body: { name: `Smoke Project ${RUN}`, projectType: "blank" },
    session: a.session,
    ip: a.ip,
  });
  check(
    "A can create a project",
    created.status === 200 && Boolean(created.json?.project),
    `status ${created.status} ${created.text.slice(0, 200)}`,
  );

  const listA = await call("/api/projects", { session: a.session, ip: a.ip });
  check(
    "A sees exactly their own project",
    listA.status === 200 && Array.isArray(listA.json) && listA.json.length === 1,
    `status ${listA.status} count=${Array.isArray(listA.json) ? listA.json.length : "n/a"}`,
  );

  const rootA = path.join(DATA_ROOT, String(a.userId));
  const dirsA = (await exists(rootA)) ? await readdir(rootA) : [];
  check(
    "A's project is on disk under their own tenant root",
    dirsA.length === 1 &&
      (await exists(path.join(rootA, dirsA[0], "project.json"))),
    `${rootA} -> ${JSON.stringify(dirsA)}`,
  );

  phase("User B onboarding + cross-tenant check");
  const emailB = `${RUN}-bob@${ALLOWED_DOMAIN}`;
  const b = await onboard("b", emailB);

  const listB = await call("/api/projects", { session: b.session, ip: b.ip });
  check(
    "B sees none of A's data (the isolation proof)",
    listB.status === 200 && Array.isArray(listB.json) && listB.json.length === 0,
    `status ${listB.status} body ${listB.text.slice(0, 200)}`,
  );

  const rootB = path.join(DATA_ROOT, String(b.userId));
  check(
    "B has a separate tenant root",
    a.userId !== b.userId && (await exists(rootB)),
    `rootA=${rootA} rootB=${rootB}`,
  );

  // ----------------------------------------------------------- enforcement
  phase("Route enforcement (FR9, FR18, FR20)");
  const anon = await call("/api/projects");
  check(
    "unauthenticated tenant request is 401",
    anon.status === 401,
    `expected 401, got ${anon.status} ${anon.text.slice(0, 160)}`,
  );

  const crossOrigin = await call("/api/projects", {
    method: "POST",
    body: { name: "CSRF attempt", projectType: "blank" },
    session: a.session,
    ip: a.ip,
    origin: "http://evil.example.test",
  });
  check(
    "cross-origin mutation is rejected (CSRF)",
    crossOrigin.status === 403,
    `expected 403, got ${crossOrigin.status} ${crossOrigin.text.slice(0, 160)}`,
  );

  const noOrigin = await call("/api/projects", {
    method: "POST",
    body: { name: "No origin", projectType: "blank" },
    session: a.session,
    ip: a.ip,
    origin: null,
  });
  check(
    "mutation with no Origin/Referer is rejected (CSRF, fail-closed)",
    noOrigin.status === 403,
    `expected 403, got ${noOrigin.status} ${noOrigin.text.slice(0, 160)}`,
  );

  // L2 (FR26): a same-host, different-port Origin is a distinct browser origin
  // and must be rejected — the CSRF check compares host including port.
  const portOrigin = await call("/api/projects", {
    method: "POST",
    body: { name: "Different port", projectType: "blank" },
    session: a.session,
    ip: a.ip,
    origin: `${new URL(APP_URL).protocol}//${new URL(APP_URL).hostname}:65000`,
  });
  check(
    "same-host different-port Origin is rejected (CSRF, port-sensitive) (L2)",
    portOrigin.status === 403,
    `expected 403, got ${portOrigin.status} ${portOrigin.text.slice(0, 160)}`,
  );

  const pageAnon = await call("/", { redirect: "manual" });
  const location = pageAnon.response.headers.get("location") ?? "";
  check(
    "unauthenticated page request redirects to /login",
    (pageAnon.status === 307 || pageAnon.status === 302) &&
      location.includes("/login"),
    `status ${pageAnon.status} location=${location || "(none)"}`,
  );

  const pageAuthed = await call("/", { session: a.session, ip: a.ip });
  check(
    "authenticated page request is served",
    pageAuthed.status === 200,
    `status ${pageAuthed.status}`,
  );

  // ------------------------------------------------------------- revocation
  phase("Session revocation (FR17)");
  const revoke = await call("/api/auth/revoke-sessions", {
    method: "POST",
    // Empty JSON body so a content-type header is sent: better-auth's
    // /revoke-sessions rejects a bodyless POST with 415 UNSUPPORTED_MEDIA_TYPE.
    body: {},
    session: a.session,
    ip: a.ip,
  });
  check(
    "'log out everywhere' accepted",
    revoke.status === 200,
    `status ${revoke.status} ${revoke.text.slice(0, 160)}`,
  );

  // The DB session row is gone after revoke. Prove that directly by presenting
  // only the session_token (dropping the signed session_data cache cookie): with
  // no cache to satisfy getSession(), the identity source must hit Postgres, find
  // nothing, and 401. This is the guarantee revocation actually provides.
  const tokenOnly = new Session("a-token-only");
  for (const [name, value] of a.session.cookies) {
    if (name.includes("session_token")) tokenOnly.cookies.set(name, value);
  }
  const afterRevokeNoCache = await call("/api/projects", {
    session: tokenOnly,
    ip: a.ip,
  });
  check(
    "revoked session is dead once the cookie cache is bypassed (DB revocation works)",
    afterRevokeNoCache.status === 401,
    `expected 401, got ${afterRevokeNoCache.status} ${afterRevokeNoCache.text.slice(0, 160)}`,
  );

  // Hard gate (FR17/M1). With the full cookie jar — what a real browser or a
  // stolen device sends — the signed session_data cache lets the revoked session
  // survive until the cache expires. M1's fix pins session.cookieCache.maxAge
  // short (auth-server.ts, 10s) so that window is bounded, not the 5-minute
  // default. Wait past that window WITHOUT touching a.session in the meantime (a
  // cache-served read can refresh the cookie), then assert the revoked session is
  // dead. Poll a little past the expected maxAge to stay robust to timing.
  let fullJarStatus = 0;
  const revokeDeadlineMs = Date.now() + 25_000;
  await sleep(11_000); // just past the 10s cookie-cache maxAge
  while (Date.now() < revokeDeadlineMs) {
    const r = await call("/api/projects", { session: a.session, ip: a.ip });
    fullJarStatus = r.status;
    if (fullJarStatus === 401) break;
    await sleep(1_000);
  }
  check(
    "FR17: revoked session becomes unreachable once the cookie-cache window elapses (M1)",
    fullJarStatus === 401,
    `still ${fullJarStatus} ~25s after revoke — cookieCache.maxAge may be too long`,
  );

  // ------------------------------------------------------------ rate limiting
  phase("Rate limiting (FR16)");
  const attackerIp = "198.51.100.7";
  let sawRateLimit = false;
  let attempts = 0;
  for (let i = 0; i < 6 && !sawRateLimit; i += 1) {
    attempts += 1;
    const bad = await call("/api/auth/sign-in/email", {
      method: "POST",
      body: { email: emailA, password: `wrong-${i}` },
      ip: attackerIp,
    });
    if (bad.status === 429) sawRateLimit = true;
  }
  check(
    "repeated failed logins are rate limited",
    sawRateLimit,
    `no 429 after ${attempts} attempts`,
  );
  if (sawRateLimit) note(`429 returned on attempt ${attempts} (default rule: 3 per 10s)`);

  // ------------------------------------------------- informational probes
  phase("Informational probes (not pass/fail)");
  const multiHop = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: { email: emailB, password: "wrong" },
    ip: "198.51.100.50, 10.0.0.1",
  });
  note(
    `multi-hop x-forwarded-for -> status ${multiHop.status}. better-auth's ` +
      "getIPFromHeader trusts a forwarded header only when it holds a single " +
      "value or advanced.ipAddress.trustedProxies is configured; otherwise the " +
      "client IP is null and every caller shares one 'no-trusted-ip' bucket.",
  );

  // ---------------------------------------------------------------- summary
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n\x1b[1mSummary\x1b[0m  ${results.length - failed.length}/${results.length} checks passed`,
  );
  for (const failure of failed) {
    console.log(`  \x1b[31m✗\x1b[0m [${failure.phase}] ${failure.name}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n\x1b[31mSmoke aborted:\x1b[0m ${error.stack ?? error}`);
  process.exit(2);
});
