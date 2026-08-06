# ADR-022: End-to-End Encryption via a Storage-Adapter Decorator

**Date:** 2026-08-04
**Status:** Accepted

## Context

GetWrite stores a writer's manuscripts as plaintext files on disk. A stolen laptop, a copied backup, or a synced cloud folder exposes unpublished work in full. `specs/features/end-to-end-encryption.md` asked for opt-in, per-project encryption on desktop and native Android, with the passphrase as the only thing that can open a project.

Four constraints shaped the architecture:

- **The adapter seam already existed and was already proven.** ADR-017 introduced a request-scoped `StorageContext`; ADR-019 proved the `StorageAdapter` seam against a genuinely different backend (an object store) and left behind a conformance suite run across three backends. Every data-path read and write in `frontend/src/lib/models/` goes through the `io.ts` wrappers.
- **Three build targets, one model layer.** Desktop (Electron), hosted (Next.js), and native Android (ADR-021, where the same modules run in-process inside a WebView). Anything requiring a second implementation per target would triple the surface.
- **Zero-knowledge was chosen for key custody.** The passphrase never leaves the client, and there is no recovery path — decided during spec review, with the hosted deployment deliberately excluded because making encryption meaningful there requires the model layer to run in the browser over a remote blob backend.
- **Local-first must stay byte-for-byte.** A project that never opts in must be unchanged on disk and unchanged in behaviour.

## Options considered

### Option 1: Encrypt at each model-layer call site

Have `resource-persistence.ts`, `sidecar.ts`, `revision.ts` and the rest seal and open the values they know are sensitive.

**Pros:**

- Fine-grained: each module decides exactly what needs protecting.
- No new indirection; the encryption is visible where the data is written.

**Cons:**

- Defeats "everything under a project dir" (FR14) by construction — every new write path is a chance to leak plaintext, and there is no single place to audit.
- Cannot be proven. There is no equivalent of "run the conformance suite against it"; correctness would rest on nobody ever forgetting.
- The `getwrite` model layer has dozens of write sites, and the ones most likely to be missed are precisely the ones added later.

### Option 2: Encrypt inside the `ObjectStore` seam (ADR-019)

Wrap the flat key/value store rather than the `StorageAdapter`.

**Pros:**

- Smaller contract to implement (5 methods rather than 14).
- Naturally per-tenant, since keys are already prefixed by tenant.

**Cons:**

- Excludes desktop entirely. Desktop runs the plain filesystem adapter, not the object store, so encryption would either be unavailable there or force desktop onto an object-store backend it has no reason to use.
- The object store is an opt-in deployment choice, and encryption is not.

### Option 3: A `StorageAdapter` decorator

Wrap the same interface the model layer already consumes: `encryptingAdapter(inner, key)` seals file bodies on write and opens them on read, delegating every path and directory semantic to the adapter beneath.

**Pros:**

- Composes with every backend GetWrite has — filesystem, object store, Capacitor bridge — because it decorates the interface all three implement.
- **Provable.** The ADR-019 conformance suite runs against it unchanged; if encryption disturbed ENOENT propagation, `Dirent` shapes, `atomicWriteFile`'s temp-then-rename, or directory rename, an existing assertion fails.
- One implementation for all three targets, since `crypto.subtle` and `@noble/hashes` both run in Node and in the Android WebView.
- Catches every write path by construction rather than by enumeration.

**Cons:**

- Operates on whole file bodies, so `appendFile` becomes read-modify-write and `stat().size` reports ciphertext length.
- Says nothing about *which* key a given path needs — that question has to be answered somewhere else, and answering it wrongly is what caused this ADR's main revision (see Consequences).

## Decision

We adopt **Option 3**, with four supporting pieces:

1. **`encryptingAdapter`** — a `StorageAdapter` decorator sealing file bodies with AES-256-GCM. Reads are strict; a non-envelope where ciphertext is expected is rejected as a downgrade. A narrow `tolerant` mode, gated on an active conversion marker, accepts an unsealed file so a half-converted project stays openable.

2. **A keyring with per-project data keys.** One workspace key is derived from the passphrase with Argon2id; each project gets an independent random data key, wrapped by it. This buys three properties at once: one unlock opens everything, changing the passphrase is a rewrap rather than a data migration, and projects stay cryptographically independent.

3. **Self-identifying envelopes.** `magic(4) | version(1) | nonce(12) | ciphertext+tag`, where the magic ends in NUL so no UTF-8 text file can collide. This is a correctness requirement, not a convenience: it makes the data its own progress record, which is what lets an interrupted conversion resume by simply running again — no journal, no separate recovery path.

4. **A per-request workspace routing adapter.** Bound once per request, it derives the project id from each path (`<tenantRoot>/<projectId>/…`, the ADR-017/018 convention) and applies that project's key, passing through for projects without one and for workspace-level files.

Point 4 replaced an earlier design in which each caller resolved its own project adapter. See Consequences.

## Consequences

### Positive

- Encryption composes with the object store and the Capacitor bridge without either knowing it exists, and the ADR-019 conformance suite proves it — 84 assertions across six fixtures, verified to fail 27 ways when the decorator is deliberately broken.
- One implementation serves desktop and Android. `crypto.subtle` is present in Node and in the WebView (Capacitor serves `https://localhost`, a secure context), and `@noble/hashes` is pure JS with no runtime dependencies.
- Crash-safe conversion came almost free. Because envelopes are self-identifying, the sweep is idempotent, resume is re-running it, and both directions share one loop — validated by injecting a crash at every one of the 42 I/O operations a sweep performs, in both directions.
- Unencrypted projects are untouched on disk and behave exactly as before.

### Negative

- `appendFile` is read-modify-write, since an AEAD envelope cannot be extended in place. Acceptable because the model layer has exactly one appending caller (a template change log that gains one short line per edit), but it would not scale to a large log.
- `stat().size` reports ciphertext length. Inert today because ADR-019's survey established the model layer reads only `isDirectory`/`isFile`/`name` and existence, but it is a latent trap for any future caller that reaches for `size`.
- Tolerant reads open a bounded downgrade window during a conversion, in which a plaintext file is accepted where ciphertext is expected. The window is the conversion's duration, and strict mode applies at every other time. Because whether a conversion is in flight is a fact on disk that can change between requests — and adapter selection is synchronous — the routing adapter resolves tolerance *per read*, and only after a read has already failed as "not an envelope". An envelope that fails authentication is never tolerated, since that is a distinct error (FR15).
- Conversion requires an exclusive project write barrier, because `meta-locks.ts` does not cover the content save path. Writes to a converting project fail fast rather than blocking. The barrier identifies the project from the path being written: it originally read a `projectRoot` off the storage context, which `withStorageContext` does not set, so it silently permitted every request write for the life of the branch.

### The revision that matters

The spec's FR12 asked that an unencrypted project's adapter chain contain **no** crypto code, asserted by reference identity. That was implemented literally: `resolveProjectAdapter` returned the base adapter itself, and a test compared by reference.

Satisfying it required each caller to opt in by resolving its own project adapter — and almost no caller did. The seam shipped with a single production call site while every route (open, save, search, revisions, compile, export) continued to run on the plain adapter and read ciphertext as content. **Encrypting a project made it unopenable, and the unit tests all passed**, because each unit was correct in isolation.

The routing adapter fixes this by removing the choice from callers. It is present in the chain for every project but performs no cryptographic operation for one without a key, and a test asserts byte-identical passthrough. **FR12 is therefore amended from "no crypto code in the chain" to "no cryptographic operation runs".** The intent — an unencrypted project is unaffected — is preserved; the identity check that caused the defect is not.

Two related gaps had the same shape: components built and tested but never mounted, and a capability (plaintext export) with no route in. All three were found by running the application, not by any automated check. A reachability sweep afterwards found unreferenced exports but would not have caught the routing bug, because that code had one caller and looked used.

The lesson is recorded here deliberately: **a seam is not done when it is correct, only when it is adopted.** Task breakdowns for work of this shape need an explicit integration task, and a manual walkthrough before the feature is called complete.

### Why that lesson was not enough

It recurred. A code review of the finished branch found thirteen issues, and **every one of them was an integration defect — not one was in the cryptography.** The worst made encrypting a *second* project fail outright, and it was the same bug wearing different clothes: the routing adapter fixed *reads* going through the wrong adapter, but every crypto module still defaulted its own adapter to `getStorageAdapter()`, which under a request is that same routing adapter. Registering the second project's key mid-call flipped it into decrypting the plaintext the conversion sweep was partway through sealing.

The advice above did not prevent this, and it could not have. "Add an integration task" and "walk it through manually" are dispositions, and a disposition cannot be enforced by a test suite. Worse, the suite actively signalled the opposite: 2,966 tests passed while a second project could not be encrypted at all.

The reason is specific enough to name. **Three of the tests that should have caught these findings passed because they supplied, as a prop or an argument, the exact thing production could not produce:**

- `enable-encryption.test.ts` had a test called "a second project". It passed a plain adapter explicitly — the one thing a request never has.
- The encryption setup modal's progress line was asserted by handing the component a `progress` object. No slice held one and no caller passed one; the route answers with a single JSON response after the sweep, so no count can reach the browser.
- The FR27 plaintext-output warning was asserted by rendering the modal with `isSourceEncrypted`. No component in the application set that prop.

Each test proved its unit and none of them proved the wiring, because the wiring was the thing being stubbed. This is not a gap that more unit tests close — every additional unit test of that shape widens it.

### The mitigation, stated as a rule

**Where a seam is bound once and consumed everywhere, at least one test must bind it the way production binds it and pass nothing.**

Concretely, for this feature that is `frontend/tests/integration/encryption-request-path.test.ts`: it constructs the adapter exactly as `app/api/_tenant/with-storage-context.ts` does, including reading the session keyring once at request start, and then passes no `adapter` argument to anything. A module that reaches for the ambient adapter fails it. That test is the reason the second-project bug cannot come back, and it is a materially different artefact from a note asking future readers to be careful.

Two corollaries worth carrying to the next seam of this kind:

- **A test that hands a component the input under test proves the component, never the wiring.** If the assertion depends on a value the test itself supplied, ask what in production supplies it — and if the answer is "nothing", that is the bug.
- **Mutation-test the fix, not just the feature.** Two of the replacement tests written for these findings passed against a deliberately broken fix on the first attempt — one asserted a reset that it had never triggered. Only removing the fix and re-running exposed them.

### Deferred

- **Hosted encryption.** Requires the model layer to run in the browser over a remote `ObjectStore` implementation. Until then encryption fails closed on hosted, checked server-side rather than by hiding the UI.
- **In-place decryption.** The machinery is direction-agnostic and tested both ways; only the UI entry point is withheld. The escape hatch today is a full plaintext export.
- **Native transport wiring.** Android runs these modules in-process and needs the `createTransport` HTTP/native pair, following ADR-021.
- **Recovery codes, escrow, hardware-backed unlock, and a third-party cryptographic review.**
