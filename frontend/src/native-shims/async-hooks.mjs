// ADR-021 Phase 0 — on-device harness bundle shim for `node:async_hooks`.
//
// `storage-context.ts` statically imports `AsyncLocalStorage` at module load,
// which does not exist in a WebView. On the native path (Task 4), ALS `.run()`
// is never used for storage resolution — everything flows through the
// module-scoped `defaultContext` installed by `native-bootstrap.ts`, so
// `getStore()` only ever needs to return `undefined` for the fallback to kick
// in. This shim provides exactly that, plus a best-effort *synchronous* `run()`
// for completeness.
//
// LIMITATION (intentional, safe for this harness): this `run()` does NOT
// propagate context across `await` boundaries the way the real AsyncLocalStorage
// does — it only holds the store for the synchronous portion of the callback.
// The native storage path does not rely on that propagation (it uses the
// default context), so the limitation never affects the harness. Do not reuse
// this shim anywhere that depends on true async-causality propagation.

export class AsyncLocalStorage {
  constructor() {
    this._store = undefined;
  }

  run(store, callback, ...args) {
    const previous = this._store;
    this._store = store;
    try {
      return callback(...args);
    } finally {
      this._store = previous;
    }
  }

  getStore() {
    return this._store;
  }

  enterWith(store) {
    this._store = store;
  }

  exit(callback, ...args) {
    const previous = this._store;
    this._store = undefined;
    try {
      return callback(...args);
    } finally {
      this._store = previous;
    }
  }

  disable() {
    this._store = undefined;
  }
}

export default { AsyncLocalStorage };
