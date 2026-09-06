// Last Updated: 2026-09-06

/**
 * @module download-file
 *
 * The single seam every compiled/exported file passes through on its way to
 * the user, dispatching between the browser's object-URL download and the
 * native Capacitor filesystem write.
 *
 * Before this module existed, the object-URL path was the only path, inlined
 * in `AppShell.tsx`. That works on web and desktop and is silently inert in an
 * Android WebView — see `native-download-backend.ts`'s module doc for the
 * on-device measurement — so every compile format on every entry point
 * produced no file at all on Android while reporting success.
 *
 * Dispatch uses {@link createTransport}, the same mechanism the eleven
 * existing native backends use, so the native module's specifier stays a
 * literal dynamic import that `next.config.mjs`'s `turbopack.resolveAlias`
 * can rewrite to a web-stub at build time.
 */
import { createTransport } from "../../store/transport/create-transport";
import type { DownloadOutcome, FileDownloader } from "./download-file-types";

export type { DownloadOutcome, FileDownloader } from "./download-file-types";

/**
 * The web/desktop download: hand the blob to the browser as an object URL and
 * click a synthetic anchor. Unchanged in behavior from the implementation
 * this module replaced — the browser surfaces its own download UI, so there
 * is no location to report back.
 */
function downloadInBrowser(blob: Blob, filename: string): DownloadOutcome {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { kind: "browser-download" };
}

const webDownloader: FileDownloader = async (blob, filename) =>
  downloadInBrowser(blob, filename);

const resolveDownloader = createTransport<FileDownloader>(
  webDownloader,
  async () => {
    const { createNativeFileDownloader } =
      await import("./native-download-backend");
    return createNativeFileDownloader();
  },
);

/**
 * Delivers a compiled file to the user under the active runtime.
 *
 * @param blob - The compiled output.
 * @param filename - Filename to save under, extension included.
 * @returns How the file was delivered, so callers can tell the user where a
 *   natively-saved file landed. Errors are propagated untouched — a failed
 *   write must surface, never be reported as a silent success.
 */
export async function downloadFile(
  blob: Blob,
  filename: string,
): Promise<DownloadOutcome> {
  const downloader = await resolveDownloader();
  return downloader(blob, filename);
}
