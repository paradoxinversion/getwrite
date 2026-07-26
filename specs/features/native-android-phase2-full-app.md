# ADR-021 Phase 2 — Full-App Native Integration (WebView Shell + lib/api Collapse + Media)

## Overview

Phase 0 proved the native storage seam on a real device (search only) and
Phase 1 generalized that seam across the app's Redux transport layer
(revisions, queries, metadata schemas, feature flags, auth-status,
update-check). Neither phase made the real GetWrite app boot in the
Capacitor WebView: the `src/lib/api/*` client layer still raw-`fetch`es
`/api/...` routes that don't exist on device, and the app has never been
statically exported or rendered end-to-end natively. A pre-Phase-2 spike
(branch `spike/adr-021-phase2-webview-serve`, commit `1097560`, not merged)
proved the load-bearing unknown — the real app can static-export and render
in the WebView — using hack mechanisms (a stash/restore build script) not
fit for production. Phase 2 collapses the remaining `lib/api` layer
in-process, productionizes a clean static-export build, validates media
transfer over the Capacitor bridge at scale, and closes with a fully
offline, on-device create → edit → save → search → revise gate — making
native Android a functionally complete GetWrite client for the first time.

## Goals

- The full app (not just its Redux data layer) boots and is usable in the
  Capacitor WebView on a physical device, with the real StartPage and
  editor rendering from a static export.
- Every `src/lib/api/*` module (projects, resources, compile, export,
  preferences, editor-config, project-types, tags, resource-excerpts) and
  `project-actions-controller.ts` routes through the same in-process
  transport-collapse pattern Phase 1 established, so no client code depends
  on a running server on native.
- The native static-export build is produced by a clean, repeatable,
  version-controlled mechanism — not the spike's stash/restore script — and
  excludes every surface that is dead or broken on native (API routes,
  hosted-auth pages) without touching hosted/desktop's `standalone` output.
- Image/audio read and write over the Capacitor base64 bridge is measured
  against the Phase 0 baseline (~0.8 MB/s) and either accepted with a
  documented limit or remediated to an acceptable bound.
- A full offline device gate passes on a physical Pixel: create a project,
  edit and save a resource, run search, and create a revision — all without
  network connectivity — matching the Phase 0 gate convention.

## Non-goals

- Android signing, packaging, or Play Store submission (Phase 3).
- iOS support of any kind.
- A mobile-optimized UX redesign of any existing screen — this phase is
  functional parity inside the WebView, not a mobile ergonomics pass
  (unless open-questions triage flags a hard rendering blocker that
  requires a minimal, targeted fix).
- Any change to hosted/desktop's `standalone` build output or behavior.
- Any new shipping dependency (build-time-only export tooling is
  acceptable if unavoidable, and must be flagged explicitly).

## User stories

- As a GetWrite user on Android, I want to open the app and see the real
  project list and editor, not a placeholder screen, so that the native
  build is an actual writing tool.
- As a GetWrite user on Android, I want to create, rename, and delete
  projects and resources, compile, export, set preferences, and manage
  tags entirely offline, so that native parity with desktop/hosted holds
  for everyday work, not just the transport-layer operations Phase 1
  covered.
- As a GetWrite user on Android, I want to add an image or audio resource
  and have it save and reload correctly, so that media-bearing projects
  work on device without unbounded delay or failure.
- As a GetWrite engineer, I want one clean, version-controlled build step
  that produces the native static export, so that producing a native build
  doesn't require manually stashing and restoring files.
- As a GetWrite maintainer, I want proof that a project can be created,
  edited, saved, searched, and revised fully offline on a physical device,
  so that Phase 2 is verified against the same rigor as Phase 0's gate.

## Functional requirements

1. Each of the nine `src/lib/api/*` modules listed in Goals, plus
   `project-actions-controller.ts`, must have its corresponding route's
   operation(s) lifted into a transport-agnostic core module and routed
   through the generalized `createTransport` helper (`frontend/src/store/
   transport/create-transport.ts`) with an in-process native backend, using
   the same pattern Phase 1 applied to the seven `*-transport-service.ts`
   files. `resource/upload`'s core already accepts `Uint8Array` bytes, so its
   native backend skips `req.formData()`/multipart entirely (callers pass
   bytes in-process). `export`/`compile`'s cores already return
   data+filename+warning; their native backends return that structured
   result directly, skipping the HTTP `Content-Type`/`Content-Disposition`/
   `X-Compile-Warning` headers. `revision`'s core is already lifted (Phase 1)
   and is reused as-is by `resources.ts`.
2. Each in-process native backend from FR1 must run its lifted core inside
   `runInStorageContext` over the app-lifetime-bound native `StorageContext`
   established in Phase 0, with no per-operation re-binding.
3. Every existing HTTP route corresponding to the nine `lib/api` modules
   must be preserved byte-for-byte in behavior — same request/response
   shapes, status codes, and error handling — verified by its existing test
   suite passing unmodified.
4. A version-controlled build script must generate a native app tree in a
   build directory — a copy of `app/` minus `app/api/**` and the three
   hosted-auth pages (`app/login`, `app/reset-password`, `app/verify-email`)
   — and `next build` must target that generated tree
   (`output: "export"` when `GETWRITE_BUILD_TARGET=native`, `next.config.mjs`)
   to produce the native static export. This is a copy-forward mechanism:
   `app/` remains the single source of truth and is never mutated, moved,
   stashed, or deleted from, satisfying byte-for-byte identity of the
   hosted/desktop build (FR12). This replaces the spike's stash/restore
   script.
5. `frontend/app/(app)/layout.tsx` must short-circuit past the hosted-auth
   `headers()`/`redirect` gate on the native runtime (consistent with the
   spike's proof), without altering the gate's behavior for web/desktop.
6. `bootstrapNativeStorageContext()` must be called from the root
   `frontend/app/layout.tsx`, behind a build-time
   `NEXT_PUBLIC_GETWRITE_RUNTIME === "native"` branch and guarded to be
   idempotent, so the exported app boots with the native `StorageContext`
   bound before any storage-dependent code runs on every route (every route
   passes through the root layout). No separate native entry file is
   introduced; this replaces any bespoke harness-only bootstrap path.
7. `android/capacitor.config.ts`'s `webDir` must point directly at
   `frontend/out/` (the Next static export output) — no android-local copy
   step — since `cap sync` already copies `webDir` into the native project;
   this replaces the current `android/www/` placeholder.
8. The exported bundle's JavaScript must parse and execute without syntax
   or runtime errors on both ends of Phase 0's supported WebView range
   (minimum-supported and latest), addressing the spike's finding that
   Next's default build target fails to parse on the API-30 stock WebView
   (Chrome 91). A `.browserslistrc` (or `package.json` browserslist) must
   pin the build target to Chrome >= 67 — the effective runtime floor Phase
   0 established (below it, zod v4's BigInt usage and Capacitor 8's bridge
   don't run at all, independent of `minSdk`) — so the Next/SWC export
   transpiles accordingly; this must be verified against a WebView on the
   physical Pixel. `minSdk=24` remains the build floor only; the real
   runtime floor is System WebView >= ~Chrome 67.
9. Image and audio resource read/write over the Capacitor filesystem
   adapter's base64 boundary must first be measured on a physical Pixel
   device against the Phase 0 baseline (~0.8 MB/s) using the existing Phase
   0 on-device verification/baseline-benchmark harness. Only after that
   measurement is taken must a remediation decision be made: either accept
   the measured number with a documented, enforced native media size limit,
   or implement chunked (streaming multi-call) base64 transfer to bring
   representative media files within an acceptable bound. No threshold may
   be pre-committed before the baseline measurement.
10. On a physical Pixel device, fully offline (no network connectivity), a
    tester must be able to: create a project, create and edit a text
    resource, save it, run a search that returns the saved content, and
    create a new revision of that resource — with the indexer/backlinks
    pipeline running live under the app-lifetime `StorageContext` — with no
    step failing or silently no-op'ing.
11. No existing Vitest suite (route tests, transport-service tests, Phase 0
    and Phase 1 conformance/on-device verification) may regress as a
    result of this phase's changes.
12. `pnpm build` for hosted/desktop must remain byte-for-byte identical to
    pre-Phase-2 output; every change in this phase must be additive and
    native-only-reachable.
13. Native code introduced by this phase (lifted native backends, the
    native app-entry bootstrap, native-only build config) must not be
    included in the web bundle, verified by the existing `resolveAlias`
    exclusion-test pattern from Phases 0–1.
14. Any new build-time-only tooling required to produce the clean native
    export (FR4) must be explicitly identified and justified in the
    implementation PR description; no such tool may become a runtime
    dependency of the hosted/desktop or native app.
15. `project-types`'s native core is an outlier: its route reads bundled
    template JSON via raw `node:fs` from a repo-relative path that doesn't
    exist on device. The native core must use a build-time static
    import/inline of the template JSON instead of a filesystem read, rather
    than following the standard `runInStorageContext`-over-lifted-core
    pattern used by the other eight `lib/api` modules.

## Decisions

Resolved during open-questions triage (2026-07-26):

- **Native export exclusion mechanism**: a version-controlled build script
  assembles a generated native app tree (copy of `app/` minus `app/api/**`
  and the three hosted-auth pages) in a build directory, and `next build`
  targets that tree when `GETWRITE_BUILD_TARGET=native`. Copy-forward only
  — `app/` is never mutated — giving one source of truth and replacing the
  spike's stash/restore script. See FR4.
- **`lib/api` separability**: confirmed from the codebase (not an open
  question) — all nine `lib/api/*` modules plus
  `project-actions-controller.ts` lift like Phase 1 (thin route dispatchers
  over pure `lib/models/*`; project root re-derived via the
  `project-root-resolver.ts` pattern, not `resolveProjectPath`). The one
  outlier, `project-types`, needs a build-time static-import core instead of
  a filesystem read (FR15). See FR1 for the upload/export/compile/revision
  nuances.
- **Media performance**: baseline-then-set, per Phase 0's precedent for
  search. Measure first on the physical Pixel with the existing Phase 0
  device benchmark harness, then either accept with a documented/enforced
  size limit or implement chunked transfer as remediation. No threshold is
  pre-committed. See FR9.
- **Browser target**: pin to Chrome >= 67 via `.browserslistrc` (or
  `package.json` browserslist), the effective runtime floor Phase 0
  established independent of `minSdk`; verify on the Pixel. `minSdk=24`
  remains the build floor only. See FR8.
- **Native bootstrap wiring**: `bootstrapNativeStorageContext()` is called
  from the root `app/layout.tsx` behind
  `NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`, idempotent-guarded, since
  every route passes through the root layout. No separate native entry
  file. See FR6.
- **`webDir`**: points directly at `frontend/out/`; no android-local copy,
  since `cap sync` already copies `webDir` into the native project. See
  FR7.
- **Test strategy**: unit-test the nine new native backends against the
  in-memory `CapacitorFilesystemLike` fake for correctness (base64 modeled
  faithfully), as Phases 0–1 did — no new Vitest tier. FR9's media
  *performance* uses the existing Phase 0 on-device benchmark harness
  instead.
- **Branch strategy**: base Phase 2 on clean `main` and re-apply the
  spike's proven diffs (next.config `output: "export"`, the `(app)/layout.tsx`
  short-circuit, the `FieldValueEntry` move, the `capacitor.config.ts`
  `webDir` change), refactoring the spike's stash/restore mechanism into
  the generated-native-tree mechanism from FR4. Mirrors Phase 1's
  precedent of branching from clean `main`.
- **Mobile-ergonomics exception**: narrow and gate-blocking only. A
  targeted single-component CSS/layout fix is allowed only when a control
  is genuinely unusable — defined as: it blocks completion of an FR10 gate
  step outright, not merely cramped-but-usable. Cramped-but-usable issues
  are deferred to a Phase 3 backlog, not fixed in Phase 2.

## Open questions

None — all resolved during triage (2026-07-26). See Decisions below.

## Out of scope (deferred)

- Android signing, packaging, and Play Store submission (Phase 3).
- iOS support.
- Any mobile-optimized UX redesign beyond what functional parity requires.
- Emulator-only verification as a substitute for the physical-device gate
  (FR10 requires a physical Pixel, consistent with the Phase 0 convention).
- Performance optimization of the native runtime beyond the media-transfer
  bound established in FR9 (e.g. general WebView rendering perf tuning).
