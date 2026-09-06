// Last Updated: 2026-09-06

/**
 * @module download-file-types
 *
 * Shared types for the compile-output download seam, in their own module so
 * both the web implementation and the native backend can import them without
 * either pulling in the other's runtime dependencies. The native backend
 * statically imports `@capacitor/filesystem`, so it must not be reachable
 * from the web bundle — keeping the types here is what lets the web side
 * describe the contract without importing that module.
 */

/**
 * How a compiled file reached the user.
 *
 * The two runtimes deliver a download differently enough that the caller has
 * to be able to tell them apart: a browser announces its own download in
 * chrome the app does not control, whereas a native write lands a file
 * somewhere the user has no reason to look unless told. `location` carries
 * the user-facing path so the caller can name it.
 */
export type DownloadOutcome =
  | { kind: "browser-download" }
  | { kind: "saved-to-file"; location: string };

/** Delivers a compiled blob to the user under the active runtime. */
export type FileDownloader = (
  blob: Blob,
  filename: string,
) => Promise<DownloadOutcome>;
