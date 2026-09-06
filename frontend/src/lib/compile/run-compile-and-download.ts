/**
 * @module lib/compile/run-compile-and-download
 *
 * Shared compile-execute-and-download helper. Extracted from
 * `AppShell.tsx`'s inline `onConfirmCompile` handler so a second call site
 * (entity-scoped compile) can reuse the same format-branching, filename
 * resolution, download-triggering, and toast behavior without duplicating
 * it. The four `lib/api/compile.ts` client functions themselves are
 * untouched.
 *
 * Delivery of the finished bytes is delegated to `download-file.ts`, the
 * runtime seam that keeps the browser's object-URL download on web and writes
 * through `@capacitor/filesystem` on native. Both compile entry points route
 * through here, so both inherit that seam.
 */
import {
  compilePdf,
  compileDocx,
  compileText,
  compileMarkdown,
  type CompileBody,
} from "../api/compile";
import { toastService } from "../toast-service";
import { downloadFile } from "./download-file";

/**
 * Output format a compile run may target, matching
 * `CompilePreviewModal.tsx`'s `CompileFormat`.
 */
export type CompileFormat = "txt" | "md" | "pdf" | "docx";

/**
 * Options controlling a single compile-and-download run.
 */
export interface RunCompileAndDownloadOptions {
  /** Output format selected in the compile UI. */
  format: CompileFormat;
  /** User-supplied compilation name (may be empty, in which case the
   * server-provided filename is used instead). */
  compilationName: string;
}

/**
 * Delivers a compiled blob to the user and announces a native save.
 *
 * Delegates to {@link downloadFile}, the runtime seam that keeps the browser's
 * object-URL download on web and writes through `@capacitor/filesystem` on
 * native — the object-URL path alone is silently inert in an Android WebView,
 * producing no file and no error. On native the file lands somewhere the user
 * has no reason to look unless told, so the location is surfaced in a toast;
 * a browser download announces itself and needs none.
 *
 * @param blob - File contents to download.
 * @param filename - Filename presented to the user's download UI.
 */
export async function triggerDownload(
  blob: Blob,
  filename: string,
): Promise<void> {
  const outcome = await downloadFile(blob, filename);
  if (outcome.kind === "saved-to-file") {
    toastService.info(`Saved to ${outcome.location}`);
  }
}

/**
 * Runs a compile for the requested format and downloads the result,
 * surfacing the same non-blocking toasts the shipped compile confirm
 * handler already does (PDF font-fallback, Markdown formatting loss).
 *
 * Errors from the underlying `lib/api/compile.ts` calls are not caught
 * here — callers that need the existing "Compile failed" toast behavior
 * should wrap this call in their own try/catch, matching `AppShell.tsx`.
 *
 * @param compileBody - Request body forwarded unchanged to the compile
 * client functions.
 * @param options - Format and compilation-name options from the compile UI.
 */
export async function runCompileAndDownload(
  compileBody: CompileBody,
  options: RunCompileAndDownloadOptions,
): Promise<void> {
  const rawName = options.compilationName.trim();

  if (options.format === "pdf") {
    const result = await compilePdf(compileBody);
    if (result.warning === "font-fallback") {
      toastService.info(
        "PDF compiled with fallback fonts — IBM Plex fonts were unreachable",
      );
    }
    await triggerDownload(
      new Blob([result.arrayBuffer], { type: "application/pdf" }),
      rawName
        ? rawName.endsWith(".pdf")
          ? rawName
          : `${rawName}.pdf`
        : result.filename,
    );
    return;
  }

  if (options.format === "docx") {
    const result = await compileDocx(compileBody);
    await triggerDownload(
      new Blob([result.arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      rawName
        ? rawName.endsWith(".docx")
          ? rawName
          : `${rawName}.docx`
        : result.filename,
    );
    return;
  }

  if (options.format === "md") {
    const result = await compileMarkdown(compileBody);
    await triggerDownload(
      new Blob([result.markdown], { type: "text/markdown;charset=utf-8" }),
      rawName
        ? rawName.endsWith(".md")
          ? rawName
          : `${rawName}.md`
        : result.filename,
    );
    if (result.warnings.length > 0) {
      toastService.info(
        `Some formatting couldn't be represented in Markdown: ${result.warnings
          .map((w) => w.label)
          .join(", ")}`,
      );
    }
    return;
  }

  const result = await compileText(compileBody);
  await triggerDownload(
    new Blob([result.text], { type: "text/plain;charset=utf-8" }),
    rawName
      ? rawName.endsWith(".txt")
        ? rawName
        : `${rawName}.txt`
      : result.filename,
  );
}
