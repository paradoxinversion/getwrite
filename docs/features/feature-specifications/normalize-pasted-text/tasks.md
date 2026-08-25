# Normalize Pasted Text — Implementation Tasks

---

### Task 1: Write pure normalization function with full test coverage

**What:** A pure `normalizePastedHTML(html: string, bodyFontSize?: string): string` function that implements all paste-normalization rules before TipTap parses the HTML.

**Files:**

- `frontend/components/Editor/Extensions/NormalizePastedHTML.ts` (create)
- `frontend/tests/normalizePastedHTML.test.ts` (create)

**Done when:**

- Function strips `font-family` from all inline styles (FR1)
- Function replaces `font-size` with `bodyFontSize` when provided, strips it when not (FR2)
- Function strips `background-color` from all inline styles (FR3)
- Function removes `font-size`, `font-family`, `font-weight`, `letter-spacing`, and `color` from the `style` attribute of `h1`–`h6` elements (FR4)
- Function returns HTML unchanged when `data-pm-slice` is present (FR5)
- Bold, italic, underline, links, lists, blockquotes, code blocks remain in the output (FR6)
- All behaviors have passing unit tests via `pnpm test:ci`

**Depends on:** none

**Estimate:** 2 story points

**Notes:** Use the existing `stripExternalColor` implementation in `StripExternalPasteColor.ts` as a reference — the same DOMParser + `style.removeProperty` pattern applies. Keep the new function in its own file so it stays unit-testable without the TipTap extension lifecycle. For FR4, target `h1, h2, h3, h4, h5, h6` via `querySelectorAll` and strip the named properties individually (not the whole `style` attribute) to avoid clobbering other valid styles that may appear on those elements.

**Done:** [x]

---

### Task 2: Create configurable `NormalizePastedText` TipTap extension

**What:** A TipTap extension that wraps `normalizePastedHTML` and exposes a `bodyFontSize` option so it can be configured at runtime with the editor's body font size.

**Files:**

- `frontend/components/Editor/Extensions/NormalizePastedText.ts` (create)

**Done when:**

- Extension is named `"normalizePastedText"`
- `transformPastedHTML` calls `normalizePastedHTML(html, this.options.bodyFontSize)`
- `bodyFontSize` option defaults to `undefined`
- TypeScript compiles without errors (`pnpm typecheck`)

**Depends on:** Task 1

**Estimate:** 1 story point

**Notes:** Follow the `StripExternalPasteColor` pattern — `Extension.create` with a `transformPastedHTML` hook. Add an `addOptions()` block that declares `bodyFontSize: string | undefined`.

**Done:** [x]

---

### Task 3: Wire `NormalizePastedText` into TipTapEditor and retire `StripExternalPasteColor`

**What:** Replace the static `StripExternalPasteColor` extension with `NormalizePastedText` in `TipTapEditor`, passing the body font size from the editor project config.

**Files:**

- `frontend/components/TipTapEditor.tsx` (modify)

**Done when:**

- `StripExternalPasteColor` is removed from the static `extensions` array and its import is removed
- `NormalizePastedText.configure({ bodyFontSize: editorProjectConfig.body?.fontSize })` is added to the `useEditor` extensions list alongside `CustomHeading`
- Pasting external text into the editor strips font-family, normalizes font-size, strips background-color, and strips heading inline styles
- Internal paste (from within GetWrite) is unaffected
- `pnpm typecheck` and `pnpm test:ci` pass

**Depends on:** Task 2

**Estimate:** 1 story point

**Notes:** `StripExternalPasteColor.ts` itself can remain on disk (its export is still used by the existing test suite); only its usage in `TipTapEditor.tsx` should be removed. If no other file imports `StripExternalPasteColor`, the file may be deleted — verify with a project-wide grep before removing.

**Done:** [x]

---

## Summary

- **Total tasks:** 3
- **Total estimated effort:** 4 story points
- **Critical path:** Tasks 1 → 2 → 3 (fully sequential; each task is a prerequisite for the next)
- **Risks:**
  - **Task 1 / FR2 (font-size replacement):** Edge case when `bodyFontSize` is `undefined` — decide whether to strip or leave the property unchanged. The spec says "convert … to the editor's configured default body font size"; if no config is present, stripping is the safer fallback. Verify this is acceptable.
  - **Task 1 / FR4 (heading styles):** Stripping inline heading styles only works correctly because `CustomHeading.renderHTML` re-applies styles from config on render. If `CustomHeading` is ever bypassed (e.g. read-only mode or SSR), stripped headings will be unstyled. Low risk given current architecture, but worth noting.
