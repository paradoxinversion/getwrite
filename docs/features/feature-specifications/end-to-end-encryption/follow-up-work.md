# Follow-up work: End-to-End Encryption

Captured 2026-08-05, at the point [PR #172](https://github.com/saboteur-works/getwrite/pull/172)
was opened. Desktop works and is verified on disk; 86/94 points landed.

Spec: `specs/features/end-to-end-encryption.md` · ADR:
[ADR-022](../../../architecture/ADRs/adr-022-end-to-end-encryption-via-storage-adapter-decorator.md)

---

## Blocking Android (T21, 5 pts)

**Encryption does not function on native yet.** These modules run in-process in
the WebView, but the wiring added in T16b is HTTP-only.

- [ ] **`createTransport` native pair for `lib/api/encryption.ts`** — a
      `native-encryption-backend.ts` (+ `.web-stub.ts`) and the
      `turbopack.resolveAlias` entry, following ADR-021 Phase 1/2. Code only; no
      device needed. ~3 pts.
- [ ] **On-device measurement.** Two claims in ADR-022 are still *inferences*:
      that `crypto.subtle` exists in the WebView (deduced from Capacitor serving
      `https://localhost`), and that unlock costs ~0.8–1.3 s (extrapolated from
      Apple Silicon by a 3–5× guess — the least-evidenced number in the feature).
      ~2 pts.

  The harness additions for this were written and then lost before they reached
  the bundle; they need re-adding to `native-device-harness.ts`. The pipeline
  itself is proven — this sequence worked end to end on a Pixel 7 Pro:

  ```
  pnpm --filter getwrite-android build:harness
  # point capacitor.config.ts webDir at "www" (temporarily)
  pnpm --filter getwrite-android sync
  cd android/android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
  adb install -r app/build/outputs/apk/debug/app-debug.apk
  adb shell run-as works.saboteur.getwrite rm -f files/harness-report.json
  adb shell am force-stop works.saboteur.getwrite   # a warm resume will NOT re-run the harness
  adb shell monkey -p works.saboteur.getwrite -c android.intent.category.LAUNCHER 1
  adb shell run-as works.saboteur.getwrite cat files/harness-report.json
  ```

  Only Java 8 is on the PATH; Android Studio's bundled JDK 21 is what builds.

- [ ] **A Pixel currently holds a harness build, not GetWrite.** `webDir` is
      restored in the repo, but the installed APK is the harness. Rebuild before
      treating what is on the device as the app.

## Verification gaps (T22, 3 pts — substantially done)

- [ ] **Packaged Electron build.** The disk check that passed (35/35 sealed,
      nothing UTF-8-decodable, no prose greps, name index not leaking the title)
      ran against a dev-server-encrypted project. Repeat it against one encrypted
      in a `pnpm electron:package` build. ~1 pt.

## Open questions

- [ ] **The ⌘K content-search symptom is still unexplained.** Search *does* find
      content through the encrypting adapter — proved by
      `tests/unit/search-canonical-text.test.ts` — so decryption was not the
      cause. The `catch { return "" }` that was hiding the real failure is fixed,
      so a recurrence should now surface an actual error. Reproduce and read it.

- [ ] **Lazy listing costs encrypted projects their card detail.** Encrypted
      projects list without resource/folder counts, and their date is the
      marker's `encryptedAt` rather than the manifest's `createdAt`, because
      nothing inside is read (FR21). Deliberate, and it is what makes the sealed
      name index worthwhile — but revisit if it reads as broken rather than as
      private.

- [ ] **`appendFile` is read-modify-write.** Fine for the one real caller (a
      template change log gaining one short line per edit). Would not scale to a
      large log; a per-line sealed-record format is the escape if one appears.

## Deferred by the spec, not by oversight

- **In-place decryption** — the machinery is direction-agnostic and tested both
  ways; only the UI entry point is withheld. The escape hatch today is a full
  plaintext export.
- **Hosted encryption** — needs the model layer in the browser over a remote
  `ObjectStore`. Fails closed until then, checked server-side.
- **Recovery codes, escrow, hardware-backed unlock, encrypted sharing,
  filename encryption, third-party cryptographic review.**

## Pre-existing, untouched

`pnpm knip` and `pnpm test:policy:check` both fail on `main` — knip on a large
baseline of unused exports, the policy check on `e2e/helpers/editor.ts`. Neither
is caused by this feature, and neither was fixed in it.

## The lesson worth carrying

The cryptography was the easy part: two spikes de-risked it early and it worked
close to first time. **Every real defect came from integration** — components
never mounted, a seam built but adopted in one place, a list never refreshed
after unlock, search reporting undecryptable content as empty. Four of them, all
found by using the application, none by 2966 tests.

A reachability sweep afterwards found unreferenced exports but would *not* have
caught the worst of them: that code had one caller and looked used. Counting
finds unreachable code, not under-adopted seams.

Recorded in ADR-022 as: **a seam is not done when it is correct, only when it is
adopted.** Task breakdowns of this shape need an explicit integration task, and a
manual walkthrough before the feature is called complete.
