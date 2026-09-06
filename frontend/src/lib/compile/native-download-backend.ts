// Last Updated: 2026-09-06

/**
 * @module native-download-backend
 *
 * **ADR-021.** The native (Capacitor/Android) counterpart to the web build's
 * blob-URL download, behind the same {@link FileDownloader} contract.
 *
 * **Why this module exists.** The web path creates an object URL and clicks a
 * synthetic `<a download>`. An Android WebView silently discards such a click
 * unless the host registers a `DownloadListener`, and neither this app's Java
 * nor any `@capacitor/*` package registers one. Measured on a Pixel 7 Pro
 * (Android 17 / SDK 37) against the real app: executing the web
 * `triggerDownload` body verbatim in the running WebView completes without
 * throwing and produces **no file anywhere on the device** — Downloads
 * unchanged, nothing on external storage. Every compile format was affected,
 * on every compile entry point, because they all share one download helper.
 *
 * **Where the file goes.** `Directory.Documents`, which Capacitor maps to the
 * device's *public* Documents folder (`/storage/emulated/0/Documents`). That
 * choice was verified on-device rather than assumed: a probe write landed at
 * exactly that path, readable back over `adb`, with no runtime permission
 * prompt and no `AndroidManifest.xml` change. It is visible in the Files app
 * and survives uninstall — the two properties a user-requested export needs.
 *
 * Directories deliberately not used:
 * - `ExternalStorage` — documented as inaccessible on Android 11+.
 * - `External` / `Data` / `Cache` — all writable (also verified), but
 *   app-scoped: effectively invisible to the user and erased on uninstall.
 *
 * **This module is native-only and must never be statically imported** from
 * anything reachable by the web/desktop bundle: it has a top-level `import` of
 * `@capacitor/filesystem`. Callers reach it exclusively through a literal
 * dynamic `import()` that `next.config.mjs`'s `turbopack.resolveAlias`
 * rewrites to `./native-download-backend.web-stub` for non-native builds —
 * the same mechanism every other native backend uses.
 */
import { Filesystem, Directory } from "@capacitor/filesystem";
import type { DownloadOutcome, FileDownloader } from "./download-file-types";

/**
 * Converts a Blob to a bare base64 payload.
 *
 * `Filesystem.writeFile` wants base64 without the `data:<mime>;base64,`
 * prefix that `FileReader.readAsDataURL` produces, so the prefix is stripped
 * here rather than at the call site. Reading via `FileReader` (instead of
 * `Blob.arrayBuffer()` plus manual chunking) keeps this correct for the
 * multi-megabyte PDFs and DOCX blobs compile can produce, where a naive
 * `String.fromCharCode(...bytes)` spread would overflow the call stack.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read compiled output"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Builds the native downloader.
 *
 * Errors from the plugin are rethrown untouched so the caller's existing
 * "Compile failed" toast path still reports them — this backend never
 * swallows a write failure and reports success anyway, which would reproduce
 * the silent-drop bug it exists to fix.
 *
 * @returns A downloader that writes to the device's public Documents folder.
 */
export function createNativeFileDownloader(): FileDownloader {
  return async function downloadOnNative(
    blob: Blob,
    filename: string,
  ): Promise<DownloadOutcome> {
    const data = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    return { kind: "saved-to-file", location: `Documents/${filename}` };
  };
}
