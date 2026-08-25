# Follow-up Work: Markdown Support

## 2026-06-16 — Task 1 (Tiptap version bump)

1. **Manual editor smoke-test in the running app. — RESOLVED 2026-06-16.**
   The version bump to `@tiptap/*` 3.26.1 passed typecheck, the full Vitest
   suite (2006 tests), and `next build`. Automated coverage includes the
   editor-mount flow (`tests/flows.test.tsx`), but the app was not launched
   during implementation. **Resolution:** user ran the app and confirmed an
   existing resource opens, renders, and autosaves unchanged.

2. **jsdom landmine for future editor tests (context for Task 5).**
   Tiptap 3.26's Placeholder extension (`@tiptap/extensions`) added viewport
   tracking that calls ProseMirror's `posAtCoords` → `document.elementFromPoint`
   on editor mount. jsdom does not implement `elementFromPoint`, so editor
   mounts throw in the test environment. Stubbed to return `null` in
   `tests/setup.ts` (guarded for the node test environment where `document` is
   undefined). Any new test that mounts the editor (e.g. the Task 5 source/rich
   toggle) relies on this stub — do not remove it.

## 2026-06-16 — Task 3 (custom-node Markdown handlers)

1. **`paragraphLeading` is not preserved in Markdown (deliberate).**
   `GetWriteParagraphLeading` adds a `paragraphLeading` (line-height) global
   attribute to paragraphs. It is presentational with no Markdown
   representation; preserving it would require wrapping affected paragraphs in
   inline `<p style="line-height:…">` HTML, which makes exports unusable as
   Markdown for a display-only setting. Decision: the paragraph and its text
   round-trip; the attribute is normalized to default. _This deviates from a
   literal reading of the Task 3 done-condition ("parse back to the original
   node")._ It should instead be reported by the Task 4 lossy-export warning.

2. **Text color (`textStyle` color) deferred to Task 4. — RESOLVED in Task 4.**
   `textStyle` color/background/font marks have no GFM representation and are
   currently dropped on export (content text is preserved). They are outside
   Task 3's done-condition (which lists wiki links, images, leading paragraphs,
   highlight, math). Decide in Task 4 whether to (a) HTML-fallback them as
   `<span style>` or (b) drop-and-warn. Same applies to `paragraphLeading`.
   **Resolution (2026-06-16, Task 4):** chose **(b) drop-and-warn** for both
   `text-style` and `paragraph-leading` — presentational styling, content text
   preserved, surfaced via `collectMarkdownWarnings`. Revisit only if users ask
   for style-preserving exports (would need `<span style>` / `<p style>` HTML
   fallback).

3. **Flaky test: `tests/unit/media-file-route.test.ts` (test-isolation bug).**
   This file fails intermittently in the full `pnpm test:ci` run (errors:
   `ENOTEMPTY: directory not empty` on temp-dir `rmdir`, and `Unexpected end of
JSON input`) but passes reliably in isolation. Observed across Tasks 1–3, so
   it predates this feature. Likely a parallel temp-directory setup/cleanup
   race. Worth fixing independently (unique temp dirs per test / await cleanup).
   Update (Task 8): `tests/reorder-persistence.test.tsx` and an
   `EnvironmentTeardownError` in `tests/unit/revision-manager.test.ts` were also
   seen failing intermittently in the full run (counts varied 1–3 between runs),
   both passing in isolation — same parallel-worker temp-dir/teardown flake
   family, unrelated to the Markdown work.

## 2026-06-16 — Task 5 (editor source/rich toggle)

1. **No live-editor integration test for the toggle (test-harness limit).
   — PARTIALLY ADDRESSED 2026-06-16.**
   `TipTapEditor` short-circuits to a deterministic HTML mock under Vitest
   (`inTestEnv` guard) and never instantiates ProseMirror, so the actual
   in-editor toggle (click "Edit as Markdown" → textarea → "Rich text" → live
   re-render) cannot be exercised from the unit suite. Task 5 covers the
   behavior with a `MarkdownSourceView` component test plus boundary-conversion
   round-trips over the serializer functions the toggle invokes.
   **Update (2026-06-16):** added a Storybook-driven Playwright e2e
   (`e2e/markdown-source-toggle.e2e.spec.ts`, 9 tests) covering the
   presentational layer end-to-end — the "Edit as Markdown" warning modal
   (open/contents/confirm/cancel/escape) and the `MarkdownSourceView` source
   view (textarea display, editing, return-to-rich toggle). _Still open:_ this
   drives the Storybook components, not the real ProseMirror editor wired inside
   `TipTapEditor`. Fully closing the gap still needs the real editor to mount in
   a browser test (relying on the Task 1 `elementFromPoint` stub) or a dedicated
   test flag that bypasses the `inTestEnv` mock — deferred as a larger refactor
   inappropriate for this branch.

2. **Manual smoke-test of the toggle in the running app. — RESOLVED 2026-06-16.**
   **Resolution:** user toggled a text resource to Markdown, edited, toggled
   back, and confirmed the edited structure renders and autosaves to the
   canonical revision. Noted during the test (and **by design**, per the Task 5
   "conversion only at the toggle boundary" non-goal): there is **no autosave
   while in source mode** — edits live only in the textarea buffer and are
   committed on toggle-back. See the new data-loss follow-up below.

3. **Source-mode edits are discarded if the resource changes before toggling
   back (potential data loss). — Option B implemented 2026-06-16.**
   Because nothing was emitted while editing Markdown source, the in-progress
   `sourceText` was a detached buffer, and `TipTapEditor`'s value-sync effect
   calls `setMode("rich")` on any external `value` change (resource/revision
   switch), dropping the unsaved edits. _Surfaced while smoke-testing the toggle
   on 2026-06-16._
   **Resolution (Option B — autosave in source mode):** `MarkdownSourceView`'s
   `onChange` now routes through a debounced `commitSourceMarkdown` (400 ms) that
   parses GFM → doc, loads it into the hidden editor, and emits `onChange` so the
   existing canonical-revision autosave records it — exactly the path rich mode
   uses. Because the emit fires while still on the resource, it inherits the
   autosave queue's wrong-target protection; the debounce is additionally
   cancelled on toggle-back, on external `value` swaps, and on unmount so a late
   fire can't write the old buffer into a newly-selected resource.
   - _Residual (accepted):_ a sub-second trailing window — the last keystrokes
     within the debounce before a resource switch — can still be lost, because
     the only safe flush point is "while still on the resource." The normal exit
     (toggle-back) always commits fully.
   - _Open question:_ the canonical revision is now continuously rewritten with
     the **normalized** round-tripped doc during source editing (consistent with
     toggle-back, but it diverges from the literal source text once typing
     starts).
   - _Test coverage:_ the commit path is editor-coupled and lives inside
     `TipTapEditor`, which short-circuits to the mock under Vitest (same
     `inTestEnv` limit as the rest of the toggle wiring), so it is verified by
     manual smoke-test plus the serializer/source-view unit tests rather than a
     direct unit test.
   - _Deferred alternatives_ (lift mode to the shell for guaranteed commit-on-
     leave / warn-on-leave / per-resource draft buffer) are captured in the
     `saboteur-pos` note "markdown source-mode autosave: data-loss options".

## 2026-06-16 — Task 9 (consolidated test coverage)

1. **Pre-existing temp-dir teardown flake persists (not resolved here).**
   The full `pnpm test:ci` run for Task 9 again surfaced the documented
   parallel-worker flake — `tests/unit/media-file-route.test.ts` failing with
   `ENOTEMPTY: directory not empty` on temp-dir `rmdir`, passing 5/5 in
   isolation (see Task 3 follow-up item 3). Task 9 is a Markdown-coverage task
   and deliberately did **not** fix this test-infra issue; it remains open and
   worth fixing independently (unique temp dirs per test / awaited cleanup, or
   `pool: "forks"` isolation for the FS-touching route tests).

2. **No end-to-end (Playwright/Storybook) Markdown coverage added.
   — PARTIALLY ADDRESSED 2026-06-16.**
   Task 9 consolidated unit/integration coverage only.
   **Update (2026-06-16):** the source/rich toggle UI now has a Storybook
   Playwright pass (`e2e/markdown-source-toggle.e2e.spec.ts`); the export and
   compile modals already had e2e (`e2e/export-modal.e2e.spec.ts`,
   `e2e/compile-preview.e2e.spec.ts`). _Still open:_ no e2e exercises the **real
   ProseMirror editor** through the toggle (see Task 5 item 1), and no e2e drives
   a full export/compile **download + warning** round trip through the live shell
   (`page.tsx`/`AppShell`/`ShellModalCoordinator`) — that wiring is still covered
   only at the modal-component layer.

## 2026-06-16 — "Edit as Markdown" confirmation modal (enhancement)

Added a warning modal that intercepts the "Edit as Markdown" toggle so the
switch to source mode no longer happens silently. `TipTapEditor` now computes
`collectMarkdownWarnings(editor.getJSON())` on toggle, opens
`MarkdownSwitchWarningModal` (built on the shared `ConfirmDialog`), and only
runs the existing `switchToSource` conversion if the user confirms. The modal
always states the general impact (the conversion is one-way for formatting GFM
can't represent) and, when the live document contains lossy constructs, lists
each affected construct with its occurrence count and how it is handled
(HTML fallback vs. dropped). Covered by component tests in
`tests/markdownSourceToggle.test.tsx` plus a Storybook story.

1. **TipTapEditor wiring is not unit-tested (same `inTestEnv` limit).
   — Manual smoke-test RESOLVED 2026-06-16; full wiring e2e still open.**
   The new `requestSwitchToSource` → modal → confirm/cancel path lives in
   `TipTapEditor`, which short-circuits to the deterministic mock under Vitest
   and never mounts ProseMirror (see Task 5 item 1). The modal and its
   warning-rendering logic are tested directly via `MarkdownSwitchWarningModal`
   (unit) and a Storybook Playwright pass (`e2e/markdown-source-toggle.e2e.spec
.ts`). **Resolution:** user smoke-tested in the running app — the modal
   appears on "Edit as Markdown", Cancel keeps rich mode, Confirm enters source
   mode. _Still open:_ the toolbar-button → modal → `switchToSource` thread
   inside the real editor is exercised only manually, not by an automated test,
   for the same `inTestEnv` reason above.
