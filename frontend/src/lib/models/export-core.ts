// Last Updated: 2026-07-26

/**
 * @module export-core
 *
 * **ADR-021 Phase 2 (Task 5) — transport-agnostic export core.** The
 * business logic behind the two `/api/export/*` routes
 * (`app/api/export/text/route.ts`, `markdown/route.ts`), lifted so it can be
 * reused by both the HTTP routes (web/desktop) and the native in-process
 * transport (`store/transport/native-export-backend.ts`) with byte-for-byte
 * identical behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. Per FR1, each function returns the result shape
 * directly — `{text, filename}` / `{markdown, filename, warnings}` — which
 * for these two formats is nearly a no-op passthrough into
 * `NextResponse.json` on the HTTP side already, but the lift still applies
 * for consistency with `compile-core.ts` and for native reuse.
 *
 * `projectId` resolution and validation is handled here, throwing the
 * shared `InvalidProjectIdCoreError` (imported from `project-crud-core.ts`
 * rather than re-declared) when `projectId` is not a well-formed UUID — the
 * route maps that to `respondInvalidProjectId()`; the native backend lets
 * it propagate.
 */
import { compileToText, type CompileSection } from "../export/compile-text";
import {
  compileToMarkdown,
  type MarkdownSection,
} from "../export/compile-markdown";
import { loadTextSections } from "../export/section-loader";
import { slugify } from "../utils";
import type { ResourceMeta, MarkdownConstructWarning } from "../export/types";
import { InvalidProjectIdCoreError } from "./project-crud-core";
import { resolveProjectRoot } from "./project-root-resolver";

/** Request shape shared by {@link exportTextCore} and {@link exportMarkdownCore}. */
export interface ExportCoreBody {
  projectId: string;
  resourceIds: string[];
  resources: ResourceMeta[];
  /** Display name of the resource or folder being exported (used for the filename). */
  exportName: string;
}

/** Result of {@link exportTextCore} — mirrors `lib/api/export.ts`'s `TextExportResult`. */
export interface ExportTextCoreResult {
  text: string;
  filename: string;
}

/** Result of {@link exportMarkdownCore} — mirrors `lib/api/export.ts`'s `MarkdownExportResult`. */
export interface ExportMarkdownCoreResult {
  markdown: string;
  filename: string;
  warnings: MarkdownConstructWarning[];
}

/**
 * Resolves `projectId` to its on-disk project directory, throwing
 * {@link InvalidProjectIdCoreError} (rather than returning a `Response`,
 * which the HTTP routes do via `resolveProjectPath`) when it is not a
 * well-formed UUID.
 */
function resolveProjectPathOrThrow(projectId: string): string {
  const projectPath = resolveProjectRoot(projectId);
  if (!projectPath) {
    throw new InvalidProjectIdCoreError(projectId);
  }
  return projectPath;
}

/**
 * Exports the requested text resources as a single plain-text document.
 * Single resource: no section header. Multiple: section headers included.
 *
 * Lifted verbatim from `POST /api/export/text`'s `handlePost` body.
 */
export async function exportTextCore(
  body: ExportCoreBody,
): Promise<ExportTextCoreResult> {
  const { projectId, resourceIds, resources, exportName } = body;

  const projectPath = resolveProjectPathOrThrow(projectId);

  const sections = await loadTextSections<CompileSection>(
    projectPath,
    resourceIds,
    resources,
    (meta, { plainText }) => ({ name: meta.name, content: plainText ?? "" }),
  );

  // Single resource: no section headers. Multiple: include them.
  const shouldIncludeHeaders = sections.length > 1;
  const text = compileToText(sections, {
    includeHeaders: shouldIncludeHeaders,
  });
  const filename = `${slugify(exportName)}.txt`;

  return { text, filename };
}

/**
 * Exports the requested text resources as a single Markdown document.
 * Single resource: no section header. Multiple: section headers included.
 *
 * Lifted verbatim from `POST /api/export/markdown`'s `handlePost` body.
 */
export async function exportMarkdownCore(
  body: ExportCoreBody,
): Promise<ExportMarkdownCoreResult> {
  const { projectId, resourceIds, resources, exportName } = body;

  const projectPath = resolveProjectPathOrThrow(projectId);

  // Markdown needs the TipTap JSON, not the cached plain text.
  const sections = await loadTextSections<MarkdownSection>(
    projectPath,
    resourceIds,
    resources,
    (meta, { tiptap }) => ({ name: meta.name, doc: tiptap }),
  );

  // Single resource: no section headers. Multiple: include them.
  const shouldIncludeHeaders = sections.length > 1;
  const { markdown, warnings } = compileToMarkdown(sections, {
    includeHeaders: shouldIncludeHeaders,
  });
  const filename = `${slugify(exportName)}.md`;

  return { markdown, filename, warnings };
}
