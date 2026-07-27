import type { MarkdownConstructWarning } from "../export/types";
import { createTransport } from "../../store/transport/create-transport";

/**
 * Request body shared by the text and markdown export endpoints (identical
 * shape; only their result types differ).
 */
export interface ExportBody {
  /**
   * The project's on-disk directory basename (see
   * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
   * `StoredProject.id` — the export routes resolve it via
   * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
   */
  projectId: string;
  resourceIds: string[];
  resources: Array<{ id: string; name: string; type: string }>;
  /** Display name of the resource or folder being exported (used for the filename). */
  exportName: string;
}

/** Alias of {@link ExportBody} — the markdown export's request body. */
export type MarkdownExportBody = ExportBody;
/** Alias of {@link ExportBody} — the text export's request body. */
export type TextExportBody = ExportBody;

export interface MarkdownExportResult {
  markdown: string;
  filename: string;
  warnings: MarkdownConstructWarning[];
}

export interface TextExportResult {
  text: string;
  filename: string;
}

async function postExportRequest(
  format: string,
  body: TextExportBody | MarkdownExportBody,
): Promise<Response> {
  const response = await fetch(`/api/export/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  return response;
}

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 5)
//
// One ExportTransport contract with two implementations selected by the
// build-time runtime, mirroring lib/api/projects.ts:
//
// - Web/hosted/desktop -> httpExportTransport, which carries the original
//   `fetch(...)` calls verbatim.
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-export-backend`), dynamically imported
//   only when `runtime === "native"`, reusing the shared export core
//   (`../models/export-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The export-route-backed operations both platforms implement. Shared with
 * `../../store/transport/native-export-backend`, which imports this type
 * rather than duplicating it.
 */
export interface ExportTransport {
  text(body: TextExportBody): Promise<TextExportResult>;
  markdown(body: MarkdownExportBody): Promise<MarkdownExportResult>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `fetch` call verbatim; preserving it exactly is
 * what keeps the server build unchanged.
 */
export const httpExportTransport: ExportTransport = {
  async text(body) {
    const response = await postExportRequest("text", body);
    return (await response.json()) as TextExportResult;
  },

  async markdown(body) {
    const response = await postExportRequest("markdown", body);
    return (await response.json()) as MarkdownExportResult;
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-export-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveExportTransport: () => Promise<ExportTransport> =
  createTransport(httpExportTransport, () =>
    import("../../store/transport/native-export-backend").then(
      ({ createNativeExportTransport }) => createNativeExportTransport(),
    ),
  );

/**
 * Export one or more text resources as a single plain-text file. The server
 * reads each resource's current saved content from disk, so the output always
 * reflects the latest autosave (not a client-side snapshot).
 */
export async function exportText(
  body: TextExportBody,
): Promise<TextExportResult> {
  const transport = await resolveExportTransport();
  return transport.text(body);
}

/**
 * Export one or more text resources as a single Markdown file. The server loads
 * each resource's TipTap document, serializes it to GitHub Flavored Markdown,
 * and returns the assembled file plus any loss warnings.
 */
export async function exportMarkdown(
  body: MarkdownExportBody,
): Promise<MarkdownExportResult> {
  const transport = await resolveExportTransport();
  return transport.markdown(body);
}
