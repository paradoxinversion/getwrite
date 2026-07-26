// Last Updated: 2026-07-22

import type React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { shouldRedirectToLogin } from "../../src/lib/auth/session-guard";

/**
 * @module AppLayout
 *
 * Page-route protection for the authenticated app shell (Slice 6, FR20).
 *
 * This is the `(app)` route group's layout — a Next.js parenthesized
 * segment, which does not affect the URL (`/` still resolves to
 * `app/(app)/page.tsx`). The group exists specifically so `/login` (added in
 * a later task as a sibling of `app/(app)/`, not inside it) is never subject
 * to this redirect gate, while every current and future page under
 * `app/(app)/` is.
 *
 * An `async` server component with no `"use client"` directive, so it runs
 * in the Node runtime rather than the Edge runtime — required because the
 * session read it performs is database-backed (Postgres, via
 * `getAuthServer()`), and Edge cannot open that connection; this is FR20's
 * own stated rationale for a Node-runtime layout instead of Edge middleware.
 * It mirrors `withStorageContext`'s wrapper pattern in spirit — a single
 * seam every protected surface routes through before anything downstream
 * runs — even though it is structurally a layout rather than a function
 * wrapper, since page navigation has no single exported handler to wrap the
 * way an API route does.
 *
 * The actual "should this request redirect" decision is
 * `session-guard.ts`'s {@link shouldRedirectToLogin}, kept as a separately
 * unit-tested pure/async function; this component is intentionally a thin
 * wrapper around it: read inbound headers via `next/headers`'s `headers()`
 * (a `Promise` in this Next.js version, hence the `await`), ask the helper
 * whether to redirect, and either `redirect("/login")` (`next/navigation`)
 * or render `children`.
 *
 * ADR-021 Phase 2 adds one exception: the native (Capacitor) build has no
 * hosted auth and no server request to read, and it is a static export where
 * `headers()` isn't available at all — see the native short-circuit at the
 * top of the function body below.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode> {
  // ADR-021: the native (Capacitor) build has no hosted auth and no server /
  // request to read -- and it is a static export, where `headers()` is not
  // available at all. Short-circuit the session gate before touching any
  // request-time API so the layout renders statically. The check is a
  // build-time-inlined env literal, so on web/desktop this branch compiles out
  // and the original auth gate below is unchanged.
  if (process.env.NEXT_PUBLIC_GETWRITE_RUNTIME === "native") {
    return children;
  }

  const requestHeaders = await headers();

  if (await shouldRedirectToLogin(requestHeaders)) {
    redirect("/login");
  }

  return children;
}
