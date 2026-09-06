/**
 * Covers the runtime-aware download seam (`src/lib/compile/download-file.ts`)
 * and its native backend.
 *
 * The bug this seam fixes was invisible to tests precisely because the web
 * path "succeeds" everywhere: `a.click()` on an object URL throws nothing in
 * an Android WebView, it simply produces no file. So the assertions that
 * matter here are about the *outcome* each runtime reports back — a web
 * download reports `browser-download` and needs no announcement, while a
 * native save must report the location so the caller can tell the user where
 * the file went.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const writeFile = vi.fn();

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: (...args: unknown[]) => writeFile(...args) },
  Directory: { Documents: "DOCUMENTS", Data: "DATA", External: "EXTERNAL" },
}));

describe("downloadFile — web runtime", () => {
  const originalRuntime = process.env.NEXT_PUBLIC_GETWRITE_RUNTIME;

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_GETWRITE_RUNTIME = "web";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GETWRITE_RUNTIME = originalRuntime;
    vi.restoreAllMocks();
  });

  it("hands the blob to the browser and reports a browser download", async () => {
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
    });

    const clicks: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") {
        (el as HTMLAnchorElement).click = () => {
          clicks.push(el as HTMLAnchorElement);
        };
      }
      return el;
    }) as typeof document.createElement);

    const { downloadFile } =
      await import("../../src/lib/compile/download-file");
    const outcome = await downloadFile(
      new Blob(["hello"], { type: "text/plain" }),
      "manuscript.txt",
    );

    expect(outcome).toEqual({ kind: "browser-download" });
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe("manuscript.txt");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    // The native plugin must not be touched on the web path.
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe("createNativeFileDownloader", () => {
  beforeEach(() => {
    vi.resetModules();
    writeFile.mockReset();
    writeFile.mockResolvedValue({
      uri: "file:///storage/emulated/0/Documents/x",
    });
  });

  it("writes base64 to the public Documents directory and reports the location", async () => {
    const { createNativeFileDownloader } =
      await import("../../src/lib/compile/native-download-backend");

    const outcome = await createNativeFileDownloader()(
      new Blob(["hello"], { type: "text/plain" }),
      "manuscript.txt",
    );

    expect(writeFile).toHaveBeenCalledTimes(1);
    const arg = writeFile.mock.calls[0][0];
    expect(arg.path).toBe("manuscript.txt");
    // Documents is the only directory that is user-visible in the Files app
    // and survives uninstall — see the module doc for the on-device check.
    expect(arg.directory).toBe("DOCUMENTS");
    // The plugin expects bare base64, not a `data:` URL.
    expect(arg.data).not.toMatch(/^data:/);
    expect(atob(arg.data)).toBe("hello");

    expect(outcome).toEqual({
      kind: "saved-to-file",
      location: "Documents/manuscript.txt",
    });
  });

  it("propagates a write failure instead of reporting a silent success", async () => {
    writeFile.mockRejectedValue(new Error("no space left on device"));
    const { createNativeFileDownloader } =
      await import("../../src/lib/compile/native-download-backend");

    await expect(
      createNativeFileDownloader()(new Blob(["x"]), "a.txt"),
    ).rejects.toThrow("no space left on device");
  });
});

describe("native-download-backend.web-stub", () => {
  it("throws if it is ever reached in a web build", async () => {
    const { createNativeFileDownloader } =
      await import("../../src/lib/compile/native-download-backend.web-stub");
    expect(() => createNativeFileDownloader()).toThrow(
      /should\s+never be invoked/,
    );
  });
});
