// Last Updated: 2026-09-05

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const compilePdfMock = vi.fn();
const compileDocxMock = vi.fn();
const compileTextMock = vi.fn();
const compileMarkdownMock = vi.fn();

vi.mock("../../src/lib/api/compile", () => ({
  compilePdf: (...args: unknown[]) => compilePdfMock(...args),
  compileDocx: (...args: unknown[]) => compileDocxMock(...args),
  compileText: (...args: unknown[]) => compileTextMock(...args),
  compileMarkdown: (...args: unknown[]) => compileMarkdownMock(...args),
}));

const toastInfoMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("../../src/lib/toast-service", () => ({
  toastService: {
    info: (...args: unknown[]) => toastInfoMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

import {
  runCompileAndDownload,
  triggerDownload,
} from "../../src/lib/compile/run-compile-and-download";
import type { CompileBody } from "../../src/lib/api/compile";

const compileBody: CompileBody = {
  projectId: "project-dir-id",
  resourceIds: ["r1", "r2"],
  resources: [
    { id: "r1", name: "Chapter One", type: "text" },
    { id: "r2", name: "Chapter Two", type: "text" },
  ],
  includeHeaders: true,
  projectName: "My Project",
};

describe("runCompileAndDownload", () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    compilePdfMock.mockReset();
    compileDocxMock.mockReset();
    compileTextMock.mockReset();
    compileMarkdownMock.mockReset();
    toastInfoMock.mockReset();
    toastErrorMock.mockReset();

    createObjectURLSpy = vi.fn(() => "blob:mock-url");
    revokeObjectURLSpy = vi.fn();
    // jsdom does not implement these; the shared helper still needs them.
    (
      URL as unknown as { createObjectURL: typeof createObjectURLSpy }
    ).createObjectURL = createObjectURLSpy;
    (
      URL as unknown as { revokeObjectURL: typeof revokeObjectURLSpy }
    ).revokeObjectURL = revokeObjectURLSpy;

    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    clickSpy.mockRestore();
  });

  it("compiles and downloads a PDF, warning on font fallback", async () => {
    compilePdfMock.mockResolvedValue({
      arrayBuffer: new ArrayBuffer(4),
      filename: "project.pdf",
      warning: "font-fallback",
    });

    await runCompileAndDownload(compileBody, {
      format: "pdf",
      compilationName: "",
    });

    expect(compilePdfMock).toHaveBeenCalledWith(compileBody);
    expect(compileDocxMock).not.toHaveBeenCalled();
    expect(compileTextMock).not.toHaveBeenCalled();
    expect(compileMarkdownMock).not.toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalledWith(
      "PDF compiled with fallback fonts — IBM Plex fonts were unreachable",
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("does not warn on PDF compile without font fallback", async () => {
    compilePdfMock.mockResolvedValue({
      arrayBuffer: new ArrayBuffer(4),
      filename: "project.pdf",
    });

    await runCompileAndDownload(compileBody, {
      format: "pdf",
      compilationName: "My Compilation",
    });

    expect(toastInfoMock).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("compiles and downloads a DOCX using a normalized filename", async () => {
    compileDocxMock.mockResolvedValue({
      arrayBuffer: new ArrayBuffer(4),
      filename: "project.docx",
    });

    await runCompileAndDownload(compileBody, {
      format: "docx",
      compilationName: "My Compilation",
    });

    expect(compileDocxMock).toHaveBeenCalledWith(compileBody);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("compiles and downloads Markdown, warning on formatting loss", async () => {
    compileMarkdownMock.mockResolvedValue({
      markdown: "# Title",
      filename: "project.md",
      warnings: [{ label: "Tables" }, { label: "Footnotes" }],
    });

    await runCompileAndDownload(compileBody, {
      format: "md",
      compilationName: "",
    });

    expect(compileMarkdownMock).toHaveBeenCalledWith(compileBody);
    expect(toastInfoMock).toHaveBeenCalledWith(
      "Some formatting couldn't be represented in Markdown: Tables, Footnotes",
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("does not warn on Markdown compile with no loss warnings", async () => {
    compileMarkdownMock.mockResolvedValue({
      markdown: "# Title",
      filename: "project.md",
      warnings: [],
    });

    await runCompileAndDownload(compileBody, {
      format: "md",
      compilationName: "",
    });

    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  it("compiles and downloads plain text as the default/fallback format", async () => {
    compileTextMock.mockResolvedValue({
      text: "Some content",
      filename: "project.txt",
    });

    await runCompileAndDownload(compileBody, {
      format: "txt",
      compilationName: "",
    });

    expect(compileTextMock).toHaveBeenCalledWith(compileBody);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("appends the format extension to a user-supplied name that lacks it", async () => {
    compileTextMock.mockResolvedValue({
      text: "Some content",
      filename: "project.txt",
    });

    let downloadedName: string | undefined;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLAnchorElement.prototype,
      "download",
    );
    Object.defineProperty(HTMLAnchorElement.prototype, "download", {
      configurable: true,
      set(value: string) {
        downloadedName = value;
      },
      get() {
        return downloadedName ?? "";
      },
    });

    await runCompileAndDownload(compileBody, {
      format: "txt",
      compilationName: "My Draft",
    });

    expect(downloadedName).toBe("My Draft.txt");

    if (originalDescriptor) {
      Object.defineProperty(
        HTMLAnchorElement.prototype,
        "download",
        originalDescriptor,
      );
    }
  });

  it("propagates errors from the underlying compile call without catching them", async () => {
    compileTextMock.mockRejectedValue(new Error("network error"));

    await expect(
      runCompileAndDownload(compileBody, {
        format: "txt",
        compilationName: "",
      }),
    ).rejects.toThrow("network error");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("exports triggerDownload for reuse by future call sites", () => {
    expect(typeof triggerDownload).toBe("function");
  });
});
