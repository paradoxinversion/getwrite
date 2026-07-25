// Last Updated: 2026-07-24

/**
 * @module store/transport/runtime
 *
 * **ADR-021 seam.** Reports which runtime the client bundle is executing in, so
 * the transport layer can dispatch either over HTTP (hosted/desktop, where a
 * Next.js server answers `/api/*`) or in-process (a native Capacitor build with
 * no server). The value is fixed at build time via a public env var that
 * Next.js inlines into the bundle, so the branch is statically analyzable and
 * the server-only native backend tree-shakes out of the web build.
 */

/** The two execution modes the transport layer supports. */
export type GetWriteRuntime = "web" | "native";

/**
 * Resolves the active runtime. Defaults to `"web"` (HTTP transport) unless the
 * native build explicitly sets `NEXT_PUBLIC_GETWRITE_RUNTIME=native`. Kept as a
 * function (not a constant) so tests can drive both branches by setting the env
 * var before import; production reads the value Next.js inlined at build time.
 */
export function resolveRuntime(): GetWriteRuntime {
  return process.env.NEXT_PUBLIC_GETWRITE_RUNTIME === "native"
    ? "native"
    : "web";
}
