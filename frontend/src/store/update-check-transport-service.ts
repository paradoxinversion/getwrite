/**
 * @module update-check-transport-service
 *
 * HTTP transport for the update notice. Calls `GET /api/version-check` and
 * returns the typed result. Any network or parse failure resolves to
 * `{ updateAvailable: false }` so the caller never has to guard against errors
 * (the notice simply does not appear).
 *
 * ADR-021 Phase 1 (Task 6, FR7): wired through `createTransport` so a native
 * (Capacitor) build resolves this without any HTTP call. The update notice
 * checks GitHub releases for the desktop (Electron) distribution, which has
 * no analogue on a native Android build (updates flow through the Play
 * Store instead), so the native implementation is a hardcoded
 * `{ updateAvailable: false }` constant that never invokes the GitHub
 * release check or makes any HTTP call. Because that native implementation
 * has no server-only imports, it is safe to inline directly in this module
 * with no dynamic `import()` and no `resolveAlias` web-stub entry, unlike
 * the Task 2-5 native backends.
 */
import type { UpdateCheckResult } from "../lib/models/update-check";
import { createTransport } from "./transport/create-transport";

const NO_UPDATE: UpdateCheckResult = { updateAvailable: false };

/**
 * Web/hosted/desktop implementation: fetches `/api/version-check`. Any
 * network or parse failure, or non-OK response, resolves to
 * `{ updateAvailable: false }` rather than throwing.
 */
async function httpUpdateCheck(): Promise<UpdateCheckResult> {
  try {
    const response = await fetch("/api/version-check");
    if (!response.ok) {
      return NO_UPDATE;
    }
    return (await response.json()) as UpdateCheckResult;
  } catch {
    return NO_UPDATE;
  }
}

/**
 * Native (Capacitor) implementation: hardcodes the no-update result. Per
 * FR7, this must never invoke the GitHub release check or make any HTTP
 * call.
 */
async function nativeUpdateCheck(): Promise<UpdateCheckResult> {
  return NO_UPDATE;
}

const resolveUpdateCheckTransport: () => Promise<
  () => Promise<UpdateCheckResult>
> = createTransport(httpUpdateCheck, async () => nativeUpdateCheck);

/** Fetches the current update-check result. Never throws. */
export async function fetchUpdateCheck(): Promise<UpdateCheckResult> {
  const transport = await resolveUpdateCheckTransport();
  return transport();
}
