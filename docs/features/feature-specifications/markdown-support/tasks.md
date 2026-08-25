# Implementation Tasks: Markdown Support

Derived from [markdown-support-spec.md](./markdown-support-spec.md). Granularity: story points (1/2/3/5/8).

---

### Task 1: Adopt `@tiptap/markdown` and unify Tiptap versions

**What:** Add `@tiptap/markdown` and bump every `@tiptap/*` dependency to a single matching 3.26.x version.
**Files:** `frontend/package.json`, `pnpm-lock.yaml`
**Done when:** `pnpm install`, `pnpm typecheck`, `pnpm build`, and `pnpm test:ci` all pass with all `@tiptap/*` packages on the same 3.26.x version, and the editor renders an existing resource unchanged.
**Depends on:** none
**Estimate:** 3
**Notes:** Tiptap requires a uniform version across all `@tiptap/*` packages. Watch for 3.23→3.26 breaking changes in StarterKit, table, mathematics, and the custom extensions in `components/Editor/Extensions/`.
**Done:** [x] — all `@tiptap/*` at 3.26.1 + `@tiptap/markdown@3.26.1`; typecheck/build/test:ci (2006 passed) green. Required a jsdom `elementFromPoint` stub in `tests/setup.ts` (3.26 Placeholder viewport tracking). See `follow-up-work.md`.

---

### Task 2: Shared Markdown serializer built from the editor extension set

**What:** Create a module that registers the `Markdown` extension and exposes Tiptap-JSON↔Markdown conversion reusable both in the live editor and server-side (export/compile), built on the existing exported `extensions` array.
**Files:** `frontend/src/lib/export/markdown-serializer.ts` (new), `frontend/components/TipTapEditor.tsx` (add `Markdown` to the exported `extensions`)
**Done when:** A unit test converts a TipTap JSON document containing headings, bold/italic, lists, blockquote, code block, inline code, links, and a GFM table to Markdown and back, with the JSON structurally equal after the round trip.
**Depends on:** 1
**Estimate:** 3
**Notes:** `extensions` is already exported from `TipTapEditor.tsx:92`. Server use is viable because `MarkdownManager` consumes `@tiptap/core` extensions without a live editor; configure GFM. Conversion is normalized, not byte-preserving (per spec non-goal).
**Done:** [x] — extracted the document schema into server-safe `components/Editor/editorExtensions.ts` (`baseSchemaExtensions`, shared by the editor + serializer); added `src/lib/export/markdown-serializer.ts` (`documentToMarkdown`/`markdownToDocument` via `MarkdownManager`). Round-trip test `tests/unit/markdown-serializer.test.ts` green (headings, bold/italic, inline code, blockquote, lists, code block, link, GFM table; JSON→MD→JSON structural equality). GFM tables round-trip out of the box — no custom table handler needed in Task 3. The live-editor `Markdown` extension (`getMarkdown()`) was deferred to Task 5 where the toggle uses it.

---

### Task 3: Markdown round-trip handlers for GetWrite custom nodes/marks

**What:** Add `markdownTokenName`/`parseMarkdown`/`renderMarkdown` (or `markdownOptions`) to GetWrite's custom extensions so each defines its own Markdown behavior; non-representable ones render as inline HTML fallback.
**Files:** `frontend/components/Editor/Extensions/WikiLinkDecoration.ts`, `GetWriteImage.ts`, `GetWriteParagraphLeading.ts`, `CustomHeading.ts`, plus highlight/math config in `frontend/components/TipTapEditor.tsx`
**Done when:** Round-trip unit tests show wiki links, images, leading paragraphs, highlight, and math each either serialize to GFM or to inline HTML, and parse back to the original node/mark, with no node silently dropped.
**Depends on:** 2
**Estimate:** 5
**Notes:** Satisfies FR-4 and FR-9. Math (`@tiptap/extension-mathematics`) and text color have no GFM equivalent → HTML fallback path. Confirm `TableKit` round-trips as GFM tables; if not, add a handler here.
**Done:** [x] — In Tiptap 3.26 the official `image`, `highlight`, and `inlineMath`/`blockMath` extensions already ship `renderMarkdown`/`parseMarkdown`, so highlight (`==..==`) and math (`$..$`, `$$..$$`) round-trip unchanged. Custom work: (1) `GetWriteImage.renderMarkdown` emits an inline-HTML `<img data-resource-id>` fallback when a `resourceId` is present (clean `![]()` otherwise), restored on parse via the attribute's `parseHTML`; (2) `unescapeWikiLinkBrackets` in `WikiLinkDecoration.ts` keeps wiki links literal (`[[Target]]`) in exported Markdown. Tests in `tests/unit/markdown-custom-nodes.test.ts` (7). Two deliberate scope calls in `follow-up-work.md`: `paragraphLeading` (line-height) is presentational and not preserved in Markdown; text color (`textStyle`) is out of this task's done-condition and left for Task 4.

---

### Task 4: Unrepresentable-construct detection and warning payload

**What:** Produce a structured list of which constructs fell back to inline HTML during a given serialization, for surfacing to the user.
**Files:** `frontend/src/lib/export/markdown-serializer.ts`, `frontend/src/lib/export/types.ts`
**Done when:** A unit test serializing a document with a wiki link and a math node returns Markdown plus a warning list naming exactly those construct types; a document with only GFM-representable content returns an empty warning list.
**Depends on:** 3
**Estimate:** 3
**Notes:** Tiptap's `htmlContainsUnrecognizedTag` util / the HTML-fallback handlers from Task 3 are the detection hooks. Satisfies FR-7; FR-8 aggregation builds on this list.
**Done:** [x] — `collectMarkdownWarnings(doc)` walks the tree and reports a typed `MarkdownConstructWarning[]` (`types.ts`); `serializeMarkdown(doc)` returns `{ markdown, warnings }`; `mergeMarkdownWarnings(lists)` aggregates per-construct counts for the Task 8 compile case. Detected constructs: `image-link` (html-fallback), `paragraph-leading` and `text-style` (dropped). Tests in `tests/unit/markdown-warnings.test.ts` (6). **Deviation from the done-condition example:** it cited "a wiki link and a math node" as warned, but Task 3 proved wiki links, math, and highlight round-trip cleanly in 3.26 — warning about them would be misleading. The empty-list-for-clean-content half is satisfied as written; the lossy half flags the constructs that are _actually_ lossy. Resolves the text-color / paragraph-leading decisions deferred from Task 3 as drop-and-warn (presentational, content preserved). See `follow-up-work.md`.

---

### Task 5: Editor source/rich Markdown toggle

**What:** Add a toggle that switches a text resource between the rich-text editor and a raw Markdown source view, converting content at the boundary.
**Files:** `frontend/components/TipTapEditor.tsx`, `frontend/components/Editor/MenuBar/MenuBar.tsx` (+ a new source-view subcomponent under `components/Editor/`), matching `*.stories.tsx`
**Done when:** Toggling to source shows GFM for the current content; editing it and toggling back renders the edited structure; the resource ID, sidecar metadata, canonical revision, and autosave-on-blur behavior are unchanged (verified by existing editor tests still passing plus a new toggle test).
**Depends on:** 2, 3
**Estimate:** 5
**Notes:** Satisfies FR-1, FR-2, FR-3. Conversion happens only at the toggle boundary (non-goal: no per-keystroke sync). Add a Storybook story per `docs/standards/storybook-implementation.md`.
**Done:** [x] — `TipTapEditor` now owns a `mode` (`"rich"`/`"source"`) + `sourceText` state. Toggling to source serializes the live document via `documentToMarkdown(editor.getJSON())` (Task 2 serializer, now also used client-side); toggling back parses with `markdownToDocument`, `setContent`s the result, and emits `onChange` exactly as `onUpdate` does so autosave/canonical-revision behavior is unchanged. The editor instance stays mounted across the toggle (only `EditorContent` swaps for the source view), so resource ID / sidecar / revision wiring is untouched. New presentational `components/Editor/MarkdownSourceView.tsx` (textarea + "Rich text" toggle-back button); `MenuBar` gained an optional `onToggleSource` prop rendering an "Edit as Markdown" toolbar button (hidden when readonly or when the prop is omitted — existing usages unaffected). Added a `markdown` toolbar icon. An external `value` change (resource/revision switch) resets `mode` to rich. Storybook: `stories/Editor/MarkdownSourceView.stories.tsx` (Default/Empty/Interactive). **Deviation from the done-condition:** a full live-editor toggle test is not feasible in the unit suite — `TipTapEditor` short-circuits to a deterministic mock under Vitest (`inTestEnv`) and never mounts ProseMirror, so there is no real editor to drive. Behavior is instead covered by (a) `tests/markdownSourceToggle.test.tsx` against `MarkdownSourceView` (shows source, reports edits, toggles back) and (b) boundary round-trip assertions over the exact serializer functions the toggle calls (edited GFM → document structure; document → GFM). Existing editor/MenuBar tests (65) still pass; typecheck/lint(my files)/build green. See `follow-up-work.md`.

---

### Task 6: Single-resource Markdown export (`.md`)

**What:** Add Markdown as an output of the single-resource export flow, producing a valid `.md` file.
**Files:** `frontend/app/api/export/text/route.ts` (or new `app/api/export/markdown/route.ts`), `frontend/components/common/ExportPreviewModal.tsx` and its export caller, `frontend/src/lib/export/markdown-serializer.ts`
**Done when:** Exporting a text resource yields a `.md` file whose content matches the serializer output, with the Task 4 warning surfaced when HTML fallback occurred.
**Depends on:** 3, 4
**Estimate:** 3
**Notes:** Satisfies FR-5 and FR-7. The current `export/text` route has no callers; confirm the actual single-resource export trigger before wiring (TBD which caller invokes `onConfirmExport`).
**Done:** [x] — **Resolved the TBD:** the live export flow is entirely client-side in `app/page.tsx` (`handleResourceAction` "export" case); the `export/text` route is dead. Markdown needs the TipTap JSON (not the cached plaintext), so it goes through a new server route. Added: `app/api/export/markdown/route.ts` (loads docs, returns `{markdown, filename, warnings}`); shared `src/lib/export/compile-markdown.ts` (`compileToMarkdown`, reused by Task 7); `src/lib/api/export.ts` (`exportMarkdown` client helper). Wired a Text/Markdown selector into `ExportPreviewModal` (via `ConfirmDialog.details`), threaded `format` through `ShellModalCoordinator` → `AppShell` → `page.tsx`, where the md branch downloads `.md` and surfaces aggregated warnings via a toast. Route tests in `tests/unit/export-markdown-route.test.ts` (3). `txt` remains the default (existing behavior unchanged).

---

### Task 7: `compile/markdown` API route

**What:** Add a compile route that serializes an ordered selection of text resources into one `.md` file, reusing the existing per-section header handling.
**Files:** `frontend/app/api/compile/markdown/route.ts` (new), `frontend/src/lib/export/compile-text.ts` (extract/share header logic) or new `compile-markdown.ts`
**Done when:** POSTing a `CompileBody` of multiple text resources returns one `.md` string with each section's header and Markdown body in the requested order, plus an aggregated warning list; a route test asserts ordering and headers.
**Depends on:** 3, 4
**Estimate:** 3
**Notes:** Satisfies FR-6. Mirror `app/api/compile/text/route.ts`, swapping plain-text concatenation for per-resource Markdown serialization; reuse `loadResourceContent` to get TipTap JSON.
**Done:** [x] — Added `app/api/compile/markdown/route.ts`, mirroring `compile/text/route.ts` (same `CompileBody` shape, `resourceMap` lookup, text-only filter in requested order) but loading each resource's TipTap JSON via `loadResourceContent` and delegating to the shared `compileToMarkdown` (`src/lib/export/compile-markdown.ts`, built in Task 6 — per-section `# <name>` headers gated on `includeHeaders`, sections joined by two blank lines, warnings aggregated via `mergeMarkdownWarnings`). Returns `{ markdown, filename: slugify(projectName)+".md", warnings }`. Route tests in `tests/unit/compile-markdown-route.test.ts` (3): multi-resource ordering + headers + empty warnings; header omission when `includeHeaders` is false; cross-section warning aggregation (count 2) with non-text resources filtered out. The compile route honors the caller-supplied `includeHeaders` (unlike export, which derives it from selection size).

---

### Task 8: Compile modal Markdown option and aggregated warnings

**What:** Add `md` to the compile format selector and display the aggregated unrepresentable-construct warning.
**Files:** `frontend/components/common/CompilePreviewModal.tsx`, `frontend/components/common/compileSelection.ts`, matching `*.stories.tsx`
**Done when:** Selecting `md` calls `compile/markdown`, downloads a `<project>.md` file, and shows a warning listing constructs that fell back to HTML across the included resources; existing txt/pdf/docx options are unchanged.
**Depends on:** 7
**Estimate:** 2
**Notes:** Satisfies FR-6, FR-8. Format union is at `CompilePreviewModal.tsx:20` (`"txt" | "pdf" | "docx"`) — extend to include `"md"`.
**Done:** [x] — Extended the format union to a shared `CompileFormat = "txt" | "md" | "pdf" | "docx"` in `CompilePreviewModal.tsx` and added an `md` option to the "Compile as" selector. Added `compileMarkdown` (+ `MarkdownCompileResult`) to `src/lib/api/compile.ts`, calling the Task 7 `/api/compile/markdown` route. **Deviation from the listed Files:** the actual format dispatch/download lives in the two `onConfirmCompile` callers (`AppShell.tsx` and `StartPage.tsx`), not in `compileSelection.ts` (which only handles tree selection, no format) — so the `md` branch (download `<name>.md` + aggregated-warning `toastService.info`, mirroring the single-resource export toast) was wired in both. Existing txt/pdf/docx paths untouched. Test added to `tests/compilePreviewModal.test.tsx` (selector exposes `md` and reports `format: "md"` on confirm). No `*.stories.tsx` change — `CompilePreviewModal` has no story file.

---

### Task 9: Round-trip and export/compile test coverage

**What:** Consolidate fidelity, warning, and route tests for the Markdown paths.
**Files:** `frontend/tests/` (extend existing export/editor test files where present)
**Done when:** Tests cover round trip of all FR-4 constructs, HTML-fallback + warning for non-representable constructs, single-resource export output, and multi-resource compile ordering/headers — all green under `pnpm test:ci`.
**Depends on:** 3, 4, 5, 6, 7, 8
**Estimate:** 3
**Notes:** Prefer extending existing test files per CLAUDE.md/testing standards rather than creating new ones.
**Done:** [x] — **Largely an audit/consolidation pass: the four done-conditions were already covered by tests written incrementally in Tasks 2–8** — FR-4 round trip (`tests/unit/markdown-serializer.test.ts`), HTML-fallback + warning (`markdown-warnings.test.ts` + `markdown-custom-nodes.test.ts`), single-resource export output (`export-markdown-route.test.ts`), and multi-resource compile ordering/headers (`compile-markdown-route.test.ts`). Net-new this task: extended `markdown-serializer.test.ts` with an `it.each` **FR-4 per-construct round-trip** block (heading, bold, italic, blockquote, unordered list, ordered list, code block, inline code, link, GFM table — 10 cases) so a fidelity regression names the _specific_ construct that broke instead of failing as one opaque `toEqual` diff over the whole sample doc, and each case asserts the construct actually parsed into the schema (not swallowed into plain text). No new test file created (per the extend-don't-create note). All 6 Markdown suites green (37 tests). `pnpm test:ci`: 2043 passed / 1 skipped, with the lone failure being the **documented pre-existing parallel-worker temp-dir teardown flake** in `tests/unit/media-file-route.test.ts` (`ENOTEMPTY` on rmdir — see Task 3 follow-up item 3), confirmed passing 5/5 in isolation and unrelated to the Markdown work. typecheck clean; eslint clean on the changed file.

---

## Summary

- Total tasks: 9
- Total estimated effort: 30 story points
- Critical path: Tasks 1 → 2 → 3 → 4 → 7 → 8 → 9 (22 points)
- Risks:
  - **Task 1** — the 3.23→3.26 Tiptap bump can surface breaking changes across StarterKit and the custom extensions; it gates everything else.
  - **Task 3** — round-trip fidelity for custom nodes (wiki links, math, leading paragraphs) is the core technical risk; HTML fallback must be lossless and reversible.
  - **Task 6** — the single-resource export trigger is not currently wired to the `export/text` route (no callers found); the real entry point must be confirmed before implementation.
