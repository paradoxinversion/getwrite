// Last Updated: 2026-07-26

/**
 * @module compile-core
 *
 * **ADR-021 Phase 2 (Task 5) — transport-agnostic compile core.** The
 * business logic behind the four `/api/compile/*` routes
 * (`app/api/compile/pdf/route.ts`, `docx/route.ts`, `text/route.ts`,
 * `markdown/route.ts`), lifted so it can be reused by both the HTTP routes
 * (web/desktop) and the native in-process transport
 * (`store/transport/native-compile-backend.ts`) with byte-for-byte
 * identical rendering behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response` or sets an HTTP header. Per FR1, each function
 * returns the **same normalized shape `lib/api/compile.ts`'s client-side
 * functions already parse HTTP responses into** (`PdfCompileResult` /
 * `DocxCompileResult` / `TextCompileResult` / `MarkdownCompileResult` —
 * mirrored below as `CompilePdfCoreResult` etc., so this module stays
 * layered under `lib/api/*` rather than importing from it): an `ArrayBuffer`
 * (or `text`/`markdown` string) plus `filename`, with no
 * `Content-Type`/`Content-Disposition`/`X-Compile-Warning` header dance at
 * all. The HTTP routes wrap these results back into the existing
 * header-bearing `Response`/`NextResponse.json` shape; the native backend
 * returns them directly.
 *
 * `projectId` resolution and validation is handled here (not left to
 * callers), throwing the shared `InvalidProjectIdCoreError` (imported from
 * `project-crud-core.ts` rather than re-declared) when `projectId` is not a
 * well-formed UUID — the route maps that to `respondInvalidProjectId()`;
 * the native backend lets it propagate.
 */
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import {
  CompilePDFDocument,
  registerIBMPlexFonts,
} from "../export/CompilePDFDocument";
import { CompilePDFFallbackDocument } from "../export/CompilePDFFallbackDocument";
import { buildDocxDocument, Packer } from "../export/CompileDocxDocument";
import { compileToText, type CompileSection } from "../export/compile-text";
import {
  compileToMarkdown,
  type MarkdownSection,
} from "../export/compile-markdown";
import { loadTextSections } from "../export/section-loader";
import { slugify } from "../utils";
import type { CompileBody, MarkdownConstructWarning } from "../export/types";
import { InvalidProjectIdCoreError } from "./project-crud-core";
import { resolveProjectRoot } from "./project-root-resolver";

/** Result of {@link compilePdfCore} — mirrors `lib/api/compile.ts`'s `PdfCompileResult`. */
export interface CompilePdfCoreResult {
  arrayBuffer: ArrayBuffer;
  filename: string;
  warning?: string;
}

/** Result of {@link compileDocxCore} — mirrors `lib/api/compile.ts`'s `DocxCompileResult`. */
export interface CompileDocxCoreResult {
  arrayBuffer: ArrayBuffer;
  filename: string;
}

/** Result of {@link compileTextCore} — mirrors `lib/api/compile.ts`'s `TextCompileResult`. */
export interface CompileTextCoreResult {
  text: string;
  filename: string;
}

/** Result of {@link compileMarkdownCore} — mirrors `lib/api/compile.ts`'s `MarkdownCompileResult`. */
export interface CompileMarkdownCoreResult {
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

/** True when `err`'s message looks like a font-loading failure (network/404/etc). */
function isFontError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /font|fetch|404|network/i.test(msg);
}

/** Converts a Node `Buffer` to a standalone `ArrayBuffer` (never a view into a shared pool). */
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

/**
 * Compiles the requested text resources into a PDF.
 *
 * Lifted verbatim from `POST /api/compile/pdf`'s `handlePost` body (minus
 * the header construction, which the route reapplies from this result).
 */
export async function compilePdfCore(
  body: CompileBody,
): Promise<CompilePdfCoreResult> {
  const {
    projectId,
    resourceIds,
    resources,
    includeHeaders: shouldIncludeHeaders,
    projectName,
  } = body;

  const projectPath = resolveProjectPathOrThrow(projectId);

  const sections = await loadTextSections<CompileSection>(
    projectPath,
    resourceIds,
    resources,
    (meta, { plainText }) => ({ name: meta.name, content: plainText ?? "" }),
  );

  const filename = `${slugify(projectName)}.pdf`;

  let buffer: Buffer;
  let didFontFallback = false;

  try {
    registerIBMPlexFonts();
    buffer = await renderToBuffer(
      React.createElement(CompilePDFDocument, {
        sections,
        includeHeaders: shouldIncludeHeaders,
      }) as React.ReactElement<DocumentProps>,
    );
  } catch (err) {
    if (!isFontError(err)) throw err;
    didFontFallback = true;
    buffer = await renderToBuffer(
      React.createElement(CompilePDFFallbackDocument, {
        sections,
        includeHeaders: shouldIncludeHeaders,
      }) as React.ReactElement<DocumentProps>,
    );
  }

  return {
    arrayBuffer: bufferToArrayBuffer(buffer),
    filename,
    warning: didFontFallback ? "font-fallback" : undefined,
  };
}

/**
 * Compiles the requested text resources into a DOCX document.
 *
 * Lifted verbatim from `POST /api/compile/docx`'s `handlePost` body (minus
 * the header construction, which the route reapplies from this result).
 */
export async function compileDocxCore(
  body: CompileBody,
): Promise<CompileDocxCoreResult> {
  const {
    projectId,
    resourceIds,
    resources,
    includeHeaders: shouldIncludeHeaders,
    projectName,
  } = body;

  const projectPath = resolveProjectPathOrThrow(projectId);

  const sections = await loadTextSections<CompileSection>(
    projectPath,
    resourceIds,
    resources,
    (meta, { plainText }) => ({ name: meta.name, content: plainText ?? "" }),
  );

  const filename = `${slugify(projectName)}.docx`;

  const doc = buildDocxDocument(sections, {
    includeHeaders: shouldIncludeHeaders,
  });
  const buffer = await Packer.toBuffer(doc);

  return { arrayBuffer: bufferToArrayBuffer(buffer), filename };
}

/**
 * Compiles the requested text resources into a single plain-text document.
 *
 * Lifted verbatim from `POST /api/compile/text`'s `handlePost` body.
 */
export async function compileTextCore(
  body: CompileBody,
): Promise<CompileTextCoreResult> {
  const {
    projectId,
    resourceIds,
    resources,
    includeHeaders: shouldIncludeHeaders,
    projectName,
  } = body;

  const projectPath = resolveProjectPathOrThrow(projectId);

  const sections = await loadTextSections<CompileSection>(
    projectPath,
    resourceIds,
    resources,
    (meta, { plainText }) => ({ name: meta.name, content: plainText ?? "" }),
  );

  const text = compileToText(sections, {
    includeHeaders: shouldIncludeHeaders,
  });
  const filename = `${slugify(projectName)}.txt`;

  return { text, filename };
}

/**
 * Compiles the requested text resources into a single Markdown document.
 *
 * Lifted verbatim from `POST /api/compile/markdown`'s `handlePost` body.
 */
export async function compileMarkdownCore(
  body: CompileBody,
): Promise<CompileMarkdownCoreResult> {
  const {
    projectId,
    resourceIds,
    resources,
    includeHeaders: shouldIncludeHeaders,
    projectName,
  } = body;

  const projectPath = resolveProjectPathOrThrow(projectId);

  // Markdown needs the TipTap JSON, not the cached plain text.
  const sections = await loadTextSections<MarkdownSection>(
    projectPath,
    resourceIds,
    resources,
    (meta, { tiptap }) => ({ name: meta.name, doc: tiptap }),
  );

  const { markdown, warnings } = compileToMarkdown(sections, {
    includeHeaders: shouldIncludeHeaders,
  });
  const filename = `${slugify(projectName)}.md`;

  return { markdown, filename, warnings };
}
