# ADR-021: Native Android via Capacitor + In-Process Model Layer Behind a Build-Time Transport Seam

**Date:** 2026-07-24
**Status:** Accepted

> **Accepted on the strength of a two-phase spike** (see the Spike log). Both
> load-bearing risks — a `StorageAdapter` over a device filesystem, and
> collapsing the HTTP transport into in-process calls without disturbing the
> server build — were validated in the normal test gate with zero new shipping
> dependencies. What remains is _execution_ (breadth across services and write
> paths, plus on-device wiring), not open architectural questions. This follows
> ADR-019's precedent: prove the seam against a genuinely different backend
> before committing.

## Context

GetWrite is local-first: projects, resources, and metadata persist as JSON
files and directory trees, with no database. Desktop already ships this
account-free via Electron, which spawns the Next.js standalone server as a Node
child process and injects `GETWRITE_PROJECTS_DIR`. The open question is whether
GetWrite can run as a **genuinely native Android app with no hosted server** —
offline, account-free, database-free — while reusing the existing React UI and
Zod schemas.

The design is unusually well-positioned for this because the "server" is an
_implementation choice_, not something the data model needs:

- Every data-path I/O in `frontend/src/lib/models/` flows through the `io.ts`
  wrappers, which resolve a `StorageAdapter` per call from the ambient
  `StorageContext` (ADR-017). Three adapters already exist — real `fs/promises`,
  `memoryAdapter`, and `objectStoreAdapter` (ADR-019) — and a reusable
  conformance suite (`tests/unit/storage-adapter-conformance.ts`) proves the
  seam is transparent to the model layer.
- Only a handful of model files (`backlinks`, `revision`, `backlinks-watcher`,
  `schemas`) still touch `node:fs` directly; the rest are adapter-agnostic.
- The remaining Node coupling is `node:path` (~28 files) — pure and polyfillable
  (`path-browserify`) — plus the `backlinks-watcher`'s `fs.watch`, which has no
  mobile equivalent (reindex-on-save is the standing substitute, per ADR-019).

Constraints in force at the time of writing:

- **No hosted server allowed.** A PWA/TWA is therefore off the table — a Trusted
  Web Activity still points a WebView at a hosted URL. The app must carry its
  own logic and storage on-device.
- **Two distinct risks, not one.** (1) _Storage:_ can a `StorageAdapter` be
  implemented over a device filesystem API (Capacitor's `@capacitor/filesystem`
  plugin, or OPFS) and pass the conformance suite? (2) _Transport:_ today the
  Redux `*-transport-service.ts` layer calls the model layer over HTTP to
  `/api/*`; on-device there is no server, so those calls must collapse into
  in-process invocations without breaking the desktop/hosted builds.
- **Desktop/hosted must stay byte-for-byte.** The native path must be additive:
  a new adapter and a build-time transport seam, never a change to the default
  code paths.
- **The dependency bar is real.** `docs/standards/package-selection.md` requires
  justifying and version-verifying any new dependency. `@capacitor/*` is a
  substantial new toolchain; the spike must not adopt it into the shipping build
  merely to prove a contract — mirror ADR-019, which proved object-store
  semantics with a dependency-free in-memory store and deferred the real S3
  client.

## Options considered

### Option 1: Bundle a Node runtime on-device (`nodejs-mobile`), WebView → localhost

Ship the Next.js standalone server inside the APK, run it on a bundled Node
runtime, point a WebView at `127.0.0.1`. The desktop model, transplanted.

**Pros:**

- Near-zero code change — reuses the API routes and model layer as-is.
- Projects live on the device filesystem via the existing
  `GETWRITE_PROJECTS_DIR` hook.

**Cons:**

- `nodejs-mobile` is niche and ARM-build-fragile; adds ~40–60 MB and real
  cold-start/battery cost of running a Next server on a phone.
- "Native" only in packaging — it still behaves as a web app in a shell, and
  Play Store scrutiny of a bundled runtime is a real risk.
- Reuses the code but proves nothing new about the architecture; the storage
  seam stays unexercised on-device.

### Option 2: Capacitor + move the model layer in-process, drop the API routes for the mobile build

Bundle the web assets in a Capacitor WebView (**no server, no Node process**).
Add a fourth `StorageAdapter` — `capacitorFsAdapter` — over the
`@capacitor/filesystem` plugin, and collapse the `*-transport-service.ts` layer
to call the model layer directly instead of `fetch`-ing `/api`. The API routes
remain for desktop/hosted; the mobile build stubs them out.

**Pros:**

- Adds exactly the seam already built for backend swaps — a new
  `StorageAdapter`, validated by the existing conformance suite with no device
  and no new dependency (an in-memory fake of the plugin, exactly as ADR-019's
  in-memory `ObjectStore`).
- A genuinely native, offline, account-free, database-free app that reuses
  ~all of the React UI and every Zod schema.
- Capacitor's Filesystem is _hierarchical_ (real directories, `stat.type`,
  `readdir` `FileInfo.type`), so the bridge is far thinner than the object
  store's — no directory markers or prefix-list emulation.

**Cons:**

- The transport collapse (HTTP → in-process) is a real refactor of the Redux
  transport layer and is _not_ proven by the storage spike; it is a second
  spike phase.
- Capacitor is a substantial new toolchain and build target to own.
- Plugin semantics differ from `node:fs` in ways the model layer is sensitive
  to (see spike findings) — notably error shape (`err.code`) and base64
  encoding.

### Option 3: Full native rewrite (Kotlin/Compose or React Native)

Reuse only the on-disk JSON format and the Zod schemas (as a shared TS core if
React Native). Most native feel, by far the most work.

**Pros:**

- Best-possible native interaction fidelity and platform integration.

**Cons:**

- Discards the entire React UI; largest effort by a wide margin.
- Unjustified for a local-first app whose logic is already portable behind the
  storage seam.

## Decision

We adopt **Option 2**: a native Android build on **Capacitor**, with the model
layer running **in-process in the WebView** — no server, no Node child process,
no hosted dependency. Storage goes through a fourth `StorageAdapter`,
`capacitorFsAdapter`, over the device filesystem; the Redux transport layer
collapses its HTTP calls to in-process invocations of the same
transport-agnostic operation cores the API routes use, selected at build time.
The desktop/hosted builds are unchanged: the HTTP path is preserved
byte-for-byte and the native backend is dynamically imported only under the
native runtime flag.

The deciding factors were **provability in the normal gate** and **additivity**.
The two-phase spike settled both risks the choice rested on (Spike log):

1. **Storage.** `capacitorFsAdapter` passes the full `runStorageAdapterConformance`
   suite — the same contract the fs, memory, and object-store adapters satisfy —
   against a dependency-free in-memory fake of the plugin. Capacitor's
   filesystem is genuinely hierarchical, so the bridge is thin; the one sharp
   gap (the plugin's message-only errors vs the model layer's
   `err.code === "ENOENT"` branches) is absorbed in a single translation funnel.
2. **Transport.** On a representative operation (search), the HTTP → in-process
   collapse works end-to-end in the gate: the core lifts cleanly out of the App
   Router route into a shared module, `runInStorageContext` supplies the
   off-server storage context, and a dynamic `import()` keeps the server-only
   backend out of the web bundle.

Option 1 (`nodejs-mobile`) is rejected as the primary path: it reuses code but
proves nothing about the architecture, ships a heavy bundled runtime, and is
native only in packaging — though it remains the documented fallback if the
breadth work below hits a wall. Option 3 (full native rewrite) is rejected as
unjustified for a local-first app whose logic is already portable behind the
seam.

Accepting this ADR commits to the _architecture_ (Capacitor + in-process cores
behind a build-time transport seam). It does **not** claim the app is built: the
breadth and on-device work in the Spike log's "Still unproven" list is scheduled
execution, tracked separately.

## Consequences

### Positive

- A fourth `StorageAdapter` is validated by the existing conformance suite; the
  ADR-017/019 seam absorbs a device filesystem with zero new shipping
  dependency. The object-store slice's investment pays off a second time.
- A genuinely native, offline, account-free, database-free Android app that
  reuses ~all of the React UI and every Zod schema — no logic fork.
- The transport seam is additive: `httpSearchTransport` preserves the server
  path byte-for-byte, and the native backend is a dynamically-imported chunk the
  web build never includes. Desktop/hosted are untouched.
- Extracting operation cores out of the App Router routes (begun with search) is
  a net structural win independent of mobile — it separates HTTP envelope from
  business logic and makes the cores directly testable.

### Negative

- **Breadth is real work.** Only search is collapsed. The other six
  `*-transport-service.ts` files — and the harder write paths (create, save,
  rename, revisions, index updates) — each need their route's core lifted into a
  shared operation module before the native build is functional.
- A second, maintained transport path (native) exists alongside the HTTP one;
  every new server operation must be lifted the same way to work on mobile.
- `backlinks-watcher`'s `fs.watch` has no mobile equivalent — mobile relies on
  reindex-on-save (the standing ADR-019 exception).
- Capacitor is a substantial new toolchain and build target to own.

### Neutral

- The in-memory plugin fake proves plugin _semantics_, not real Android device
  I/O. On-device validation, the `@capacitor/filesystem` dependency sign-off,
  and scoped-storage rooting are deferred — exactly as ADR-019 deferred the live
  S3 client. The `nativeFilesystem()` resolver ships as a deliberate stub until
  then.
- Tenant/storage isolation is a non-issue on device (single user, single root)
  — `runInStorageContext` is used purely for adapter binding, not multi-tenancy.

## Revisit conditions

- **When the mobile build is greenlit for execution**, adopt
  `@capacitor/filesystem` behind the `package-selection.md` bar and validate
  `capacitorFsAdapter` against the real plugin on-device (rename fail-if-exists,
  base64 large-file performance, error messages per Android version).
- **If lifting the write paths in-process proves materially harder** than the
  read path (lock semantics, revision atomicity, index consistency under the
  Capacitor adapter), reconsider Option 1 (on-device Node) for the mobile build
  before extracting all seven services.
- **If Android scoped-storage / SAF constraints** make a stable projects root
  impractical under `Directory.Data`, revisit the storage-rooting strategy.
- **If the native transport path drifts from the HTTP path** (a server op added
  without a lifted core), treat that as the signal to unify on a single
  operation registry both transports consume.

## Spike log

### Phase 1 — Storage (2026-07-24): ✅ passes conformance

`capacitorFsAdapter` (`frontend/src/lib/models/capacitorFsAdapter.ts`) passes the
full `runStorageAdapterConformance` suite — all 14 cases — driven through the
`io.ts` wrappers exactly as model code uses them, against a dependency-free
in-memory fake of the plugin
(`frontend/src/lib/models/capacitor-filesystem.ts`). Spike test:
`frontend/tests/unit/capacitor-fs-adapter.spike.test.ts`. No `@capacitor/*`
dependency was added; typecheck is clean and the existing 42-case conformance
suite is unaffected.

**Findings — the gaps the bridge had to absorb:**

1. **Error shape is the load-bearing gap.** The plugin throws message-only
   `Error`s with **no `code`**, but the model layer branches on
   `err.code === "ENOENT"` (`io.exists`, `deleteQuery`, revision guards). The
   bridge translates plugin "not found" → coded `ENOENT` in one funnel
   (`asEnoent` / `isNotFound`). This is the single sharpest divergence; on-device
   it hardens to matching the real plugin's exact messages/codes per platform.
2. **Base64 is the only binary channel.** The plugin marshals bytes as strings
   over the WebView bridge, so the adapter routes _all_ writes through base64
   and lets `readFile`/`readFileBuffer` choose their own decoding. Binary
   round-trips (`0x00 0x89 0xff …`) pass — no corruption at the boundary.
3. **File-vs-dir op split, but a genuinely hierarchical backend.** Unlike the
   object store, Capacitor has real directories with typed `stat`/`readdir`, so
   the bridge is much thinner — no directory markers, no prefix-list emulation,
   no rename synthesis. `rm` probes `stat().type` to pick `deleteFile` vs
   `rmdir`; `readdir`/`stat` map the `type` discriminator to `Dirent`/`Stats`.
4. **Directory-rename fail-if-exists is deferred, not proven.** The conformance
   suite (by design) does not assert it, and `revision.ts` self-guards with a
   `stat` pre-check — so the spike does not settle Android's native rename
   overwrite behavior. Flagged for on-device validation.

**Verdict:** the storage half of Option 2 is validated in the normal gate — the
seam ADR-017/019 built absorbs a device filesystem cleanly.

### Phase 2 — Transport collapse (2026-07-24): ✅ proven on the search path

The HTTP → in-process collapse is demonstrated end-to-end on one representative
operation (search), passing in the normal Vitest gate (4 cases,
`frontend/tests/unit/transport-collapse.spike.test.ts`). New/changed code:

- **Core extraction.** `executeSearch` + `findProjectRoot` moved from the App
  Router route into a transport-agnostic module
  (`frontend/src/lib/search/execute-search.ts`); the route imports and
  re-exports them. Behavior-preserving — the existing 18-case
  `search-route.test.ts` still passes untouched. _This is the crux: the core had
  to stop being welded to the route before either transport could share it._
- **The seam.** A `SearchTransport` contract
  (`frontend/src/store/transport/search-transport.ts`) with two
  implementations, selected at build time by
  `NEXT_PUBLIC_GETWRITE_RUNTIME` (`runtime.ts`):
  - `httpSearchTransport` carries the original `fetch('/api/...')` call
    **byte-for-byte** — the server/desktop path is unchanged.
  - `createNativeSearchTransport` (`native-search-backend.ts`) runs
    `executeSearch` inside `runInStorageContext({ adapter: capacitorFsAdapter })`
    — no server, no HTTP, the exact same business logic in the WebView process.
- **Call-site change is minimal.** `executeSearchRequest` went from ~20 lines of
  `fetch` to `resolveSearchTransport().search(...)`; every other export of the
  Redux service is untouched, so components/slices are unaffected.

**Findings:**

1. **The real refactor is de-welding the core from the route, not the
   transport.** The App Router handler mixed HTTP envelope (params, status
   codes, `NextResponse`) with orchestration (find root, resolve limit, call
   core). Extracting the transport-agnostic core is the load-bearing move; once
   done, both transports are thin. This generalizes to the other six
   `*-transport-service.ts` files — each needs its route's core lifted into a
   shared operation module.
2. **`runInStorageContext` is exactly the off-server context primitive
   needed.** What `withStorageContext` does per HTTP request, the native backend
   does per in-process call, binding the Capacitor adapter — the ADR-017 seam
   carries over unchanged.
3. **A dynamic `import()` keeps server code out of the web bundle.** The native
   backend (which pulls `node:*` and the storage layer) is imported lazily only
   when `runtime === "native"`, so the HTTP build's module graph never includes
   it — no separate source tree required.
4. **The error-translation bridge from phase 1 is load-bearing here too.** The
   in-process path exercised `readSidecar` and `listRevisions`, both of which
   branch on `err.code === "ENOENT"`; the hit only came back because
   `capacitorFsAdapter` translates the plugin's message-only errors. Phase 1 and
   phase 2 are genuinely coupled.

### Phase 3 — Write path over the Capacitor adapter (2026-07-25): ✅ the riskier half holds

Phase 2 collapsed a read path; the write mechanics were the flagged unknown.
Phase 3 drives the real revision write path — `createRevision` — in-process over
`capacitorFsAdapter`, passing in the normal gate (3 cases,
`frontend/tests/unit/write-path.spike.test.ts`). One `createRevision` call
exercises every risk at once: per-resource lock → `nextVersionNumber` → temp-dir
stage → **directory `rename` onto `v-<N>`** → `setCanonicalRevision` → prune.

**Findings:**

1. **Directory rename commits cleanly and leaves no temp dir.** `writeRevision`
   stages into `.tmp-<uuid>` and renames it onto `v-1`; over the Capacitor
   adapter the content lands at the final path and the staging dir is gone. The
   adapter's directory-rename (already conformance-proven as "move to a fresh
   destination") is exactly what this path needs.
2. **The fail-if-exists concern from Phase 1 is a non-issue for revisions.**
   `writeRevision` self-guards with a `stat` pre-check before renaming, so it
   never relies on the adapter's rename rejecting an existing destination —
   whatever Android's native rename does on collision, this path is already
   defended. (The pre-check is also what makes the concurrency test below fail
   loudly if the lock were absent.)
3. **The single-canonical invariant survives the multi-file rewrite.** A second
   canonical save flips the prior revision's `isCanonical` off through the
   adapter; `listRevisions` shows exactly one canonical (the latest). The
   metadata rewrite that enforces the invariant works unchanged.
4. **In-process locks serialize concurrent writes correctly.** Two concurrent
   `createRevision` calls yield distinct sequential versions (`v-1`, `v-2`), not
   a `v-1` collision — the per-resource in-memory mutex (`locks.ts`) behaves
   identically in the WebView's single JS context. This is actually a
   _simplification_ versus hosted: no cross-instance coordination exists or is
   needed on a single-user device (cf. ADR-019's cross-instance-locking caveat).
5. **Fire-and-forget background work must run inside an app-lifetime storage
   context.** `createRevision` kicks off `enqueueIndex` un-awaited. It is gated
   off under `VITEST`, so the spike is deterministic — but the code shows that if
   the storage context were established _per operation_, escaped background work
   (indexer, `backlinks-watcher`) would resolve the default adapter after the
   scope unwinds. **Design consequence for the native build: bind the
   `StorageContext` once at app startup (app-lifetime), not per call** — which is
   natural on device (one user, one root) and unlike the hosted per-request
   scope.

**Verdict:** the write half runs over the Capacitor adapter with the revision,
canonical, and locking guarantees intact. The mechanics feared to be hard are in
fact well-defended by existing self-guards, and the single-instance model makes
locking simpler, not harder.

**Still unproven (execution, not architecture):**

- **Breadth of the transport collapse.** Only search is wired end-to-end through
  the seam. Phase 3 proved the write _mechanics_ over the adapter, but each
  write route's core still needs lifting out of its handler (as search was) and a
  native transport backend, following the Phase-2 pattern.
- **On-device reality.** The in-memory fake proves plugin _semantics_, not real
  Android I/O, the `@capacitor/filesystem` dependency sign-off, scoped-storage
  rooting, or the `nativeFilesystem()` wiring line the spike leaves as a
  deliberate stub. Directory-rename-on-collision and large-file base64
  performance are the specific things to check on a real device.
- **The Capacitor app shell itself** (build target, WebView bootstrap, asset
  bundling, app-lifetime context binding) is out of scope of these spikes.

**Overall verdict:** all three load-bearing risks Option 2 rested on —
(1) a `StorageAdapter` over a device filesystem, (2) collapsing HTTP into
in-process calls without disturbing the server build, and (3) the write path's
revision/canonical/lock guarantees surviving that adapter — are answered **yes**
in the normal gate, with zero new shipping dependencies. The architecture is
de-risked; what remains is execution (breadth + on-device), tracked separately.
