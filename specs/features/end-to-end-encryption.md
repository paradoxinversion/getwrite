# Feature Spec: End-to-End Encryption for Project Files

> **Scope note.** This spec covers desktop (Electron) and native Android only.
> Zero-knowledge encryption on the hosted deployment requires the model layer to
> run in the browser over a remote blob backend; that is tracked as a separate
> follow-on feature (see _Out of scope_) and is deliberately not specced here.
> Even so, this remains large enough to break into two task lists: the crypto
> core and key lifecycle, then adoption by the two targets.

## Overview

GetWrite stores a writer's manuscripts as plaintext files on disk. A stolen
laptop, a copied backup, or a synced cloud folder exposes unpublished work in
full. This feature lets a writer put a workspace passphrase in front of chosen
projects, so that every byte GetWrite persists for those projects is ciphertext
and the passphrase is the only thing that can open them.

## Goals

- A passphrase-protected project is unreadable from disk without the user's
  passphrase.
- Key material derived from the passphrase exists only in memory and is never
  written to disk unwrapped, logged, or transmitted.
- Editing, search, queries, revisions, compile, and export work on an unlocked
  encrypted project with no loss of function.
- Encryption is opt-in per project and off by default; a user who never enables it
  sees no change to their projects on disk or in the UI.
- Encryption is transparent to the model layer — no module above the storage
  adapter knows whether it is reading ciphertext.

## Non-goals

- Recovery of a project whose passphrase is lost — no reset, no escrow, no
  backdoor.
- Encryption on the hosted deployment (deferred; see below).
- Encrypting file and directory *names* (already opaque UUIDs) or file sizes.
- Sharing an encrypted project with a second user, or device-to-device sync.
- Protecting plaintext held in memory, in OS swap, or in the TipTap undo buffer
  while a project is unlocked.
- *In-place* decryption of an encrypted project back to a plaintext project
  directory. This is **deferred, not rejected** — the user must never be locked
  into encryption, so v1 ships a full plaintext export as the escape hatch (FR24)
  and the migration design must keep in-place decryption available later (FR25).
- Default-on, workspace-wide, or policy-enforced encryption. Encryption is a
  choice the user makes per project, never one made for them.

## User stories

- As a novelist, I want to set a passphrase on a project so a stolen laptop does
  not expose my unpublished manuscript.
- As a user, I want to unlock once per session and have every encrypted project
  open, so encryption does not interrupt my writing.
- As a user with a mix of encrypted and plain projects, I want to skip the unlock
  prompt and still get at my unencrypted work.
- As a user, I want to convert an existing project to an encrypted one without
  recreating my work.
- As a user, I want to be warned unmistakably that losing my passphrase destroys
  the project.
- As a user on Android, I want the same protection and the same passphrase model
  as on desktop.

## Functional requirements

**Opt-in**

1. Encryption **must** be off by default. Every existing project, and every
   project created after this feature ships, **must** remain unencrypted until
   the user explicitly enables encryption on it.
2. Enabling encryption **must** be an explicit, per-project user action. The
   system **must not** enable it implicitly under any circumstance — not on
   install or upgrade, not from a project type or template, not on import, and
   not via a config file, environment variable, or build flag.
3. A project that has not opted in **must** be byte-for-byte unchanged on disk:
   this feature **must not** add a file, marker, field, or directory to it.
4. A user with no encrypted projects **must never** be prompted for a passphrase.
   The passphrase **must** be requested only when first enabling encryption, or
   when opening an already-encrypted project.

**Key lifecycle**

5. The system **must** derive a workspace key-encryption key from a single user
   passphrase using a memory-hard KDF (Argon2id, or scrypt where Argon2id is
   unavailable) with a random per-workspace salt, and **must** store the salt and
   KDF parameters in plaintext.
6. The system **must** generate an independent random data key per encrypted
   project, and **must** persist it only wrapped by the workspace key.
7. Unlocking **must** occur once per session and open every encrypted project in
   the workspace; the unwrapped keys **must** be held in memory only and
   discarded on explicit lock and on app exit.
8. Changing the passphrase **must** rewrap the data keys without rewriting file
   bodies.
9. Enabling encryption **must** require the passphrase twice and an explicit
   acknowledgement that loss is unrecoverable.

**Crypto seam**

10. Encryption **must** be implemented as a decorator over `StorageAdapter`
    (`encryptingAdapter(inner, key)`), so it composes unchanged with the
    filesystem, object-store (ADR-019), and Capacitor adapters.
11. The decorator **must** pass the existing `StorageAdapter` conformance suite,
    run against it over at least the filesystem and in-memory backends.
12. No cryptographic operation **may** run for a project that has not opted in,
    and its files **must** be byte-identical to what an unencrypted build would
    write.

    *Amended 2026-08-04 (ADR-022).* This previously required the decorator to be
    absent from the adapter chain entirely, asserted by reference identity. That
    wording forced every caller to opt in by resolving its own project adapter,
    almost none did, and encrypting a project made it unopenable while every unit
    test passed. Encryption is now routed by a per-request adapter that is in the
    chain for all projects but does nothing for one without a key. The intent is
    unchanged; the identity check is gone.
13. No module above the adapter seam **may** reference key material or
    ciphertext.

**Data protection**

14. Every file body written under an encrypted project's directory —
    `project.json`, resource content, sidecars, revisions, `meta/index/`,
    `meta/queries/`, `meta/templates/`, and `.trash/` — **must** be encrypted with
    an AEAD cipher (AES-256-GCM or XChaCha20-Poly1305) under a unique per-write
    nonce.
15. A file failing AEAD tag verification **must** raise a distinct integrity
    error and **must never** surface as empty or partial content.
16. Directory markers and zero-length files **must** round-trip correctly through
    encryption.
17. `atomicWriteFile`'s guarantee **must** hold on encrypted files: a crash never
    leaves a readable-but-partial target.

**Lifecycle and UX**

18. A project's encrypted state **must** be recorded in a plaintext marker
    readable without the passphrase. The marker **must not** contain the project
    name or any other user-authored text.
19. When the workspace contains at least one encrypted project, the app **must**
    offer an unlock prompt before listing projects, and **must** allow the user
    to decline it and continue.
20. With the workspace locked or the prompt declined, unencrypted projects
    **must** remain fully listable and usable, and encrypted projects **must**
    appear as locked entries bearing no title, resource, or metadata content.
21. Project names for encrypted projects **must** be recoverable after unlock
    from a workspace-level index sealed under the workspace key, so rendering the
    list requires one decryption rather than one per project. The index **must**
    be updated on project create, rename, and delete, and **must never** hold
    plaintext names.
22. Converting an existing project **must** rewrite every file to ciphertext,
    and **must** be crash-safe and resumable: an interrupted conversion leaves
    the project openable, never half-readable.
23. A hosted deployment **must** fail closed — encryption is unavailable and the
    UI **must not** offer it until the hosted feature ships.

**Reversibility**

24. The system **must** provide a full-project plaintext export from an unlocked
    encrypted project, producing a complete, openable project directory — not
    just compiled manuscript output. No user may be permanently locked into
    encryption by a feature that has no in-place decryption yet.
25. The conversion machinery (FR22) **must** be direction-agnostic: the same
    crash-safe, resumable rewrite path **must** support plaintext→ciphertext and
    ciphertext→plaintext, with only the latter's UI entry point withheld in this
    iteration. A design that hard-codes a single direction is non-conforming.
26. Discovering an encrypted project whose data keys cannot be unwrapped **must**
    leave every file untouched on disk, so a later recovery or decryption tool
    can still operate on it.
27. Compile and export of an unlocked project **must** produce plaintext output
    and **must** warn before writing it outside the project.
28. Encryption **should** add no more than 15% to resource save and open latency
    at p95 on a mid-range Android device.

## Open questions

None identified. Resolved during spec review:

- **Key custody** — user-passphrase zero-knowledge, no recovery code or escrow.
- **Coverage** — every file body under a project directory.
- **Targets** — desktop and Android in this feature; hosted deferred to its own
  feature rather than shipped as a weaker variant.
- **Crypto seam** — a `StorageAdapter` decorator, chosen over an `ObjectStore`
  wrapper (which would exclude desktop's plain-fs path) and over per-call-site
  encryption in the model layer (unauditable).
- **Passphrase granularity** — one workspace passphrase wrapping per-project data
  keys, preserving per-project isolation and future rotation without a prompt
  per project.
- **Reversibility** — encryption must not be a one-way door. In-place decryption
  is deferred to a later iteration, but recorded here as an early design
  constraint: v1 ships a plaintext escape hatch (FR24) and the migration path is
  required to be direction-agnostic (FR25) so the deferred work is a UI entry
  point, not a rewrite.
- **Locked-project listing** — an unlock gate precedes the project list whenever
  the workspace holds an encrypted project, and the user may decline it and keep
  working with their unencrypted projects (FR19, FR20). This was chosen over
  putting project names in the plaintext marker: titles are frequently the most
  sensitive text a writer has, and `listProjectsCore` reads folders and resources
  per project too, so a locked project cannot yield a normal list entry in any
  case. Names come from a workspace-level sealed index (FR21), so one decryption
  renders the whole list.
- **Opt-in** — off by default, enabled only by an explicit per-project user
  action, with no implicit or configuration-driven path to enabling it (FR1–FR4).
  A project that has not opted in is untouched on disk and bypasses the crypto
  seam entirely (FR3, FR12).

## Out of scope (deferred)

- **Hosted zero-knowledge encryption** — the follow-on feature: a remote-HTTP
  `ObjectStore` implementation plus running the ADR-021 transport-agnostic cores
  in the web build, so ciphertext is produced client-side and the server stores
  opaque blobs.
- Recovery codes, escrow, and hardware-token or passkey-backed unlock.
- Encrypted sharing, multi-device sync, and per-resource access control.
- Encrypting filenames, directory structure, or padding away file sizes.
- **In-place decryption** — exposing the reverse migration (FR25) in the UI, with
  its own confirmation flow and the warning that it writes plaintext to disk. The
  underlying capability is required in v1; only the entry point is deferred.
- A formal third-party cryptographic review.
