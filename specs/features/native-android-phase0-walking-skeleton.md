# ADR-021 Phase 0 — Native Android Walking Skeleton to Device

## Overview

GetWrite ships today as a hosted/desktop Next.js app with no native mobile
target. ADR-021 (Accepted) commits to a genuinely native Android app: a
Capacitor WebView with the model layer running in-process on-device (no Node
child process, no `/api` HTTP), storage via a fourth `StorageAdapter` over
`@capacitor/filesystem`, and the transport layer collapsing HTTP calls to
in-process calls behind a build-time runtime flag. Three spikes have already
proven the storage adapter, the transport-collapse seam (search path), and
the write path against an **in-memory fake** of the Capacitor plugin, with
zero new shipping dependencies. What remains unproven is whether any of this
holds against the **real** Capacitor filesystem plugin on real Android
scoped storage. Phase 0 closes that gap: it drives the smallest possible
slice — search — end to end onto a real emulator/device, retiring the last
genuine hardware unknowns before committing to the breadth of work in
Phases 1–3.

## Goals

- Search returns real, correct results on an Android emulator or device,
  reading from the real on-device filesystem via `@capacitor/filesystem`.
- The `nativeFilesystem()` resolver is wired to the real plugin behind the
  native runtime flag, with the deliberate stub removed.
- The on-device app-private projects directory is resolved and supplied as
  `tenantRoot`, respecting Android scoped-storage constraints.
- `runInStorageContext` is bound exactly once at app startup (not per
  operation), so fire-and-forget indexer/backlinks-watcher work stays inside
  the bound context.
- Desktop and hosted web builds are unaffected: byte-for-byte identical
  output, and no native code enters the web bundle.

## Non-goals

- Lifting any of the other six `*-transport-service.ts` cores, or any
  write-route core, into the in-process seam (Phase 1).
- Wiring the rest of the app's features, or media/base64 handling at scale
  (Phase 2).
- Android signing, packaging, or Play Store submission (Phase 3).
- Resolving the emulator-vs-device, API-level, workspace-placement, or
  perf-threshold questions below — those are captured, not decided, here.

## User stories

- As a GetWrite engineer, I want to run a search on a real Android
  emulator/device and see correct results sourced from the real filesystem
  plugin, so that I know the storage/transport spikes generalize past the
  in-memory fake before I invest in breadth work.
- As a GetWrite engineer, I want the native filesystem root resolved
  correctly under Android scoped storage, so that reads/writes land in an
  app-private location the OS won't reclaim or block.
- As a GetWrite engineer, I want the storage context bound once at app
  startup, so that background work (indexing, backlinks) doesn't silently
  fall outside the bound tenant context.
- As a GetWrite maintainer, I want the desktop and hosted web builds
  provably untouched by this work, so that native enablement carries no risk
  to existing shipping surfaces.

## Functional requirements

1. The build must add `@capacitor/filesystem` as a shipping dependency and a
   Capacitor Android project scaffold, additively — desktop and hosted web
   `pnpm build` output must be byte-for-byte identical to pre-Phase-0 output.
2. Native-only code (the Capacitor Android scaffold and real-plugin wiring)
   must not be included in the web bundle; the existing dynamic-import
   discipline established in the spikes must be preserved.
3. `nativeFilesystem()` in `native-search-backend.ts` must be wired to the
   real `@capacitor/filesystem` plugin when `NEXT_PUBLIC_GETWRITE_RUNTIME`
   resolves to the native runtime, replacing the current stub that throws
   "Native filesystem not wired."
4. The on-device app-private projects directory must be resolved at startup
   and supplied as `tenantRoot`, honoring Android scoped-storage rules (no
   reliance on paths outside the app's private storage).
5. `runInStorageContext` must be bound exactly once, at app startup, for the
   lifetime of the app process — not re-bound per search operation or per
   API call.
6. A search issued from the running Android app must return results that
   match the same query run against an equivalent dataset through the
   existing web/desktop search path (same hits, same ordering). The emulator
   is used for fast iteration during development; the Phase 0 gate itself is
   not considered passed until this check also passes on a physical device.
7. The gate must include a benchmark of large-file base64 read/write
   performance against the real plugin, and a check that directory
   rename-on-collision behavior matches what the in-memory fake assumed in
   the write-path spike. Both checks must pass on a physical device before
   Phase 0 is called done; the emulator may be used to iterate on them
   beforehand but a physical-device pass is the final gate. Rationale:
   physical hardware is what actually exercises real Android scoped-storage
   enforcement and directory-rename-on-collision behavior — the exact
   unknowns Phase 0 exists to retire — and emulator filesystem behavior can
   diverge from it.
8. The perf benchmark in FR7 must be run baseline-first: measure real base64
   read/write throughput against the actual `@capacitor/filesystem` plugin
   on the target device, then set the acceptable threshold from that
   measured data (no threshold is pre-committed). The `nodejs-mobile`
   fallback trigger (ADR-021 Option 1) is therefore defined from the
   baseline data gathered here, not decided in advance; this spec records
   the fallback's existence without requiring a decision to invoke it.
9. No existing Vitest suite (including the 14-case storage adapter
   conformance suite and the write-path spike tests) may regress as a result
   of Phase 0 changes.
10. Phase 0 must target and gate against both the minimum-supported Android
    API level (per Capacitor's/Android's currently-documented minimum) and
    the latest stable Android API level, to cover the range of scoped-storage
    behaviors that tightened across API 29–33+ and motivated Phase 0.
11. The Capacitor Android project must live in a new sibling pnpm workspace
    package, `android/` (e.g. `getwrite-android`), mirroring the `electron/`
    package pattern: its own `package.json`, own scripts, own build config,
    and a `pnpm --filter getwrite-android …` CI target extending the
    existing pattern from `build-electron.yml`. It must not be nested under
    `frontend/`, so that the package responsible for the byte-for-byte
    `pnpm build` guarantee (FR1) is never pulled into a Gradle/Kotlin
    toolchain.
12. CI must skip the live device/emulator step for the Phase 0 gate; the
    physical-device pass required by FR6/FR7 is verified locally and
    manually, not in CI. CI must still cover everything short of hardware:
    typecheck, lint, `test:ci` (including the conformance and write-path
    spike suites), and the buildable (non-launch) parts of the new
    `android/` package — mirroring how `build-electron.yml` builds/packages
    without launching the Electron app.

## Decisions

The following questions were resolved during triage (2026-07-25):

- **Gate target (emulator vs. device):** both — see FR6/FR7. Emulator for
  iteration speed, physical device as the final gate, because only the
  device exercises real scoped-storage enforcement and directory-rename
  behavior.
- **API level:** both the current minimum-supported API and the latest
  stable API — see FR10 — for the broadest coverage of scoped-storage
  behavior changes across API 29–33+.
- **Workspace placement:** new sibling package `android/` — see FR11 — kept
  out of `frontend/` to protect FR1's byte-for-byte build guarantee from a
  Gradle/Kotlin toolchain.
- **Perf threshold:** baseline-then-set, not pre-committed — see FR8 —
  consistent with ADR-021's "prove against the real backend before
  committing" philosophy.
- **CI scope:** skip the live device/emulator step in CI; require local
  manual verification for the device gate — see FR12 — while CI still
  covers typecheck, lint, `test:ci`, and the buildable parts of `android/`.

## Open questions

None — all resolved during triage (2026-07-25). See the Decisions subsection
above and FR6–FR8, FR10–FR12.

## Out of scope (deferred)

- Lifting the remaining `*-transport-service.ts` cores and write-route cores
  into the in-process seam (Phase 1).
- Full-app feature wiring and media/base64 handling at scale (Phase 2).
- Android signing, packaging, and Play Store submission (Phase 3).
- Any decision to pivot to `nodejs-mobile` (ADR-021 Option 1) — only the
  fallback trigger condition is recorded here, not a decision to invoke it.
