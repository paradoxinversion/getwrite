# Tasks: End-to-End Encryption for Project Files

Spec: `specs/features/end-to-end-encryption.md`
Targets: desktop (Electron) + native Android. Hosted is a separate feature.

FR numbers below refer to that spec's Functional Requirements (FR1–FR28).
Spike findings: `kdf-spike.md` (Task 1), `conversion-spike.md` (Tasks 13–15).

---

### Task 1: Cryptographic primitives module

**What:** A crypto module exposing Argon2id key derivation, AES-256-GCM
seal/open, and random key/salt/nonce generation — one implementation serving both
desktop and Android.
**Files:** `frontend/src/lib/models/crypto/primitives.ts` (new),
`frontend/tests/unit/crypto-primitives.test.ts` (new), `frontend/package.json`
**Done when:** `@noble/hashes` is added with `package-selection.md` sign-off;
KDF test vectors and AEAD round-trip pass under Vitest; the module resolves in
both the Node and native/static-export build paths.
**Depends on:** none
**Estimate:** 3
**Notes:** **De-risked by spike** — see `kdf-spike.md`. Decisions already made:
Argon2id via `@noble/hashes` at m=19 MiB, t=2, p=1; AES-256-GCM via
`globalThis.crypto.subtle`, which exists in both Node 24 and the Android WebView
(Capacitor defaults Android to `https://localhost`, a secure context). No dual
implementation needed, so the estimate drops from 5 to 3. Store salt *and*
Argon2id parameters in plaintext so they can be raised later without invalidating
projects.
**Done:** [x] — `@noble/hashes@2.2.0` added (zero runtime deps). 24 tests
including a pinned Argon2id vector guarding against parameter/library drift.
Implementation note: `randomBytes` chunks at 65,536 bytes, the Web Crypto
per-call quota — a single large call throws `QuotaExceededError` in the WebView
as well as in tests.

### Task 2: Sealed-envelope format

**What:** A versioned binary envelope (magic bytes, format version, nonce, sealed
payload) with `seal(key, plaintext)` / `open(key, envelope)` and a detectable
"this is not an envelope" case.
**Files:** `frontend/src/lib/models/crypto/envelope.ts` (new),
`frontend/tests/unit/crypto-envelope.test.ts` (new)
**Done when:** Round-trip of empty, small, and multi-MB payloads passes; a
tampered byte anywhere fails to open; plaintext input is unambiguously
distinguishable from an envelope.
**Depends on:** 1
**Estimate:** 3
**Notes:** The version byte makes future cipher/framing rotation possible without
a migration. **Correction to an earlier note here:** it should *not* carry the
KDF parameters. Files are sealed under a per-project data key, never under the
passphrase-derived key, so raising Argon2id cost rewraps the keyring (Task 3) and
leaves every file byte-identical — putting KDF params in each file would be both
wrong and wasteful.
**Done:** [x] — 19 tests. Layout `magic(4) | version(1) | nonce(12) |
ciphertext+tag`, overhead **33 B**, not the 28 B the spike measured for a bare
AEAD payload (the spike had no magic or version bytes). Magic is `G W E 0x00`;
the trailing NUL is what guarantees no UTF-8 text file can be mistaken for an
envelope. `EnvelopeFormatError` ("not encrypted") and `EnvelopeIntegrityError`
("encrypted and untrustworthy") are separate types — Task 15's tolerant reads
depend on telling those apart.

### Task 3: Keyring module

**What:** A `Keyring` holding the unwrapped workspace key and per-project data
keys in memory, with create / unlock / lock / add-project / rewrap operations, and
persistence of only wrapped material.
**Files:** `frontend/src/lib/models/crypto/keyring.ts` (new),
`frontend/src/lib/models/crypto/keyring-store.ts` (new),
`frontend/tests/unit/keyring.test.ts` (new)
**Done when:** A keyring can be created from a passphrase, persisted, reloaded,
unlocked with the correct passphrase, rejects a wrong one, and never writes an
unwrapped key; per-project data keys are independently random (FR5, FR6).
**Depends on:** 2
**Estimate:** 5
**Notes:** Store salt + KDF params in plaintext (FR5). The keyring file lives at
the workspace (projects-dir) root, not inside any project.
**Done:** [ ]

### Task 4: `encryptingAdapter` decorator

**What:** A `StorageAdapter` decorator that seals file bodies on write and opens
them on read, delegating all path/directory semantics to the inner adapter.
**Files:** `frontend/src/lib/models/encryptingAdapter.ts` (new),
`frontend/tests/unit/encrypting-adapter.test.ts` (new)
**Done when:** `encryptingAdapter(createMemoryAdapter(), keyring)` round-trips
text and binary through `readFile`/`readFileBuffer`/`writeFile`/`copyFile`/`cp`/
`rename`, and on-disk bytes are verified to contain no plaintext (FR10, FR14).
**Depends on:** 3
**Estimate:** 5
**Notes:** `readFile` must decrypt *then* decode to the requested encoding.
`stat().size` will report ciphertext length — ADR-019's reconnaissance confirmed
the model layer never reads `size`, so this is safe, but assert it stays true.
`copyFile`/`rename` within one project can move ciphertext without re-sealing.
**Done:** [ ]

### Task 5: `appendFile` under encryption

**What:** A correct `appendFile` for sealed files, since AEAD envelopes cannot be
appended to.
**Files:** `frontend/src/lib/models/encryptingAdapter.ts`,
`frontend/tests/unit/encrypting-adapter.test.ts`
**Done when:** Repeated `appendFile` calls against an encrypted path produce a
file whose decrypted content equals the concatenation, and the template
changes-log path (`resource-templates.ts:710`) works unchanged on an encrypted
project.
**Depends on:** 4
**Estimate:** 2
**Notes:** `resource-templates.ts:710` is the only real caller (JSONL changes
log). Read-modify-write is the simple correct answer; a per-line sealed-record
format avoids O(n²) growth if that log ever gets large.
**Done:** [ ]

### Task 6: Conformance suite coverage

**What:** Register the encrypting adapter with the existing shared
`StorageAdapter` conformance suite.
**Files:** `frontend/tests/unit/storage-adapter-conformance.test.ts`
**Done when:** `runStorageAdapterConformance` passes for the encrypting adapter
over the memory adapter, over a temp-dir filesystem adapter, and over the object
store — proving composition with ADR-019 (FR10, FR11).
**Depends on:** 5
**Estimate:** 2
**Notes:** The suite is already parameterized by fixture factory, so this is
additive. If any existing conformance assertion fails, that is a real defect in
Task 4, not a reason to weaken the suite.
**Done:** [ ]

### Task 7: Project marker and sealed name index

**What:** A per-project plaintext marker recording only encrypted state (no
user-authored text), plus a workspace-level index mapping project id → name,
sealed under the workspace key.
**Files:** `frontend/src/lib/models/crypto/project-marker.ts` (new),
`frontend/src/lib/models/crypto/name-index.ts` (new),
`frontend/src/lib/models/schemas.ts`,
`frontend/tests/unit/project-marker.test.ts` (new),
`frontend/tests/unit/name-index.test.ts` (new)
**Done when:** An encrypted project's marker is readable without the passphrase,
validates against a Zod schema, and contains no project name; the sealed index
round-trips and yields every encrypted project's name from a single decryption; a
non-encrypted project has no marker file at all (FR3, FR18, FR21).
**Depends on:** 3
**Estimate:** 5
**Notes:** Resolved during review — the marker deliberately carries no title,
because writers' project titles are often the most sensitive text they have. The
index is a second source of truth for names, so create/rename/delete must all
update it; a rename that updates `project.json` but not the index is the obvious
defect to test for. Estimate raised from 3 to 5 for the added index.
**Done:** [ ]

### Task 8: Per-project adapter selection

**What:** Wire adapter resolution so the encrypting decorator is applied only to
projects that opted in, and is entirely absent from the chain otherwise.
**Files:** `frontend/src/lib/models/storage-context.ts`,
`frontend/src/lib/models/io.ts` (`runForTenant`),
`frontend/src/lib/models/project-root-resolver.ts`,
`frontend/tests/unit/storage-context-encryption.test.ts` (new)
**Done when:** Operations on a non-opted-in project run through an adapter chain
containing no crypto code (assertable by identity), and operations on an
encrypted project decrypt transparently (FR3, FR12).
**Depends on:** 4, 7
**Estimate:** 5
**Notes:** Real design tension: `StorageContext` binds one adapter per
`tenantRoot`, but encryption is per *project*. Project-scoped entry points can
resolve per project; `listProjectsCore` spans all projects and needs the marker
(Task 7) rather than a per-project adapter.
**Done:** [ ]

### Task 9: Project listing in locked and unlocked states

**What:** Make `listProjectsCore` return locked entries for encrypted projects
when the workspace is locked, and full entries once unlocked.
**Files:** `frontend/src/lib/models/project-crud-core.ts`,
`frontend/components/Start/StartPage.tsx`,
`frontend/tests/unit/project-crud-core.test.ts`
**Done when:** Locked, the Start screen lists unencrypted projects normally and
encrypted ones as titleless locked entries, with no warnings and none dropped;
unlocked, all projects list normally with names resolved via the sealed index
(FR20, FR21).
**Depends on:** 8
**Estimate:** 5
**Notes:** `listProjectsCore` reads `project.json`, `folders/`, *and* every
resource per project — all encrypted — so a locked project cannot produce a
normal `ProjectListEntry`. This needs a discriminated locked/unlocked entry
shape flowing through `buildProjectView` and `StartPage`, which is why the
estimate rose from 3 to 5. Note the existing skip-on-unparseable path: an
encrypted manifest would silently vanish through it today.
**Done:** [ ]

### Task 10: Session lock lifecycle

**What:** Session-scoped keyring state: unlock once, hold in memory only, discard
on explicit lock and app exit.
**Files:** `frontend/src/lib/models/crypto/keyring-session.ts` (new),
`frontend/src/store/cryptoSlice.ts` (new),
`frontend/tests/unit/keyring-session.test.ts` (new)
**Done when:** One unlock opens every encrypted project in the workspace; explicit
lock and app exit clear keys; no key material is ever persisted or logged (FR7).
**Depends on:** 3
**Estimate:** 3
**Notes:** Follow the existing slice + transport-service + guards pattern. Ensure
keys are excluded from any Redux devtools/state serialization.
**Done:** [ ]

### Task 11: Enable-encryption flow

**What:** The opt-in UI: passphrase entered twice, explicit unrecoverable-loss
acknowledgement, reachable only by deliberate user action.
**Files:** `frontend/components/preferences/EncryptionSettings.tsx` (new),
`frontend/components/common/EncryptionSetupModal.tsx` (new) + stories + tests
**Done when:** Encryption can be enabled only from project settings; mismatched
passphrases block submission; the acknowledgement is required; no other code path
enables encryption (FR2, FR9).
**Depends on:** 10
**Estimate:** 3
**Notes:** FR2's exclusion list (upgrade, project type, template, import, config,
env) should each get an explicit negative test.
**Done:** [ ]

### Task 12: Unlock gate and prompt

**What:** The startup unlock gate shown before the project list when the
workspace holds an encrypted project, with a decline path, plus unlock-on-open
for an individual locked project.
**Files:** `frontend/components/common/UnlockModal.tsx` (new),
`frontend/components/Start/StartPage.tsx` + stories + tests
**Done when:** A workspace with an encrypted project prompts before listing;
declining still lists and opens unencrypted projects; the correct passphrase
unlocks every encrypted project at once; a wrong passphrase gives a distinct
error; a workspace with zero encrypted projects never prompts (FR4, FR7, FR19,
FR20).
**Depends on:** 9, 10
**Estimate:** 5
**Notes:** The decline path is what keeps opt-in honest — encrypting one project
must not hold the user's other work hostage. Wrong-passphrase must be
distinguishable from data-integrity failure (Task 15) in the UI copy. Estimate
raised from 3 to 5 for the gate and its declined state; dependency on Task 9
added, since the gate and the list's locked shape are the same surface.
**Done:** [ ]

### Task 13: Exclusive project write barrier

**What:** A project-level exclusive lock that blocks *all* writes to a project
for the duration of a conversion, not just metadata operations.
**Files:** `frontend/src/lib/models/crypto/write-barrier.ts` (new),
`frontend/src/lib/models/resource-persistence.ts`,
`frontend/src/lib/models/storage-context.ts`,
`frontend/tests/unit/write-barrier.test.ts` (new)
**Done when:** With a barrier held, every write path to that project — resource
save, sidecar, index, revision, trash — either blocks or fails fast, and a test
that autosaves a resource mid-conversion cannot leave a plaintext file in a
converted project.
**Depends on:** 8
**Estimate:** 3
**Notes:** **Found by spike** (`conversion-spike.md`, Hazard 1) — this is where
the real difficulty in the old Task 13 actually lived. `withMetaLock` is *not*
sufficient: `resource-persistence.ts`, the content save path, does not use it,
so editor autosaves bypass it entirely. Prefer failing fast with a clear "project
is being converted" error over silent blocking.
**Done:** [ ]

### Task 14: Direction-agnostic conversion sweep

**What:** A crash-safe, resumable, bidirectional project rewrite
(`convertProject(direction)`) driven by an idempotent sweep.
**Files:** `frontend/src/lib/models/crypto/convert-project.ts` (new),
`frontend/tests/unit/convert-project.test.ts` (new)
**Done when:** Both directions complete correctly; a crash injected at *every*
I/O operation index leaves the project openable and resumable; re-running the
conversion is a no-op; no orphan `.tmp` or marker survives (FR22, FR25).
**Depends on:** 6, 13
**Estimate:** 5
**Notes:** **De-risked by spike** (`conversion-spike.md`) — 8 → 5. No per-file
journal is needed: envelopes are self-identifying (Task 2), so the data is its
own progress record, resume is simply re-running the sweep, and both directions
share one loop with a flipped predicate. Protocol: write conversion marker →
sweep → flip state marker → delete conversion marker. Port the spike's exhaustive
crash-injection harness into the real test; it found no failures across 232
scenarios and is the proof FR22 needs.
**Done:** [ ]

### Task 15: Tolerant-read mode

**What:** Reads that accept either plaintext or ciphertext, enabled strictly
while a conversion marker is present and never otherwise.
**Files:** `frontend/src/lib/models/encryptingAdapter.ts`,
`frontend/tests/unit/encrypting-adapter.test.ts`
**Done when:** A half-converted project opens and every resource reads correctly;
with no conversion marker, a plaintext file where ciphertext is expected is
rejected as a downgrade (FR22).
**Depends on:** 14
**Estimate:** 2
**Notes:** **Found by spike** (Hazard 3). Tolerance is what keeps an interrupted
conversion openable, but a tolerant *default* would be a permanent downgrade
vector. Gate it on marker presence only; the exposure window is then bounded by
conversion duration (seconds, for a ~75-file project).
**Done:** [ ]

### Task 16: Convert-to-encrypted entry point

**What:** The UI action that converts an existing project, with progress and a
non-dismissible in-progress state.
**Files:** `frontend/components/preferences/EncryptionSettings.tsx`,
`frontend/components/common/EncryptionSetupModal.tsx` + tests
**Done when:** A populated project converts end to end, resources open correctly
afterward, and interrupting mid-conversion resumes cleanly on next launch (FR22).
**Depends on:** 11, 14, 15
**Estimate:** 3
**Notes:** Only the encrypt direction gets an entry point; the decrypt direction
stays capability-only per the spec's deferred list. The non-dismissible state
pairs with Task 13's barrier — the user must not be able to start editing into a
blocked project.
**Done:** [ ]

### Task 17: Integrity-failure handling

**What:** Distinct, non-destructive handling of files that fail AEAD verification
or whose keys cannot be unwrapped.
**Files:** `frontend/src/lib/models/crypto/errors.ts` (new),
`frontend/src/lib/models/encryptingAdapter.ts`,
`frontend/tests/unit/encrypting-adapter.test.ts`
**Done when:** A tampered file raises a distinct integrity error (never empty or
partial content), and a project whose keys cannot be unwrapped is left
byte-for-byte untouched on disk (FR15, FR26).
**Depends on:** 4
**Estimate:** 3
**Notes:** FR26 matters most where existing code "repairs" unreadable state —
`listProjectsCore`'s skip path and any trash/cleanup routine must not delete or
rewrite data that is merely locked.
**Done:** [ ]

### Task 18: Full-project plaintext export

**What:** Export of an unlocked encrypted project as a complete, openable
plaintext project directory.
**Files:** `frontend/src/lib/models/export-core.ts`,
`frontend/components/common/ExportPreviewModal.tsx`,
`frontend/tests/integration/encrypted-export.test.ts` (new)
**Done when:** Exporting an encrypted project yields a directory that opens as a
normal unencrypted project with all resources, revisions, and metadata intact
(FR24).
**Depends on:** 14
**Estimate:** 5
**Notes:** This is the escape hatch that keeps opt-in from being a one-way door —
should reuse Task 14's decrypt direction rather than a parallel implementation.
The spike verified an encrypt→decrypt round trip is byte-identical to the
original.
**Done:** [ ]

### Task 19: Plaintext-output warning

**What:** A warning before compile or export writes plaintext outside the project.
**Files:** `frontend/components/common/CompilePreviewModal.tsx`,
`frontend/components/common/ExportPreviewModal.tsx` + tests
**Done when:** Compile and export from an unlocked encrypted project both warn
before writing, and the warning is absent for unencrypted projects (FR27).
**Depends on:** 18
**Estimate:** 2
**Done:** [ ]

### Task 20: Hosted fail-closed

**What:** Ensure hosted deployments neither offer nor accept encryption.
**Files:** `frontend/src/lib/models/project-features.ts`,
`frontend/app/api/auth-status/route.ts` or equivalent capability signal + tests
**Done when:** With hosted auth active, the encryption UI is absent and any
server-side attempt to enable encryption is rejected (FR23).
**Depends on:** 11
**Estimate:** 2
**Notes:** Fail-closed on the *server* signal, not a client check — a client-only
gate would leave the API reachable.
**Done:** [ ]

### Task 21: Android adoption and performance

**What:** Encryption working over `capacitorFsAdapter` in the WebView, within the
latency budget.
**Files:** `frontend/src/lib/models/capacitorFsAdapter.ts`,
`frontend/src/lib/models/native-bootstrap.ts`,
`frontend/src/lib/models/native-device-harness.ts`
**Done when:** On-device create/open/edit/save/search on an encrypted project all
work offline; `crypto.subtle` is confirmed available in the real WebView; unlock
latency is measured; and save/open p95 is within 15% of the unencrypted baseline
(FR28).
**Depends on:** 16, 17
**Estimate:** 5
**Notes:** Extend the existing device harness rather than adding UI. Per
`kdf-spike.md`, AES-GCM runs 2-3 orders of magnitude faster than the ~10 MB/s
base64 bridge, so the throughput budget should pass comfortably — the two things
genuinely worth measuring are **unlock latency** (extrapolated ~0.8-1.3 s, never
measured on-device) and **`crypto.subtle` availability** under Capacitor's
`https://localhost` origin. If unlock proves painful, `hash-wasm` is a drop-in
with byte-identical output and no migration.
**Done:** [ ]

### Task 22: Desktop adoption and end-to-end verification

**What:** Encryption verified end to end on the packaged Electron build.
**Files:** `frontend/tests/integration/encryption-e2e.test.ts` (new),
`electron/src/main.ts` (only if key lifecycle needs app-exit hooks)
**Done when:** On a packaged desktop build: enable → convert → restart → unlock →
edit → search → export all succeed, and inspecting the project directory on disk
reveals no plaintext (FR7, FR14).
**Depends on:** 16, 17, 18
**Estimate:** 3
**Notes:** The on-disk plaintext check is the single most valuable assertion in
this list — it validates the whole feature's premise from outside the code.
**Done:** [ ]

### Task 23: ADR and documentation

**What:** An ADR recording the encryption design, plus CLAUDE.md code-map updates.
**Files:** `docs/architecture/ADRs/adr-022-end-to-end-encryption.md` (new),
`CLAUDE.md`, `docs/standards/storage-context.md`
**Done when:** The ADR follows the ADR-019/021 format (context, options
considered, decision, consequences) and CLAUDE.md's code map lists the new crypto
modules.
**Depends on:** 22
**Estimate:** 3
**Notes:** Not a functional requirement — included because every comparable seam
in this repo (ADR-017/018/019/021) has one, and the decorator seam is exactly the
kind of decision those ADRs exist to record. Both spike documents
(`kdf-spike.md`, `conversion-spike.md`) are ready-made "options considered" input.
**Done:** [ ]

---

## Summary

- **Total tasks:** 23
- **Total estimated effort:** 82 points
- **Critical path:** Tasks 1 → 2 → 3 → 4 → 8 → 13 → 14 → 15 → 16 → 22 → 23
  (40 points), computed from the dependency graph rather than by eye. Note it
  runs through Task 8 (per-project adapter selection), which is therefore more
  schedule-critical than its position in the list suggests. Tasks 7 and 9 feed
  Task 8 and should start early.
- **Risks:**
  - ~~**Task 1** — algorithm/dependency risk.~~ **Resolved by spike**
    (`kdf-spike.md`): one `crypto.subtle` + `@noble/hashes` implementation serves
    both targets, no dual code path, and the choice is reversible because the two
    candidate Argon2id libraries produce byte-identical output. Estimate 5 → 3.
  - ~~**Task 13 (8)** — crash-safe + resumable + bidirectional.~~ **Resolved by
    spike** (`conversion-spike.md`): self-identifying envelopes remove the need
    for a journal, so the sweep is a 5 and resume is free. The real difficulty
    moved to the new Task 13 (write barrier) — see below. No task is now above 5.
  - **Task 13 (write barrier)** — the live risk from the conversion spike.
    `withMetaLock` does not cover `resource-persistence.ts`, so an autosave
    during conversion can leave a plaintext file in a project marked encrypted.
    Touching every write path is the kind of change that is easy to leave 90%
    complete; enumerate the paths before starting.
  - **Tasks 7, 9, 12 (15 points)** — resolved in review: opaque marker, unlock
    gate with a decline path, names from a sealed workspace index. Residual risk
    is Task 9's discriminated locked/unlocked entry shape, which touches
    `buildProjectView` and `StartPage` and is easy to under-estimate.
  - **Task 7's name index** — a second source of truth for project names.
    Rename, create, and delete must all keep it in sync, and a desync surfaces as
    wrong names on the Start screen rather than as an error.
  - **Task 21** — downgraded by the spike. The 15% throughput budget (FR28)
    should pass with room to spare. What remains unvalidated is unlock latency
    (~0.8-1.3 s extrapolated, never measured on-device) and `crypto.subtle`
    availability in the real WebView.
