// Last Updated: 2026-07-25

/**
 * @module store/transport/create-transport
 *
 * **ADR-021 Phase 1 seam.** Generalizes the transport-collapse pattern
 * pioneered by `search-transport.ts` (ADR-021 Phase 0/2): one interface, one
 * HTTP implementation used by the web/desktop build, and one in-process
 * ("native") implementation dynamically imported only when the app is
 * running as a native Capacitor build.
 *
 * `createTransport` centralizes the `runtime === "native"` branch, the
 * dispatch to whichever implementation applies, and the error-propagation
 * contract (errors from either implementation are rethrown untouched — this
 * helper never swallows them). Each call site still supplies its own
 * `loadNative` thunk containing a **literal** dynamic import specifier
 * pointing at its own native backend module, so Turbopack's `resolveAlias`
 * can still substitute a web-stub for that exact specifier at build time —
 * see `next.config.mjs` and `search-transport.ts` (this helper's first
 * caller) for the mechanism this preserves. This module is intentionally
 * generic and contains no dynamic import of its own, and no reference to any
 * specific native backend's module specifier.
 *
 * The runtime check here deliberately uses the raw, directly-inlinable
 * `process.env.NEXT_PUBLIC_GETWRITE_RUNTIME === "native"` comparison rather
 * than `resolveRuntime()`. `resolveRuntime()` remains the source of truth for
 * other, non-bundling-sensitive call sites, but an indirected function call
 * defeats Next.js's build-time env inlining at this specific decision point
 * — see `search-transport.ts`'s original doc comment for the (deliberate,
 * empirically-verified) reasoning this file inherits.
 */

/**
 * Builds a runtime-dispatching transport resolver.
 *
 * @param httpImpl - The web/desktop implementation, used whenever the
 *   runtime is not native. Returned as-is — never invoked or wrapped.
 * @param loadNative - A thunk that dynamically imports and resolves the
 *   native implementation. Only invoked when the runtime is native; never
 *   called eagerly, so the import stays out of the hot path on web/desktop.
 * @returns A zero-argument async resolver that returns the implementation
 *   appropriate for the active runtime.
 */
export function createTransport<T>(
  httpImpl: T,
  loadNative: () => Promise<T>,
): () => Promise<T> {
  return async function resolveTransport(): Promise<T> {
    if (process.env.NEXT_PUBLIC_GETWRITE_RUNTIME === "native") {
      return loadNative();
    }
    return httpImpl;
  };
}
