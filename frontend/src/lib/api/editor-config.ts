import type { EditorBodyConfig } from "../models/types";
import type { EditorHeadingMap } from "../editor-heading-settings";
import { createTransport } from "../../store/transport/create-transport";

interface EditorConfigResponse {
  editorConfig?: { headings?: EditorHeadingMap; body?: EditorBodyConfig };
  error?: string;
}

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 4)
//
// One EditorConfigTransport contract with two implementations selected by
// the build-time runtime, mirroring lib/api/projects.ts:
//
// - Web/hosted/desktop -> httpEditorConfigTransport, which carries the
//   original `fetch(...)` calls byte-for-byte, including both methods'
//   throw-on-`!ok` behavior (with the error message read from the response
//   body).
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-editor-config-backend`), dynamically
//   imported only when `runtime === "native"`, reusing the shared editor
//   config core (`../models/editor-config-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The editor-config-route-backed operations both platforms implement.
 * Shared with `../../store/transport/native-editor-config-backend`, which
 * imports this type rather than duplicating it.
 */
export interface EditorConfigTransport {
  /** Persists per-project heading typography settings. Throws on failure. */
  saveHeadings(
    projectId: string,
    headings: EditorHeadingMap,
  ): Promise<EditorConfigResponse>;
  /** Persists per-project body-text typography settings. Throws on failure. */
  saveBody(
    projectId: string,
    body: EditorBodyConfig,
  ): Promise<EditorConfigResponse>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `fetch` call verbatim; preserving it exactly is
 * what keeps the server build unchanged.
 */
export const httpEditorConfigTransport: EditorConfigTransport = {
  async saveHeadings(projectId, headings) {
    const response = await fetch("/api/project/editor-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, headings }),
    });
    const body = (await response
      .json()
      .catch(() => null)) as EditorConfigResponse | null;
    if (!response.ok) {
      throw new Error(body?.error ?? "Failed to save heading settings.");
    }
    return body ?? {};
  },

  async saveBody(projectId, body) {
    const response = await fetch("/api/project/editor-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, body }),
    });
    const responseBody = (await response
      .json()
      .catch(() => null)) as EditorConfigResponse | null;
    if (!response.ok) {
      throw new Error(responseBody?.error ?? "Failed to save body settings.");
    }
    return responseBody ?? {};
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-editor-config-backend")` specifier
 * so Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveEditorConfigTransport: () => Promise<EditorConfigTransport> =
  createTransport(httpEditorConfigTransport, () =>
    import("../../store/transport/native-editor-config-backend").then(
      ({ createNativeEditorConfigTransport }) =>
        createNativeEditorConfigTransport(),
    ),
  );

/**
 * Persists per-project heading typography settings.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/editor-config` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function saveHeadingSettings(
  projectId: string,
  headings: EditorHeadingMap,
): Promise<EditorConfigResponse> {
  const transport = await resolveEditorConfigTransport();
  return transport.saveHeadings(projectId, headings);
}

/**
 * Persists per-project body-text typography settings.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/editor-config` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function saveBodySettings(
  projectId: string,
  body: EditorBodyConfig,
): Promise<EditorConfigResponse> {
  const transport = await resolveEditorConfigTransport();
  return transport.saveBody(projectId, body);
}
