# ADR-019: Object-Store Backend Adapter — Proving the Seam Against a Non-Filesystem Backend

**Date:** 2026-07-22
**Status:** Accepted

## Context

Four slices built GetWrite's hosted-storage foundation: request-scoped `StorageContext` (ADR-017), tenant resolution (ADR-018), route enforcement, and adapter isolation. After the last of these, every file under `frontend/src/lib/models/` performs its data-path I/O through the `io.ts` wrappers, which resolve `StorageContext.adapter` per call. The model layer is now _adapter-agnostic_.

But nothing outside tests ever injected a non-default adapter. `withStorageContext` resolved `tenantRoot` per request yet always bound the process-default `fs/promises` adapter, so the adapter half of the seam was unexercised. ADR-017 named an object-storage adapter (S3/R2, isolating tenants by key prefix) as a sanctioned future "backend swap," and `docs/standards/storage-context.md` §5 recorded that "the remaining backend work (a concrete non-filesystem adapter) is deferred; the model layer is ready for it." This ADR is that work.

Constraints in force at the time of the decision:

- **Object stores are semantically different from a POSIX filesystem.** They are a flat key/value namespace: no directories, no atomic `rename`, no `fsync`, and `readdir` becomes a list-prefix. ADR-017 flagged that adopting one "changes correctness semantics of the model layer, not just its backend." The model layer, however, consumes only a _thin_ slice of those semantics — reconnaissance confirmed it reads only `Stats.isDirectory()` + existence and `Dirent.{name,isDirectory,isFile}`, and depends on the `err.code === "ENOENT"` convention for missing paths.
- **One POSIX-hard dependency exists.** `revision.ts` renames a temp directory to `v-<N>` and relies on the rename failing if the destination already exists. Object stores have no atomic directory rename and no fail-if-exists primitive.
- **The dependency bar is real.** `docs/standards/package-selection.md` requires justifying and version-verifying any new dependency, and GetWrite has no object-store client today. A network client (AWS SDK) is heavy, cannot run in CI without a mock/MinIO, and does not by itself solve cross-instance locking.
- **Local-first must stay byte-for-byte.** Desktop/Electron and today's hosted single-volume path must be unaffected unless a deployment explicitly opts into the new backend.

## Options considered

### Option 1: A real S3/R2 network client adapter now

Pull in `@aws-sdk/client-s3` (or a lighter S3v4 client) and implement `StorageAdapter` directly against it.

**Pros:**

- Delivers a production cloud backend in one landing; strongest "it runs on S3" signal.
- Forces the eventual-consistency and credential questions to be settled now.

**Cons:**

- A heavy new dependency requiring version sign-off, and unusable in CI without a mock or MinIO — the contract can't be proven in the normal test gate.
- Still drags in the full correctness-semantics rework (rename emulation, list-prefix `readdir`, dir markers) _and_ leaves cross-instance locking unsolved — so it is bigger and riskier without removing the hard parts.
- Couples the first proof of the seam to one vendor's client before the object-store→filesystem bridge is validated.

### Option 2: `ObjectStore` interface + two dependency-free implementations

Define a minimal `ObjectStore` key/value contract (`get`/`put`/`delete`/`list`/`has` over `Buffer`s) and implement `objectStoreAdapter(store)` — the bridge that maps paths to keys, synthesizes the thin `Stats`/`Dirent` shapes, uses trailing-slash directory markers so empty directories are observable, models `readdir` as a prefix list, and emulates `rename`. Ship two `ObjectStore` implementations: an in-memory `Map` store (tests) and a filesystem-backed store that persists each object as a flat percent-encoded file (runnable in dev/CI). Select the backend per request behind an env-gated `resolveBackendAdapter()`. A real S3/R2 client becomes a later `ObjectStore` implementation.

**Pros:**

- Confronts the genuinely hard problems (rename emulation, dir markers, prefix listing, ENOENT parity) head-on, and proves them against a persistent store in the normal CI gate — no cloud, no new dependency.
- Yields a reusable adapter-conformance suite (which the repo lacked) run against the fs adapter and both object stores, so "the seam is transparent to the model layer" is a passing test, not a claim.
- Reduces a future S3/R2 client to a ~50-line `ObjectStore` implementation behind the same selector — a backend change, not a rewrite, exactly as ADR-017 promised.
- Default path stays byte-for-byte the filesystem adapter; the object store is strictly opt-in.

**Cons:**

- No live cloud backend at the end of this slice; "runs on S3" is deferred to a later client implementation.
- The filesystem-backed `ObjectStore` stores bytes on disk, so it proves object-store _semantics_ rather than exercising real network/eventual-consistency behavior.

### Option 3: Ship the interface now and a thin S3 client wired behind the selector

Do Option 2 and also include a minimal real S3/R2 `ObjectStore` behind the selector.

**Pros:**

- A live bucket works if configured, alongside the tested fs-backed proof.

**Cons:**

- Reintroduces the dependency and version sign-off, and the S3 path remains unverifiable in CI — a partially-tested surface shipped as if complete.
- Larger scope for no additional proof of the seam over Option 2.

## Decision

We adopt **Option 2**: an `ObjectStore` key/value interface with an in-memory and a filesystem-backed implementation, an `objectStoreAdapter` bridging object-store semantics to the model layer's filesystem contract, and an env-gated per-request selector (`GETWRITE_STORAGE_BACKEND=object-store`, rooted at `GETWRITE_OBJECT_STORE_ROOT`).

The deciding factors were **provability in the normal gate** and **isolating the genuinely hard work from vendor and infrastructure concerns**. The value of this slice is the object-store→filesystem-semantics bridge and the proof that injecting it is transparent to the model layer; both are delivered without a network client and validated by a conformance suite that runs against three backends. This mirrors ADR-017/018's sequencing — prove the seam, then land the heavy backend (here, a real S3/R2 client) as an additive plug-in.

On the one POSIX-hard dependency: the object-store adapter **preserves the fail-if-exists guarantee** `revision.ts` depends on (a directory rename onto an existing destination throws `EEXIST`), while **accepting a documented weaker atomicity guarantee** — the multi-key directory move is not atomic. This matches the con ADR-017 already recorded for the object-storage option and is acceptable because revision writes are serialized by the in-process lock and additionally guarded by `revision.ts`'s own `stat` pre-check.

## Consequences

### Positive

- The adapter seam is proven end-to-end against a backend with genuinely different semantics; a reusable `StorageAdapter` conformance suite runs identically against the fs adapter, the object store over an in-memory store, and the object store over a filesystem store.
- Building the backend surfaced (and a code review confirmed) that the `app/api/` route layer still performed tenant-data I/O via direct `node:fs`, bypassing the adapter. Every tenant-data route was migrated onto the `io.ts` wrappers, and app-bundled config (project-type templates, `version-check`) was kept on `node:fs` by design — completing the adapter routing the model-layer slice began. A live object-store smoke (project create → list → search) now runs with tenant data written only to the object store, nothing to local disk.
- A future S3/R2 backend is a small `ObjectStore` implementation swapped in at `resolveBackendAdapter()` — no model-layer or route changes.
- The object-store backend is genuinely runnable in dev/CI (and a hosted single-volume deployment) with zero new dependencies.
- Both halves of the storage context — `tenantRoot` and `adapter` — are now resolved per request; tenant provisioning routes through the selected backend.

### Negative

- Directory rename on the object store is non-atomic: a crash mid-move can leave a partially-copied destination. Preserved fail-if-exists plus per-project write serialization make this acceptable, but it is a real weakening versus POSIX rename.
- No live cloud backend ships in this slice; the filesystem-backed store proves semantics, not network/eventual-consistency behavior.
- The object-store backend does not receive `fs.watch` backlink-reindex events (see the standing exception); hosted deployments must rely on on-demand `reindex`.

### Neutral

- `object-store.ts` (the fs-backed store) legitimately uses `node:fs` directly. It _is_ a storage backend, the same category as `io.ts` and `memoryAdapter.ts`, and so sits outside the "model code routes through the adapter" rule.
- Cross-instance locking is unchanged and out of scope: the in-process locks remain correct under ADR-017's one-instance-per-tenant pin. A distributed-coordination mechanism is a separate, later decision.
- Tenant isolation still rests on `tenantRoot` — now realized as an object-key prefix rather than a directory path — consistent with ADR-018's revisit note.

## Revisit conditions

- **When a real S3/R2 (or other network) backend is needed.** Implement `ObjectStore` against the client behind the `package-selection.md` bar and wire it into `resolveBackendAdapter()`; revisit eventual-consistency handling (read-after-write retries) and credential configuration then.
- **If concurrent writers span multiple instances.** The in-process locks no longer coordinate; an external locking mechanism (per ADR-017's revisit conditions) becomes required before an object-store backend can serve a tenant from more than one instance.
- **If directory-rename atomicity proves insufficient** for revision integrity under real object-store latency/failure, reconsider the revision write protocol (e.g. a manifest/commit-marker scheme) rather than relying on a multi-key move.
