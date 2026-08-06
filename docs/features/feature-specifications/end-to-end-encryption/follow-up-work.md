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

## Verification gaps (T22) — CLOSED 2026-08-06

The packaged-build re-check is done. `pnpm electron:package` was walked through
the full manual flow, and the disk scan of the resulting project found **36/38
files sealed**, nothing UTF-8-decodable, zero prose greps, and a sealed name
index. The two plaintext files are the keyring and the marker, both by design and
both verified to carry no user-authored text. Details in `tasks.md` under T22.

## Not caused by this feature, but found by it

> **The migration rescues fewer users than it looks like it does.** Replacing
> `GetWrite.app` is what destroys the in-bundle directory, so anyone updating
> the normal way — a new `.dmg` over the old app — has lost the data before any
> code in the new bundle can run. Nothing shipped *inside* the app can execute
> early enough. It helps only where the old directory survives to the new
> build's first launch. Confirmed on 2026-08-06: repackaging over the installed
> build destroyed the encrypted test project (`271707fe-…`, plus its keyring and
> name index) before the migration ever saw it. The code is correct; the window
> is narrow. Anyone already running a packaged build should be told to copy
> their projects out **before** installing the fixed version.

- [x] **FIXED** on `fix/desktop-projects-outside-bundle`. Packaged builds now
      store projects under `app.getPath("userData")`, and
      `migrateLegacyProjectsDir` moves anything still inside the bundle on each
      packaged launch — never overwriting an existing entry, never deleting on
      failure, and carrying the keyring and name index along with the projects.
      The logic moved to `electron/src/projects-dir.ts` so it could be tested at
      all, and `.github/workflows/electron-checks.yml` now runs those tests on
      every PR; `build-electron.yml` only ran on a published release, which is
      why nothing ever objected to this. Original report:

- [ ] **The packaged desktop build stores projects inside the app bundle.**
      `electron/src/main.ts` resolves `projectsDir` to
      `path.join(process.resourcesPath, "projects")` when packaged, which on
      macOS is `/Applications/GetWrite.app/Contents/Resources/projects` — where
      this verification found real user data.

      Three consequences, in descending severity:

      1. **Upgrade or reinstall destroys user data.** Replacing the `.app`
         replaces its `Contents/`. A drag-to-Applications update silently
         discards every project.
      2. **It breaks code signing.** A signed bundle's contents are sealed;
         writing into `Contents/Resources` at runtime invalidates the signature,
         and on a Gatekeeper-strict path the writes may simply fail. This
         collides directly with the deferred mac signing/notarization work.
      3. It is the wrong location by platform convention — `app.getPath("userData")`
         is the intended home, and `~/Documents/GetWrite` would be a more
         discoverable choice for a writing app.

      Encryption makes the loss sharper (a discarded keyring is unrecoverable
      ciphertext, not merely a lost copy), but the bug predates it and would
      lose plaintext projects just as completely. Fixing it needs a migration for
      anyone already running a packaged build, so it is not a one-line change.
      Not fixed here — it belongs with desktop distribution, not encryption.

## From the code review (2026-08-06)

A review of the branch found thirteen issues. The four high-severity ones are
**fixed** on this branch, together with two mediums that shared their root cause;
`tests/integration/encryption-request-path.test.ts` covers all of them by binding
the adapter the way `with-storage-context.ts` does and passing no explicit
`adapter` anywhere.

Fixed:

- **Encrypting a second project failed outright.** Every crypto module documented
  "must be the plain adapter" and then defaulted to `getStorageAdapter()`, which
  under a request *is* the routed encrypting adapter. Registering the second
  project's key mid-call flipped that adapter into decrypting the plaintext the
  sweep was partway through sealing, and stranded a sealed, unparseable
  `.converting.json`. Fixed with `getPlainStorageAdapter()` (`io.ts`), which
  unwraps via `UNDERLYING_ADAPTER`. The same fix restored the marker read in
  `project-crud-core.ts`, so FR21's lazy listing and the rename → name-index sync
  work again while unlocked.
- **The write barrier never engaged.** `assertWritable` read
  `StorageContext.projectRoot`, which `withStorageContext` never sets, so it
  returned on its first line for every ordinary write — the autosave-during-
  conversion race it exists to stop was never actually blocked, despite two UI
  components carrying comments claiming otherwise. The project is now derived
  from the write's path.
- **No tolerant reads on the request adapter**, so a half-converted project threw
  on every unsealed file (FR22). Resolved per read, and only after a read has
  already failed as "not an envelope", so the downgrade window stays narrow and
  an integrity failure is still never tolerated.
- **`registerProject` could strand a key in memory.** It mutated the keyring
  before persisting, so a failed write left `hasProject` true for a key that
  existed nowhere on disk; a retry would then seal the project under it. Now
  rolled back on failure.

The remaining seven are also fixed:

- **`POST /api/encryption` now fails closed for every action**, not just
  `enable` — `unlock` derived a workspace key and opened server-side session
  state, and `export` wrote a whole plaintext project, on a deployment whose own
  `GET` reported the feature unavailable (FR23). The test signs a hosted user in
  and satisfies the CSRF gate, because an anonymous request stops at the
  wrapper's 401 and would pass with or without the guard.
- **The FR27 plaintext-output warning is reachable.** `isSourceEncrypted` had no
  caller outside its own test; `AppShell` now derives it from the active
  project and threads it through `ShellModalCoordinator` to both preview modals,
  and `StartPage` supplies it for the project-level compile.
- **The encryption panel no longer offers "Encrypt" while the workspace is
  locked**, where it submitted `passphrase: null` and threw `SessionLockedError`
  every time. It explains that unlocking comes first.
- **`readConversionMarker` parses inside its guard,** so a marker truncated by
  the crash it records reads as absent instead of making the project both
  unopenable and unresumable.
- **Declining the unlock prompt is no longer permanent** — a real unlock clears
  it, so a later lock prompts again.
- **The setup modal's progress line is gone.** It was `isBusy && progress` behind
  a prop no caller passed and no slice held, and it could not be satisfied: the
  route answers with one JSON response after the sweep finishes. It now says
  only that a conversion is running. **Streaming real progress is the open
  enhancement** — it needs a streamed response plus a native counterpart, which
  is why it was not done here.
- The orphaned JSDoc above `refreshProjects` is removed.

**Every one of the thirteen was an integration defect; none was in the
cryptography.** Three of the tests that should have caught them passed because
they supplied, as props or arguments, the exact thing production could not
produce — a plain adapter, a progress count, an `isSourceEncrypted` flag. That
pattern is worth naming in review: a test that hands a component the input under
test proves the component, never the wiring.

## Known coverage gap

- [ ] **The Start-screen flag mapping in `app/(app)/page.tsx` is untested.**
      `refreshProjects` maps API entries through `buildProjectView`, which
      returns only project/folders/resources — so `isEncrypted`/`isLocked` were
      silently dropped and every locked project rendered as "Untitled Project ·
      0 resources · 0 folders". Fixed, but the `StartPage` tests pass either way
      because they supply the flags directly as props; removing the fix breaks
      nothing. Covering it needs a page-level test with a mocked
      `listProjects()`. This is the fifth defect of this exact shape — a value
      computed correctly server-side and lost in a client mapping.

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
