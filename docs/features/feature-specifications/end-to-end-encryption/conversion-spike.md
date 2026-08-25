# Spike: crash-safe resumable bidirectional conversion

Resolves the Task 13 risk in `tasks.md`: _"crash-safe AND resumable AND
bidirectional is three hard properties at once."_

**Outcome: two of the three properties are free; the third is a different problem
than the estimate assumed.** Scripts: `convert-spike.mjs`, `convert-hazards.mjs`
in the session scratchpad.

---

## 1. The key insight: no per-file journal is needed

The estimate assumed conversion needs a journal recording which files are done,
and that the journal itself then needs to be crash-safe — the recursive problem
that made this an 8.

It doesn't. Task 2 already requires envelopes to be **self-identifying**
(plaintext is unambiguously distinguishable from an envelope). That makes the
data its own progress record:

- "Is this file done?" is answered by looking at the file.
- Conversion is therefore **idempotent** — re-running it skips completed files.
- **Resume is just "run it again."** There is no separate resume path to write or
  test.
- The same loop runs in both directions; only the target predicate flips, which
  satisfies FR25's direction-agnostic requirement structurally rather than by
  discipline.

The protocol reduces to four steps:

```
1. write conversion marker      (atomic; announces intent before touching data)
2. sweep: for each file, if already in target form skip, else atomic-rewrite
3. flip the project state marker (only once every file agrees with it)
4. delete the conversion marker  (leaving tolerant-read mode last)
```

The marker's presence is both the resume signal and the switch enabling
**tolerant reads** (accept plaintext or ciphertext), which is what keeps a
half-converted project openable per FR22.

## 2. Verification: exhaustive crash injection

Not sampled — a crash was injected at _every_ I/O operation index, then the
conversion resumed and the invariants checked.

| Pass                                     | Scenarios | Result                     |
| ---------------------------------------- | --------- | -------------------------- |
| Single crash + resume (encrypt)          | 29        | 29 pass, 0 fail            |
| Double crash + resume                    | 174       | 174 pass, 0 fail           |
| encrypt → decrypt round trip             | 1         | byte-identical to original |
| Crash at each op, decrypt direction      | 29        | 29 pass, 0 fail            |
| Strict read rejects swapped-in plaintext | 1         | rejected                   |

Invariants asserted after every scenario: no file lost, no file corrupt, no
orphaned `.tmp`, no marker left behind, declared state matches actual file state.
Additionally, at _each mid-crash state_, every file was asserted readable in
tolerant mode — FR22's "openable, never half-readable" claim.

**232 scenarios, no failures.**

## 3. Hazards the model did not simulate — one is real

**Hazard 1 — concurrent app writes. REAL, and it is the actual hard part.**
If the editor autosaves a resource the sweep has already converted, that file is
written back as plaintext, the sweep never revisits it, and the project ends up
marked encrypted with a plaintext file in it. Strict reads then throw, and the
user sees data corruption.

Confirmed against the codebase: `withMetaLock` is used by `sidecar.ts`,
`inverted-index.ts`, `backlinks.ts`, `saved-queries.ts`, `previews.ts`,
`resource-crud-core.ts` and `resource-templates.ts` — but **not** by
`resource-persistence.ts`, the content save path. So the existing lock does not
cover the writes that matter most here. Conversion needs an exclusive
project-level write barrier, not just the meta lock.

**Hazard 2 — object-store rename is copy+delete (ADR-019), not atomic. SAFE.**
A crash between copy and delete leaves the destination correct and an orphan
`.tmp` key. The resume sweep unlinks orphan temps, so no data is at risk.

**Hazard 3 — the tolerant-read window. BOUNDED, accept and document.**
While the marker exists, a plaintext file is accepted where ciphertext is
expected, so an attacker with write access could downgrade a file. The window is
exactly the conversion duration, and strict mode rejects it at all other times
(verified). For a ~75-file project this is seconds.

**Hazard 4 — torn write of a temp file. SAFE.**
The rename never runs, so a torn temp is never committed; the original is intact
and the resume sweep redoes the file.

## 4. Scale

A real project in `projects/` holds **75 files** (8 trash, 8 folder, 24 revision,
~20 resource, plus meta and indexes). At the AES-GCM throughput measured in
`kdf-spike.md`, the crypto cost of a full conversion is negligible; wall-clock is
dominated by file I/O, and on Android by the ~10 MB/s base64 bridge.

## 5. Consequences for the task list

- Task 13 splits. The sweep engine is a **5**, not an 8 — no journal, no separate
  resume path, and bidirectionality falls out of the predicate.
- A new task covers the **exclusive write barrier**, which is where the real
  difficulty moved. It is a distinct concern (locking/adapter layer, not the
  sweep) and must land before the sweep is safe to ship.
- Task 2's envelope work is now load-bearing for conversion correctness, not just
  for reads — its "plaintext is distinguishable from an envelope" done-condition
  is what makes the journal unnecessary.
- The tolerant-read mode must be gated strictly on marker presence. A tolerant
  default would be a permanent downgrade vector.
