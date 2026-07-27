import type { ColorMode } from "../user-preferences";
import { createTransport } from "../../store/transport/create-transport";

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 4)
//
// One PreferencesTransport contract with two implementations selected by the
// build-time runtime, mirroring lib/api/projects.ts:
//
// - Web/hosted/desktop -> httpPreferencesTransport, which carries the
//   original `fetch(...)` calls byte-for-byte, including
//   `saveProjectPreferences`'s fire-and-forget (no response check, no
//   return value) behavior and `saveRevisionSettings`'s throw-on-`!ok`
//   behavior (with the error message read from the response body).
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-preferences-backend`), dynamically
//   imported only when `runtime === "native"`, reusing the shared project
//   preferences core (`../models/project-preferences-core.ts`) instead of
//   HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The preferences/revision-settings-route-backed operations both platforms
 * implement. Shared with `../../store/transport/native-preferences-backend`,
 * which imports this type rather than duplicating it.
 */
export interface PreferencesTransport {
  /** Persists per-project user preferences. Fire-and-forget — no return value. */
  savePreferences(
    projectId: string,
    preferences: { colorMode?: ColorMode },
  ): Promise<void>;
  /** Persists the default revision name. Throws on failure. */
  saveRevisionSettings(
    projectId: string,
    defaultRevisionName: string,
  ): Promise<{ defaultRevisionName?: string }>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `fetch` call verbatim; preserving it exactly is
 * what keeps the server build unchanged.
 */
export const httpPreferencesTransport: PreferencesTransport = {
  async savePreferences(projectId, preferences) {
    await fetch("/api/project/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, preferences }),
    });
  },

  async saveRevisionSettings(projectId, defaultRevisionName) {
    const response = await fetch("/api/project/revision-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, defaultRevisionName }),
    });
    const body = (await response.json().catch(() => null)) as {
      defaultRevisionName?: string;
      error?: string;
    } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? "Failed to save default revision name.");
    }
    return body ?? {};
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-preferences-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolvePreferencesTransport: () => Promise<PreferencesTransport> =
  createTransport(httpPreferencesTransport, () =>
    import("../../store/transport/native-preferences-backend").then(
      ({ createNativePreferencesTransport }) =>
        createNativePreferencesTransport(),
    ),
  );

/**
 * Persists per-project user preferences (currently: color mode).
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/preferences` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function saveProjectPreferences(
  projectId: string,
  preferences: { colorMode?: ColorMode },
): Promise<void> {
  const transport = await resolvePreferencesTransport();
  await transport.savePreferences(projectId, preferences);
}

/**
 * Persists the default revision name used when creating new revisions.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/revision-settings` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function saveRevisionSettings(
  projectId: string,
  defaultRevisionName: string,
): Promise<{ defaultRevisionName?: string }> {
  const transport = await resolvePreferencesTransport();
  return transport.saveRevisionSettings(projectId, defaultRevisionName);
}
