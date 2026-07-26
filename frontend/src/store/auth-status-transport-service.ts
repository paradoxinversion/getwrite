/**
 * @module auth-status-transport-service
 *
 * HTTP transport for the hosted-vs-local client signal (Slice 6, FR21/FR22).
 * Calls `GET /api/auth-status` and returns the typed result. Mirrors
 * `update-check-transport-service.ts`'s `fetchUpdateCheck` contract exactly:
 * any network or parse failure resolves to `{ hostedAuthActive: false }`, the
 * fail-safe default — a failed check must never cause auth UI to render on
 * what could be a desktop/local build, so callers never have to guard
 * against errors themselves.
 *
 * ADR-021 Phase 1 (Task 6, FR6): wired through `createTransport` so a native
 * (Capacitor) build resolves this without any HTTP call. Hosted auth is a
 * server-only, database-backed concept (`lib/auth/auth-config.ts`'s
 * `isHostedAuthActive()`) that has no meaning on-device, so the native
 * implementation is a hardcoded `{ hostedAuthActive: false }` constant — it
 * deliberately does NOT import or call `isHostedAuthActive()`. Because that
 * native implementation has no server-only imports (no `node:*`, no
 * `lib/auth`, no `lib/models`), it is safe to inline directly in this module
 * with no dynamic `import()` and no `resolveAlias` web-stub entry, unlike the
 * Task 2-5 native backends.
 */
import { createTransport } from "./transport/create-transport";

export interface AuthStatus {
  hostedAuthActive: boolean;
}

const NOT_HOSTED: AuthStatus = { hostedAuthActive: false };

/**
 * Web/hosted/desktop implementation: fetches `/api/auth-status`. Any network
 * or parse failure, or non-OK response, resolves to `{ hostedAuthActive:
 * false }` rather than throwing.
 */
async function httpAuthStatus(): Promise<AuthStatus> {
  try {
    const response = await fetch("/api/auth-status");
    if (!response.ok) {
      return NOT_HOSTED;
    }
    return (await response.json()) as AuthStatus;
  } catch {
    return NOT_HOSTED;
  }
}

/**
 * Native (Capacitor) implementation: hardcodes the fail-safe default. Hosted
 * auth never applies on-device, so there is nothing to check — and, per
 * FR6, this must never delegate to `isHostedAuthActive()`.
 */
async function nativeAuthStatus(): Promise<AuthStatus> {
  return NOT_HOSTED;
}

const resolveAuthStatusTransport: () => Promise<() => Promise<AuthStatus>> =
  createTransport(httpAuthStatus, async () => nativeAuthStatus);

/** Fetches the current hosted-auth status. Never throws. */
export async function fetchAuthStatus(): Promise<AuthStatus> {
  const transport = await resolveAuthStatusTransport();
  return transport();
}
