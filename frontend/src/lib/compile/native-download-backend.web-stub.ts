// Last Updated: 2026-09-06

/**
 * @module native-download-backend.web-stub
 *
 * Build-time substitute for `native-download-backend.ts` in web/desktop
 * builds, wired up by `next.config.mjs`'s `turbopack.resolveAlias`. The real
 * module statically imports `@capacitor/filesystem`, which must never enter
 * the web bundle; this stub has no such import, so aliasing the specifier
 * keeps the plugin out of the graph entirely.
 */
import type { FileDownloader } from "./download-file-types";

/**
 * Same export shape as the real module's factory, so Turbopack's substitute
 * module is structurally compatible. Throws if ever actually reached, which
 * would only happen if the build-time exclusion above stopped applying.
 */
export function createNativeFileDownloader(): FileDownloader {
  throw new Error(
    "native-download-backend.web-stub: the native file downloader was " +
      "reached in a web/desktop build. This stub replaces the real native " +
      "backend via next.config.mjs's turbopack.resolveAlias and should " +
      "never be invoked — see this file's module doc.",
  );
}
