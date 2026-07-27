import type { MarkdownConstructWarning } from "../export/types";
import { createTransport } from "../../store/transport/create-transport";

export interface CompileBody {
  /**
   * Project's on-disk directory basename (see
   * `selectActiveProjectDirectoryId` in `projectsSlice.ts`) — the
   * `/api/compile/*` routes require this, not an absolute path and not
   * `project.id`.
   */
  projectId: string;
  resourceIds: string[];
  resources: Array<{ id: string; name: string; type: string }>;
  includeHeaders: boolean;
  projectName: string;
}

export interface PdfCompileResult {
  arrayBuffer: ArrayBuffer;
  filename: string;
  warning?: string;
}

export interface DocxCompileResult {
  arrayBuffer: ArrayBuffer;
  filename: string;
}

export interface TextCompileResult {
  text: string;
  filename: string;
}

export interface MarkdownCompileResult {
  markdown: string;
  filename: string;
  /** Loss warnings aggregated across every included section. */
  warnings: MarkdownConstructWarning[];
}

function extractFilename(disposition: string, fallback: string): string {
  return disposition.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

async function postCompileRequest(
  format: string,
  body: CompileBody,
): Promise<Response> {
  const response = await fetch(`/api/compile/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Compile failed (${response.status})`);
  return response;
}

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 5)
//
// One CompileTransport contract with two implementations selected by the
// build-time runtime, mirroring lib/api/projects.ts:
//
// - Web/hosted/desktop -> httpCompileTransport, which carries the original
//   `fetch(...)`-plus-header-parsing bodies verbatim.
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-compile-backend`), dynamically imported
//   only when `runtime === "native"`, reusing the shared compile core
//   (`../models/compile-core.ts`) instead of HTTP. The core already returns
//   this same normalized `{arrayBuffer/text/markdown, filename, ...}` shape
//   directly (FR1), so the native path does zero header parsing.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The compile-route-backed operations both platforms implement. Shared with
 * `../../store/transport/native-compile-backend`, which imports this type
 * rather than duplicating it.
 */
export interface CompileTransport {
  pdf(body: CompileBody): Promise<PdfCompileResult>;
  docx(body: CompileBody): Promise<DocxCompileResult>;
  text(body: CompileBody): Promise<TextCompileResult>;
  markdown(body: CompileBody): Promise<MarkdownCompileResult>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `fetch`-plus-parsing call verbatim; preserving
 * it exactly is what keeps the server build unchanged.
 */
export const httpCompileTransport: CompileTransport = {
  async pdf(body) {
    const response = await postCompileRequest("pdf", body);
    const warning =
      response.headers.get("X-Compile-Warning") === "font-fallback"
        ? "font-fallback"
        : undefined;
    const filename = extractFilename(
      response.headers.get("Content-Disposition") ?? "",
      "project.pdf",
    );
    const arrayBuffer = await response.arrayBuffer();
    return { arrayBuffer, filename, warning };
  },

  async docx(body) {
    const response = await postCompileRequest("docx", body);
    const filename = extractFilename(
      response.headers.get("Content-Disposition") ?? "",
      "project.docx",
    );
    const arrayBuffer = await response.arrayBuffer();
    return { arrayBuffer, filename };
  },

  async text(body) {
    const response = await postCompileRequest("text", body);
    return (await response.json()) as TextCompileResult;
  },

  async markdown(body) {
    const response = await postCompileRequest("markdown", body);
    return (await response.json()) as MarkdownCompileResult;
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-compile-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveCompileTransport: () => Promise<CompileTransport> =
  createTransport(httpCompileTransport, () =>
    import("../../store/transport/native-compile-backend").then(
      ({ createNativeCompileTransport }) => createNativeCompileTransport(),
    ),
  );

export async function compilePdf(body: CompileBody): Promise<PdfCompileResult> {
  const transport = await resolveCompileTransport();
  return transport.pdf(body);
}

export async function compileDocx(
  body: CompileBody,
): Promise<DocxCompileResult> {
  const transport = await resolveCompileTransport();
  return transport.docx(body);
}

export async function compileText(
  body: CompileBody,
): Promise<TextCompileResult> {
  const transport = await resolveCompileTransport();
  return transport.text(body);
}

export async function compileMarkdown(
  body: CompileBody,
): Promise<MarkdownCompileResult> {
  const transport = await resolveCompileTransport();
  return transport.markdown(body);
}
