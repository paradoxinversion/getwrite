# ADR-017: Request-Scoped, Directory-Per-Tenant Storage for Hosted GetWrite

**Date:** 2026-07-08
**Status:** Accepted

## Context

GetWrite was built as a local-first, single-user desktop and local-dev application with no database. All persistence went through a filesystem-backed model layer, and two process-global singletons defined every storage operation:

- `resolveProjectsDir()` (`frontend/src/lib/models/projects-dir.ts`) read a single environment variable, `GETWRITE_PROJECTS_DIR`, for the entire server process. Every API route called it directly and derived a project path with `path.join(projectsDir, id)`.
- `getStorageAdapter()` (`frontend/src/lib/models/io.ts`) exposed one mutable module-level `adapter` variable — a single storage backend for the whole process.

Two further facts shaped the problem. First, write serialization relied on an **in-process lock** — a `Map` keyed by string path (`frontend/src/lib/models/locks.ts`) — which only coordinates writes _within a single Node process_. Second, there was **no authentication layer**: no `middleware.ts`, no sessions, no cookies. The application assumed one trusted local user owning one disk.

The goal was to offer a hosted, multi-user web service **without abandoning the local-first model** — meaning a user's local copy should remain authoritative and usable offline, with the hosted service acting as a sync peer, backup, and future collaboration surface rather than the sole source of truth. The immediate architectural blocker was that Next.js route handlers run **concurrently in a single process**: a mutable global storage adapter or a single global projects directory would allow one in-flight request to read or write another tenant's data. Multi-tenancy could not be added safely until per-request storage isolation existed. A constraint throughout was to preserve the existing on-disk JSON format and reuse the entire model layer (resources, revisions, indexing, backlinks) rather than rewrite it.

Here, "tenant" means one hosted user account and its isolated data root; "local-first" means the local/desktop copy is the source of truth and works fully offline; and an "adapter seam" refers to the existing `StorageAdapter` interface that lets storage operations target different backends behind one contract.

## Options considered

### Option 1: Directory-per-tenant on a shared volume, with request-scoped storage

Give each authenticated user a data root at `<data-root>/<userId>/` and run the existing filesystem model unchanged beneath it. Resolve a per-request `{ tenantRoot, adapter }` in middleware and propagate it via `AsyncLocalStorage`, so `resolveProjectsDir()` and `getStorageAdapter()` read from the async request context instead of module globals. Pin each tenant to a single instance so the existing in-process locks continue to serialize that tenant's writes correctly.

**Pros:**

- Reuses 100% of the model layer and the on-disk JSON format; no data-format migration.
- Removes the tenant-bleed race by scoping storage per request without rewriting every model function signature.
- Existing in-process locks keep working unmodified as long as a tenant is pinned to one instance.
- Smallest conceptual leap from the current architecture; fastest path to a working hosted app.

**Cons:**

- Tenant-pinned instances constrain horizontal scaling and complicate failover for a single tenant.
- A shared POSIX volume becomes a scaling and durability bottleneck as tenant count grows.
- Requires building an auth layer and a `request → userId → dataRoot` mapping from scratch.

### Option 2: Object-storage adapter (S3/R2) with a per-tenant key prefix

Implement the `StorageAdapter` interface over an object store, isolating tenants by key prefix. The adapter abstraction in `io.ts` was designed to allow exactly this kind of backend swap.

**Pros:**

- Effectively unlimited durable capacity and built-in redundancy without managing volumes.
- Naturally multi-instance; no tenant pinning required for storage reads.
- Isolates tenants by key prefix using an existing seam.

**Cons:**

- Object stores have no atomic `rename`, so `atomicWriteFile`'s crash-safety guarantee (`io.ts`) is lost and must be re-engineered.
- `fsync` becomes meaningless and `readdir` becomes an eventually-consistent, slow list-prefix operation for large resource trees.
- In-process locks protect nothing across instances, forcing an external coordination mechanism immediately.
- Changes correctness semantics of the model layer, not just its backend — higher risk for a first step.

### Option 3: Container/pod-per-tenant with a mounted per-user volume

Run a dedicated ephemeral instance per active user, each with its own mounted volume. The current code — locks included — runs almost verbatim inside.

**Pros:**

- Strongest isolation between tenants (separate process and filesystem).
- In-process locks remain fully correct with no changes.
- Maps cleanly onto a "your own always-on instance" local-first sync target.

**Cons:**

- Introduces container orchestration, cold starts, and idle-eviction logic — substantial operational complexity.
- Higher per-tenant cost, especially for infrequently active users.
- Overbuilt for the current stage, where per-user write concurrency is naturally low.

## Decision

We adopted **Option 1: directory-per-tenant on a shared volume with request-scoped storage via `AsyncLocalStorage`, and tenant-pinned instances so the existing in-process locks remain correct** — while deliberately keeping the `StorageAdapter` seam clean so Option 2 or Option 3 can be adopted later as a backend swap rather than a rewrite.

This option was chosen because it removes the one true blocker (concurrent requests sharing global storage state) with a bounded, mechanical refactor, and because it preserves the entire existing model layer and on-disk format. Options 2 and 3 solve scaling and isolation problems the product does not yet have, and each carries a cost — changed correctness semantics for Option 2, operational complexity for Option 3 — that is premature to pay now. The factors weighted most heavily were correctness of tenant isolation, minimizing risk to the proven model layer, and shortest credible path to a hosted multi-user app.

## Consequences

### Positive

- Concurrent Next.js requests can no longer read or write across tenants, because storage context is resolved per request rather than from a mutable process global.
- The existing model layer, on-disk JSON format, and `getwrite-cli reindex` tooling are reused without migration.
- The in-process locks in `locks.ts` continue to serialize a tenant's writes correctly, because each tenant is pinned to a single instance.
- The `StorageAdapter` seam remains the single swap point, so moving to object storage or per-tenant containers later is a backend change, not an application rewrite.

### Negative

- Tenant-to-instance pinning limits horizontal scaling and makes single-tenant failover harder; a tenant's writes are only safe while its instance is the sole writer.
- A shared POSIX volume is a growing durability and throughput bottleneck, and demands a separate backup/snapshot policy — the `revisions/` tree is version history, not a backup.
- An authentication layer and `request → userId → dataRoot` mapping must be built from nothing before any hosted user exists.
- Introducing `AsyncLocalStorage` adds an implicit request-context dependency; any code path that runs outside the request context (background jobs, CLI reuse) must establish the context explicitly or it will fail to resolve a tenant root.

### Neutral

- Storage backend selection is now a deployment concern resolved in middleware rather than a compile-time constant.
- The local-first sync layer (e.g. cloud-as-backup, then Yjs-based content sync with server-side reindex) is deferred and treated as a separate decision, not coupled to this storage choice.
- Derived on-disk state (`meta/index/`, backlinks, previews, field values) is treated as rebuildable rather than authoritative, narrowing what any future sync layer must transfer.

## Revisit conditions

This decision should be revisited if any of the following become true:

- Tenant count or per-tenant data volume makes a single shared POSIX volume a measurable throughput or durability bottleneck — at which point the object-storage adapter (Option 2) becomes attractive.
- A single tenant needs concurrent writers across more than one instance, breaking the tenant-pinning assumption that keeps the in-process locks correct — forcing a distributed lock or Option 3.
- Isolation or compliance requirements demand hard per-tenant process/filesystem separation, favoring container-per-tenant (Option 3).
- Real-time multi-user collaboration on a single project is prioritized, changing the write-concurrency model enough that tenant-pinned in-process locks are no longer sufficient.
