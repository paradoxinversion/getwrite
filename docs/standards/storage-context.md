# Request-Scoped Storage Context

This document applies when adding or modifying Next.js API routes, CLI commands, or
background/queue entry points that resolve a project root or filesystem adapter.

---

## 1. What the Seam Is

`resolveProjectsDir()` (`frontend/src/lib/models/projects-dir.ts`) and
`getStorageAdapter()` (`frontend/src/lib/models/io.ts`) both resolve from an ambient,
`AsyncLocalStorage`-backed `StorageContext` — `{ tenantRoot, adapter }`, defined in
`frontend/src/lib/models/storage-context.ts` — when one is active for the current
async call chain. When no context is active, both fall back to today's process-wide
defaults: `defaultProjectsDir()`'s env-var/cwd resolution for the projects directory,
and the module-level adapter set via `setStorageAdapter()` for the filesystem adapter.

**ADR-021 Phase 0 addition.** `storage-context.ts` also supports a module-scoped
*default* `StorageContext`, installed once via `setDefaultStorageContext()` and
consulted by `getStorageContext()` whenever no `AsyncLocalStorage` scope is
active. This is for the native (Capacitor Android) build only — a long-lived,
single-tenant process with no per-request boundary to bind a scope to —
installed once at startup by `native-bootstrap.ts`. Web and desktop never call
`setDefaultStorageContext()`, so the fallback stays `undefined` there and the
"no context active" behavior described above is unchanged for those platforms.

**ADR-021 Phase 1 usage.** The native in-process transport backends
(`frontend/src/store/transport/native-*-backend.ts` — revision, query,
metadata-schema, feature-config, search) all read through this same
app-lifetime default context rather than establishing their own scope per
call; there is no per-operation `runInStorageContext` rebind on the native
path in production. Each backend accepts an injectable `deps.fs` purely for
test isolation, which does bind a fresh one-off scope, but production calls
never supply it.

This ambient context is the seam per-tenant storage isolation is built on. See
ADR-017
(`docs/architecture/ADRs/adr-017-request-scoped-directory-per-tenant-storage.md`)
for the seam's original rationale and design, and ADR-018
(`docs/architecture/ADRs/adr-018-tenant-resolution-per-user-data-root.md`) for how
`withStorageContext` now chooses which tenant's `tenantRoot` to bind on each
request (Section 2).

---

## 2. Rule: Tenant-Aware API Routes Must Use `withStorageContext`

Any route handler under `frontend/app/api/**/route.ts` that calls
`resolveProjectsDir()` — directly, or transitively through a model-layer function
that expects an ambient context — must export its handler wrapped in
`withStorageContext(...)`, imported from
`frontend/app/api/_tenant/with-storage-context.ts`.

- Do not duplicate an inline `runInStorageContext(...)` call inside the handler body.
- Do not rely on a `middleware.ts` to establish context — this repo has none, and
  this feature does not add one.

Matches the pattern used in `frontend/app/api/projects/route.ts`:

```ts
import { withStorageContext } from "../_tenant/with-storage-context";

async function getProjects() {
  const projectsDir = resolveProjectsDir();
  // ...
}

export const GET = withStorageContext(getProjects);
export const POST = withStorageContext(createProject);
```

As of ADR-018, the `tenantRoot` `withStorageContext` binds is not a hardcoded
`defaultProjectsDir()` call — it is derived per-request by
`resolveTenant(request)` (`frontend/app/api/_tenant/resolve-tenant.ts`):

- A request with no resolved identity (`userId === null` — the Electron/
  local-dev case) resolves `tenantRoot` to `defaultProjectsDir()`, byte-for-byte
  identical to the seam's original behavior.
- A request with a resolved, validated `userId` resolves `tenantRoot` to
  `<data-root>/<userId>/` (`GETWRITE_DATA_ROOT` joined with the validated user
  id), guarded by a path-traversal allowlist and provisioned with an
  idempotent `mkdir(recursive)` on that user's first request. See ADR-018
  (`docs/architecture/ADRs/adr-018-tenant-resolution-per-user-data-root.md`)
  and `frontend/src/lib/models/tenant-path.ts` for the validation/derivation
  logic.

Identity itself comes from the pluggable `IdentitySource` interface
(`frontend/app/api/_tenant/identity-source.ts`), selected via
`getIdentitySource()` — the single swap point for the auth provider. As of
Slice 6 (`specs/features/auth-provider.md`, [ADR-020](../architecture/ADRs/adr-020-hybrid-auth-postgres-better-auth.md)),
`betterAuthIdentitySource` is the real, production implementation, selected
whenever `isHostedAuthActive()` (`DATABASE_URL` + `BETTER_AUTH_SECRET` both
set). `devIdentitySource` and `nullIdentitySource` remain in place for local
dev and desktop/Electron respectively — hosted-auth-active always takes
precedence over the dev source, even if `GETWRITE_ENABLE_DEV_IDENTITY` is
also set. Route authors calling `withStorageContext` do not need to know any
of this; it is internal to the wrapper.

---

## 2a. Rule: Project-Scoped Routes Must Derive `projectRoot` From a Validated `projectId`

`withStorageContext` binds a *tenant's* root (`tenantRoot`); it says nothing about
which *project* within that root a request targets. As of the tenant-route-
enforcement work, every project-scoped route under `frontend/app/api/**/route.ts`
resolves its project directory the same way:

```ts
import { validateProjectId, respondInvalidProjectId, InvalidProjectIdError }
  from "../../../src/lib/models/project-path";

const validatedProjectId = validateProjectId(projectId); // throws InvalidProjectIdError
const projectRoot = path.join(resolveProjectsDir(), validatedProjectId);
```

`validateProjectId` (`frontend/src/lib/models/project-path.ts`) requires the
client-supplied `projectId` to be a well-formed UUID — the same shape every
project directory is named on disk — reusing the `UUID` Zod validator from
`schemas.ts`. Anything else throws `InvalidProjectIdError`, which route handlers
catch and turn into `respondInvalidProjectId()`, a fixed, uniform
`400 { "error": "Invalid projectId" }` response that does not vary based on
whether a same-shaped project actually exists (so it can't be used to probe for
project existence).

This is a hard cutover: these routes no longer accept a client-supplied absolute
`projectRoot`/`projectPath` in the request body or query string. `projectId` is
the only accepted shape. The exceptions — routes that predate this migration and
were deliberately left out of scope — are:
`frontend/app/api/projects/route.ts`,
`frontend/app/api/projects/[projectId]/reorder/route.ts` (still resolves via
`projectId` but keeps a legacy `projectRoot` body fallback),
`frontend/app/api/project/[project-id]/reindex/route.ts`, and
`frontend/app/api/project/[project-id]/search/route.ts`.

**Client-side counterpart.** Do not send `project.id` (the `StoredProject.id`
field mirrored from `project.json`'s internal `id`) to these routes — it is a
*different* UUID from the project's on-disk directory name, and sending it is a
silent failure (wrong-or-missing directory), not an auth error. The one
sanctioned way to obtain the directory id client-side is the Redux selector
`selectActiveProjectDirectoryId` (`frontend/src/store/projectsSlice.ts`), which
computes `path.basename(rootPath)` on the active project's root path (via the
`getProjectDirectoryId` helper in the same file — implemented as string
splitting rather than importing `path`, since this slice is bundled into the
client). Every client call site sending a tenant-scoped `projectId` to one of
these routes must go through this selector (or `getProjectDirectoryId` directly,
for a project record that isn't the Redux-selected active project).

---

## 3. Rule: Out-of-Request Entry Points Must Use `runForTenant`

Code that runs outside an inbound HTTP request — CLI commands under
`cli/src/commands/*`, the indexer queue, the backlinks watcher, and any future
background job — must establish its own storage context. Use `runForTenant`
(the imperative sibling of `withStorageContext`, exported from `io.ts` /
`@gw/core`) rather than hand-writing the context literal:

```ts
runForTenant(projectRoot, () => /* work */);
```

- `runForTenant` derives `tenantRoot` as `path.dirname(projectRoot)` so it matches
  the value `resolveProjectsDir()` returns in a request (the *parent* dir that
  contains project folders), keeping route and non-route contexts consistent.
- Call it at the point where a concrete project root is available.
- Scope it to the smallest unit of work: a single CLI command invocation, a single
  queued indexing task, a single recompute callback.
- Do not hold a context as long-lived or shared across multiple units of work.
- Do not duplicate the raw `runInStorageContext({ tenantRoot, adapter }, ...)`
  literal at call sites — that is what `runForTenant` exists to prevent.

**Deferred work must capture the adapter early.** `runForTenant`'s adapter
defaults to whatever is active at the call site — correct for synchronous entry
points (a CLI `.action()`). But work that runs *later* (a queue drain, a debounce
timer) executes with no ambient context, so the default would resolve to the
module fallback rather than the enqueuing scope's adapter. Capture the adapter at
enqueue/watch time and pass it as the third argument:

```ts
const adapter = getStorageAdapter();      // captured in the request scope
queue.push({ projectRoot, resourceId, adapter });
// …later, at drain time:
runForTenant(task.projectRoot, () => /* work */, task.adapter);
```

Real examples: `cli/src/commands/prune.ts` (wraps the `.action()` body per
invocation, default adapter), `frontend/src/lib/models/indexer-queue.ts` (captures
the adapter in `enqueueIndex` and passes it to `runForTenant` in `runTask`), and
`frontend/src/lib/models/backlinks-watcher.ts` (captures the adapter when the
watcher starts and passes it to each debounced recompute).

---

## 4. No Silent Fallback for Tenant-Scoped-Required Paths

Today's fallback — resolving to `defaultProjectsDir()` / the module-level adapter
when no context is active — legitimately mirrors legacy single-tenant behavior
byte-for-byte, and is correct and intentional for Electron and local dev.

For future work: if a code path requires a tenant-scoped context and has no defined
fallback, it must fail with an explicit, identifiable error rather than silently
resolving to the process-default projects directory. Do not add a new fallback that
masks a missing context for such paths.

`resolveTenant` (ADR-018) is a concrete instance of this rule: a non-null
`userId` that fails the path-traversal allowlist, or a missing/empty
`GETWRITE_DATA_ROOT`, throws `TenantResolutionError`
(`frontend/src/lib/models/tenant-path.ts`) rather than falling back to
`defaultProjectsDir()`.

---

## 5. The Model Data Path Routes Through the Adapter

The model layer's **data path** is fully adapter-routed: every file under
`frontend/src/lib/models/` performs its filesystem I/O through the `io.ts`
wrappers (`readFile`, `readFileBuffer`, `writeFile`, `mkdir`, `readdir`, `stat`,
`rm`, `rename`, `copyFile`, `cp`, `appendFile`, `atomicWriteFile`, `exists`),
which resolve `StorageContext.adapter` per call. As a result, isolation is
delivered by **both** the resolved `tenantRoot` (path prefix) **and** the
per-request `adapter` — the seam is now honored end-to-end, so injecting an
alternate backend (a distinct real-fs adapter per request, S3/R2, etc.) is a
backend swap that all model code respects with no direct-`fs` bypass.

New model code must import filesystem operations from `io.ts`, never
`node:fs`/`node:fs/promises` (a bare `import type { Dirent } from "node:fs"` is
fine). If a model function needs an operation the `StorageAdapter` contract does
not model, extend the contract (interface + real-fs default in `io.ts` +
`memoryAdapter.ts` + a wrapper export) rather than reaching for `node:fs`.

**Documented exception — the backlinks watcher.** `backlinks-watcher.ts` uses
`fs.watch` (a long-lived recursive `FSWatcher`) and its `existsSync` setup check
directly against `node:fs`. The adapter models discrete operations, not
watchers; the watcher is a local/desktop reindex optimization that is gated off
under test and is not meaningful for a hosted deployment (where change
notification is a different mechanism). Its *recompute* path already runs
through the adapter via `runForTenant`. This is one intentional direct-`fs`
site in the model layer.

**Sanctioned direct-`fs` sites — the storage backends themselves.** `io.ts`
(the default adapter), `memoryAdapter.ts` (in-memory), and `object-store.ts`'s
`createFsObjectStore` (the filesystem-backed object store) use `node:fs`
directly because they *are* storage backends, not model data-path code — the
same category as the exception above. They are the concrete ends the wrappers
resolve to, so the "route through the adapter" rule does not apply to them.

### Route handlers route tenant data through the adapter too

The `io.ts` rule extends past `src/lib/models/`: API route handlers under
`app/api/` that read or write **tenant data** (project files, resource content,
revisions, folders, sidecars, media) must also go through the `io.ts` wrappers,
not `node:fs` — otherwise, under a non-filesystem backend, a handler would read
local disk while writes went to the object store. Every such route is already
`withStorageContext`-wrapped, so the wrappers resolve the request's adapter.

**App-bundled configuration is the exception.** Files shipped with the app and
identical for every tenant — project-type templates under `getwrite-config/`
(`src/lib/projectTypes.ts`), the running version's `package.json`
(`version-check`) — are **not** tenant data and are read directly from
`node:fs`. Routing them through the tenant adapter would send those reads to a
tenant's object store, which has no such files. Keep app-config on `node:fs`;
keep tenant data on the adapter.

### The object-store backend (ADR-019)

A concrete non-filesystem backend now exists. `objectStoreAdapter.ts` implements
the `StorageAdapter` contract over a flat `ObjectStore` key/value seam
(`object-store.ts`), bridging object-store semantics — directory markers,
prefix-listing `readdir`, `rename` emulation — to the model layer's filesystem
expectations. It is selected per request by `resolveBackendAdapter()`
(`app/api/_tenant/storage-backend.ts`, the sibling of `getIdentitySource()`):
unset → the default filesystem adapter (desktop/local unchanged);
`GETWRITE_STORAGE_BACKEND=object-store` → the object-store adapter rooted at
`GETWRITE_OBJECT_STORE_ROOT`. A real S3/R2 client is a later `ObjectStore`
implementation swapped in behind that selector — a backend change, not a
rewrite. A shared conformance suite
(`tests/unit/storage-adapter-conformance.ts`) runs identically against the fs
adapter and the object store over both stores, proving the seam is transparent
to the model layer.

---

## 6. When In Doubt

Any code path that — directly or transitively — reaches `resolveProjectsDir()` or
`getStorageAdapter()` without an ambient context already established by a caller
needs one established somewhere in its call chain, at the earliest point where a
concrete tenant root is known.

- Inbound HTTP route handler → wrap with `withStorageContext` (Section 2).
- CLI command, queue task, timer callback → call `runForTenant` at the point the
  root is known, capturing the adapter early for deferred work (Section 3).
- Neither applies and no root is known yet → do not resolve; propagate the concrete
  root further up the call chain until one of the above applies.
