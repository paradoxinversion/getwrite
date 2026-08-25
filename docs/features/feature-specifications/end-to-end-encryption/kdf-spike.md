# Spike: KDF and AEAD selection for end-to-end encryption

Resolves the Task 1 risk in `tasks.md`: _"Argon2id is not in WebCrypto and Node's
`crypto.scrypt` is not in the browser — a shared implementation may need a WASM
dependency."_

**Outcome: de-risked.** A single implementation covers desktop and Android. No
dual code path is needed.

Measured on Node v24.15.0 (the Volta-pinned version), Apple Silicon, 2026-08-03.
Scripts: `kdf-spike.mjs`, `argon-spike.mjs` in the session scratchpad.

---

## 1. AEAD: AES-256-GCM via WebCrypto — settled, no dependency

`globalThis.crypto.subtle` exists in Node 24 _and_ in the Android WebView, so one
`SubtleCrypto` call path serves both targets. Capacitor sets no `androidScheme`,
so Android defaults to `https://localhost` — a secure context, which is what
gates `crypto.subtle` availability.

| Payload | Seal     | Open     | Throughput |
| ------- | -------- | -------- | ---------- |
| 512 B   | 0.025 ms | 0.014 ms | 19 MB/s    |
| 4 KB    | 0.015 ms | 0.013 ms | 258 MB/s   |
| 64 KB   | 0.042 ms | 0.028 ms | 1.5 GB/s   |
| 1 MB    | 0.224 ms | 0.153 ms | 4.5 GB/s   |
| 10 MB   | 3.97 ms  | 2.66 ms  | 2.5 GB/s   |

Envelope overhead is a flat **+28 bytes** (12-byte nonce + 16-byte tag).
Tampered envelopes are rejected; zero-length payloads round-trip (FR16).

**Implication for FR28's 15% latency budget:** it is not in danger. The Phase 2
media baseline measured the Capacitor base64 filesystem bridge at ~10 MB/s.
AES-GCM runs two to three orders of magnitude faster, so crypto is well under 1%
of a native-path write. The budget's real risk was never the cipher.

## 2. KDF: Argon2id, and the two implementations agree

WebCrypto offers only PBKDF2. Measured PBKDF2 cost on this machine:

| Parameters          | Time   |
| ------------------- | ------ |
| SHA-512 × 210,000   | 37 ms  |
| SHA-256 × 600,000   | 42 ms  |
| SHA-256 × 1,000,000 | 73 ms  |
| SHA-256 × 2,000,000 | 141 ms |

Those numbers are the argument _against_ PBKDF2, not for it. At 42 ms for the
OWASP-recommended 600k iterations, reaching a meaningful work factor needs
iteration counts in the millions — and PBKDF2 is compute-only, so GPUs and ASICs
parallelize it far more effectively than they do a memory-hard function.
Argon2id's memory cost is what buys resistance, and it has no WebCrypto
equivalent at any iteration count.

Two zero-runtime-dependency Argon2id implementations, both benchmarked:

| Parameters                     | `@noble/hashes` (pure JS) | `hash-wasm` (WASM) |
| ------------------------------ | ------------------------- | ------------------ |
| m=19 MiB, t=2, p=1 (OWASP min) | 266 ms                    | 19 ms              |
| m=45 MiB, t=1, p=1             | 325 ms                    | 22 ms              |
| m=64 MiB, t=3, p=1             | 1362 ms                   | 94 ms              |

**The load-bearing finding: the two produce byte-identical output for identical
parameters** (verified in `argon-spike.mjs`). So the choice is not a lock-in.
A target could use one implementation and another target the other, and the same
passphrase still derives the same key — which also means switching later is not a
data migration.

|                        | `@noble/hashes` 2.2.0 | `hash-wasm` 4.12.0      |
| ---------------------- | --------------------- | ----------------------- |
| Runtime dependencies   | none                  | none                    |
| Installed size         | 1.0 MB                | 2.0 MB                  |
| Form                   | pure JS/TS            | WASM binary + JS loader |
| WebView considerations | none                  | WASM instantiate + CSP  |

## 3. Extrapolation to phone (needs on-device confirmation)

Mid-range Android is roughly 3–5× slower than this machine for memory-hard work.
**These are extrapolations, not measurements** — Task 19 should confirm them via
the existing device harness:

- Pure JS at OWASP min: 266 ms → **~0.8–1.3 s** per unlock.
- WASM at OWASP min: 19 ms → **~60–100 ms** per unlock.
- WASM at m=64 MiB t=3: 94 ms → **~300–500 ms** per unlock.

Unlock happens once per session (FR7), so ~1 s is tolerable. The real difference
is _security per unit of wall-clock_: within any fixed time budget, WASM affords
substantially heavier parameters, and heavier parameters are the entire defense.

Memory is not a constraint either way — 19 MiB is comfortable in an Android
WebView heap.

## 4. Recommendation

Argon2id at OWASP-minimum parameters (m=19 MiB, t=2, p=1) to derive the workspace
key, AES-256-GCM via WebCrypto for all file sealing. Store the salt and the full
parameter set in plaintext beside the wrapped keys (FR5), so parameters can be
raised later without invalidating existing projects.

**Implementation: `@noble/hashes` (pure JS), decided 2026-08-03.** Chosen over
`hash-wasm` for the smaller footprint, no WASM instantiate step in the WebView,
and no CSP interaction with the native static export. ~1 s per unlock on phone is
acceptable for a once-per-session operation.

This is reversible: because both implementations produce byte-identical output,
switching to `hash-wasm` later — to buy heavier parameters within the same
wall-clock — is a dependency swap, not a data migration. Revisit if Task 19
measures unlock latency materially worse than the ~0.8–1.3 s extrapolation.

## 5. Consequences for the task list

- Task 1 drops from 5 to 3 points: no dual implementation, no algorithm research,
  one dependency to clear against `docs/standards/package-selection.md`.
- Task 19's latency budget (FR28) is very likely to pass on the cipher; the
  on-device work is confirming unlock latency and `crypto.subtle` availability in
  the real WebView, not save/open throughput.
- The envelope's version byte (Task 2) should also encode KDF parameters, so
  raising them later is a rewrap rather than a migration.
