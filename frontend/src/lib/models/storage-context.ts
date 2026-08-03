// Last Updated: 2026-07-25

/**
 * @module storage-context
 *
 * Request/task-scoped storage context, backed by Node's `AsyncLocalStorage`.
 *
 * This module is the seam through which per-request (or per-task) tenant
 * information — a tenant's project root and the {@link StorageAdapter} to
 * resolve filesystem operations against it — flows implicitly through
 * async call stacks, without threading extra parameters through every
 * function signature.
 *
 * Deliberately depends only on the `StorageAdapter` *type* from `io.ts`
 * (no runtime import) to avoid introducing an import cycle between this
 * module and `io.ts` / `projects-dir.ts`.
 *
 * **ADR-021 Phase 0 (Task 4) addition — the module-scoped default.** Web
 * and desktop bind a fresh {@link StorageContext} per inbound request via
 * `runInStorageContext` (`withStorageContext` for HTTP routes, `runForTenant`
 * for CLI/queue/timer entry points — see `docs/standards/storage-context.md`),
 * because each of those has a natural per-unit-of-work boundary and, for the
 * hosted case, potentially many tenants sharing one process. A native
 * (Capacitor) build has neither: it is one long-lived, single-tenant process
 * with no request boundary at all, so there is nothing to bind a fresh scope
 * *to* on each operation. {@link setDefaultStorageContext} lets a native
 * bootstrap entry point install one process-wide fallback context exactly
 * once at startup; {@link getStorageContext} then transparently returns it
 * whenever no `AsyncLocalStorage` scope is active — which, after startup, is
 * every call on the native path, including fire-and-forget indexer/
 * backlinks-watcher work that isn't nested inside any explicit
 * `runInStorageContext` scope. Because the fallback is a plain module
 * variable read at call time (not something threaded through async
 * causality), it reaches that fire-and-forget work too, with no rebinding
 * required.
 *
 * Web and desktop never call {@link setDefaultStorageContext}, so this
 * fallback stays `undefined` there and `getStorageContext()` behaves exactly
 * as before: `undefined` outside of any explicit `runInStorageContext` scope.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { StorageAdapter } from "./io";

/**
 * The values scoped to a single request/task: the tenant's project root
 * directory and the storage adapter to use for filesystem operations
 * within that scope.
 *
 * `projectRoot` names the single project the scope operates on, when there is
 * one. It is what lets `io.ts`'s mutating wrappers consult the write barrier
 * (`write-barrier.ts`) at write time. Left unset by scopes that span projects
 * (a project listing) or belong to none (the keyring, the project-name index) —
 * neither of which is ever barred.
 */
export type StorageContext = {
  tenantRoot: string;
  adapter: StorageAdapter;
  projectRoot?: string;
};

/**
 * Module-level `AsyncLocalStorage` instance holding the active
 * {@link StorageContext} for the current async execution chain.
 */
const als = new AsyncLocalStorage<StorageContext>();

/**
 * Module-scoped fallback {@link StorageContext}, installed exactly once by a
 * native bootstrap entry point via {@link setDefaultStorageContext}.
 * `undefined` on every platform that never calls it (web, desktop, tests).
 */
let defaultContext: StorageContext | undefined;

/**
 * Runs `fn` with `ctx` bound as the active {@link StorageContext} for the
 * duration of its (possibly asynchronous) execution, including across
 * `await` boundaries within `fn`.
 *
 * @param ctx - The storage context to bind for this invocation.
 * @param fn - The callback to execute within the bound context.
 * @returns Whatever `fn` returns (synchronously or as a `Promise`).
 */
export function runInStorageContext<T>(ctx: StorageContext, fn: () => T): T {
  return als.run(ctx, fn);
}

/**
 * Installs the process-wide default {@link StorageContext}, consulted by
 * {@link getStorageContext} whenever no `AsyncLocalStorage` scope is active.
 *
 * Intended to be called exactly once, at native app startup (ADR-021 Phase
 * 0, FR5) — see `native-bootstrap.ts`. Calling it again simply replaces the
 * installed default; this function does not itself enforce single-call
 * discipline, since doing so here would make legitimate test-reset flows
 * awkward. Callers that need single-invocation enforcement (the real native
 * bootstrap) own that guarantee themselves.
 *
 * @param ctx - The context to install as the process-wide fallback.
 */
export function setDefaultStorageContext(ctx: StorageContext): void {
  defaultContext = ctx;
}

/**
 * Test-only reset of the module-scoped default installed via
 * {@link setDefaultStorageContext}, so unit tests can prove
 * {@link getStorageContext}'s pre-bootstrap (`undefined`) behavior without
 * cross-test leakage.
 */
export function __resetDefaultStorageContextForTests(): void {
  defaultContext = undefined;
}

/**
 * Retrieves the {@link StorageContext} currently bound via
 * {@link runInStorageContext}, if any; otherwise falls back to the
 * process-wide default installed via {@link setDefaultStorageContext}, if
 * one has been installed.
 *
 * @returns The active storage context, the installed default, or
 * `undefined` when neither is present.
 */
export function getStorageContext(): StorageContext | undefined {
  return als.getStore() ?? defaultContext;
}
