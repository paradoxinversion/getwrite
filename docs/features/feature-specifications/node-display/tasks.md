# Implementation Tasks: Node Display

Derived from `docs/features/feature-specifications/node-display/spec.md`.
Granularity: story points (1/2/3/5/8).

Architecture context (verified against the codebase):

- The `editor` instance is encapsulated inside
  `frontend/components/TipTapEditor.tsx`; it is **not** exposed to its parent.
  It currently emits only `onChange(html, doc)` from `onUpdate`, which fires on
  content changes — **not** on selection moves. Tracking the node under the
  cursor therefore requires a new selection hook (`onSelectionUpdate` /
  `onTransaction`) and a new callback prop to lift the result up.
- The footer lives in `frontend/components/WorkArea/EditView.tsx:333`, rendering
  `Words: {wordCount}` on the left. The indicator slots in beside it.
- Headings use `CustomHeading` (StarterKit `heading` disabled); paragraphs are
  the "Body" node. Lists/blockquote/codeBlock are registered explicitly in the
  shared `extensions` array.
- Existing lib utilities live in `frontend/src/lib/` (`tiptap-utils.ts`,
  `tiptap-text.ts`, `word-count.ts`). No reusable generic `Tooltip` component
  exists in `components/common`.

---

### Task 1: Node-type label derivation utility

**What:** A pure function that maps a ProseMirror/TipTap selection to an ordered
list of distinct human-readable node-type labels.
**Files:** `frontend/src/lib/node-display.ts` (new);
`frontend/tests/node-display.test.ts` (new).
**Done when:** `deriveNodeTypeLabels(selection)` (or equivalent signature taking
the data it needs) returns `["Heading 2"]` for a caret in an H2, `["Body"]` for
a paragraph, and `["Heading 2", "Body"]` (distinct, in document order) for a
selection spanning both; unit tests cover Body, Heading 1–6, Bullet List,
Ordered List, Blockquote, Code Block, multi-type selections, and an empty/no-doc
input returning `[]`. All tests pass under `pnpm test:ci`.
**Depends on:** none
**Estimate:** 3
**Status:** ✅ Done — `node-display.ts` + `node-display.test.ts` (18 tests passing).
**Notes:** Map raw node names → labels: `paragraph`→"Body", `heading`→`Heading ${attrs.level}`,
`bulletList`→"Bullet List", `orderedList`→"Ordered List", `blockquote`→"Blockquote",
`codeBlock`→"Code Block". Keep the node-name→label table here so it is the single
source of truth (satisfies FR-4, FR-8). Iterate the selection range with
`doc.nodesBetween` to collect distinct block types in order. No `any`; type
against TipTap/ProseMirror types per `docs/standards/typescript-implementation.md`.

### Task 2: NodeTypeIndicator presentational component

**What:** A read-only component that renders a list of node-type labels with
overflow truncation, a hover tooltip showing the full list, and a neutral
placeholder when given none.
**Files:** `frontend/components/WorkArea/NodeTypeIndicator.tsx` (new);
`frontend/components/WorkArea/NodeTypeIndicator.stories.tsx` (new).
**Done when:** Given `types={["Heading 2"]}` it renders "Heading 2"; given
multiple types it renders a comma-joined list truncated past a defined length
with the full list available on hover; given `types={[]}` it renders the neutral
placeholder "—"; Storybook stories exist for single, multi (untruncated),
multi (truncated), and empty states; the component uses footer typography/color
tokens and uses no red. `pnpm storybook` renders all four stories and a11y
addon reports no violations.
**Depends on:** none
**Estimate:** 3
**Status:** ✅ Done — `NodeTypeIndicator.tsx` + `NodeTypeIndicator.stories.tsx` (4 stories) + `nodeTypeIndicator.test.tsx` (6 tests passing). Tooltip uses `react-tooltip` (the project's standard, as in `Chip`/`MenuBar`) with the branded `TOOLTIP_STYLE`; anchored via `data-tooltip-id`/`data-tooltip-content` plus an `aria-label` carrying the full list for assistive tech. (Initially shipped with a native `title` — switched to `react-tooltip` for consistency after review.) All 4 stories render cleanly in Chromium via the Storybook vitest runner. A11y: only finding is a pre-existing footer contrast deficiency shared with the word-count label (`text-gw-secondary` 4.01:1) — accepted at parity, a11y left in `"todo"` mode per 2026-06-12 decision. Logged in `follow-up-work.md`.
**Notes:** Takes `types: string[]` directly — independent of Task 1 so it can be
built in parallel. Satisfies FR-5 (truncation + tooltip), FR-6 (placeholder),
FR-7 (tokens, no red). For the tooltip, prefer a native `title` attribute for
v1 unless a designed tooltip is requested (no reusable Tooltip exists today);
note this assumption. Follow the `getwrite-component` standards.

### Task 3: Emit current node types from TipTapEditor

**What:** Add selection tracking inside `TipTapEditor` that computes the current
distinct node-type labels and surfaces them via a new optional callback prop.
**Files:** `frontend/components/TipTapEditor.tsx`.
**Done when:** `TipTapEditor` accepts an optional
`onNodeTypesChange?: (labels: string[]) => void` prop; an `onSelectionUpdate`
(and `onCreate`) handler calls it with the output of the Task 1 utility whenever
the selection changes node context; the callback fires with the correct labels
when the caret moves between a heading and a paragraph (verified manually or in
a test). `pnpm typecheck` and `pnpm lint` pass.
**Depends on:** 1
**Estimate:** 3
**Status:** ✅ Done — adapter `node-display-selection.ts` (`nodeAncestriesFromSelection` + `deriveSelectionNodeLabels`) + `node-display-selection.test.ts` (9 tests, real ProseMirror docs). `TipTapEditor` gained `onNodeTypesChange?`, a change-guarded `emitNodeTypes`, wired into `onSelectionUpdate` + `onUpdate` (catches heading→body re-typing) + `onCreate`. typecheck clean; lint clean for new code (one pre-existing `any` warning unrelated). 33 node-display tests pass.
**Notes:** `onUpdate` does not fire on selection-only changes, so use
`onSelectionUpdate`/`onTransaction`. `shouldRerenderOnTransaction` is already
true. Emit on `onCreate` too so the initial position is populated. Satisfies
FR-2, FR-3. Avoid redundant emits (only call when the label list actually
changes) to honor the one-frame update goal without churn.

### Task 4: Wire the indicator into the EditView footer

**What:** Hold the current node-type labels in `EditView` state, fed by
`TipTapEditor`'s callback, and render `NodeTypeIndicator` beside the word count.
**Files:** `frontend/components/WorkArea/EditView.tsx`.
**Done when:** The footer renders the `NodeTypeIndicator` next to
`Words: {wordCount}`; moving the cursor between a heading and body in a running
dev session updates the indicator; with no resource open the indicator shows the
"—" placeholder; `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.
**Depends on:** 2, 3
**Estimate:** 2
**Status:** ✅ Done — `EditView` holds `nodeTypes` state (init `[]`), passes `onNodeTypesChange={setNodeTypes}`, and renders `<NodeTypeIndicator>` beside `Words:` (separated by the header-style `|`). typecheck, lint (only pre-existing `any` warning), and `pnpm build` all pass; 37 tests pass (EditView + node-display suites).
**Notes:** Pass `onNodeTypesChange` into the existing `TipTapEditor` instance at
`EditView.tsx:325`; store labels in local React state initialized to `[]` so the
empty state is the default (FR-1, FR-6). **Deviation from the original hint:**
instead of resetting `EditView` state to `[]` on resource change, the freshness
is handled deterministically _inside_ `TipTapEditor` — its `value`-sync effect
now resets the change-guard and re-emits after `setContent`, so a resource/
revision switch repopulates the indicator with the newly loaded document's
cursor node rather than blanking to the placeholder. This both avoids stale
values and avoids a change-guard desync where two consecutive resources sharing
a first node type would have stuck the indicator on `—`.

### Task 5: Integration test for footer node display

**What:** A test asserting the footer reflects the node type at the cursor and
the placeholder/multi-type behaviors.
**Files:** `frontend/tests/EditView.node-display.test.tsx` (new) and/or an
`e2e/` Playwright spec.
**Done when:** A test verifies the indicator renders the expected label for a
known cursor position, shows "—" when empty, and lists multiple types for a
spanning selection; the test passes in `pnpm test:ci` (or `pnpm test:e2e`
against Storybook if implemented as e2e).
**Depends on:** 4
**Estimate:** 2
**Status:** ✅ Done — implemented as a Playwright spec `e2e/node-display.e2e.spec.ts` (3 tests, all passing against the real editor on the `workarea-editview--default` story): caret-in-heading → "Heading 2", caret-in-paragraph → "Body", select-all spanning → "Heading 2, Body". A `data-testid="node-type-indicator"` was added to `NodeTypeIndicator` for a precise footer assertion. The empty "—" placeholder is covered by the unit test (`nodeTypeIndicator.test.tsx`) rather than e2e, since a loaded editor always has a live selection (no natural placeholder state in the live story).
**Notes:** `TipTapEditor` renders a lightweight mock under Vitest/jsdom (no real
ProseMirror), so caret-driven assertions belong in Playwright/e2e or against the
`NodeTypeIndicator` directly; unit-level coverage of the label logic is already
in Task 1. Scope this test to the integration seam not covered elsewhere.

---

## Summary

- Total tasks: 5
- Total estimated effort: 13 points
- Critical path: Tasks 1 → 3 → 4 → 5 (Task 2 runs in parallel and joins at 4)
- Risks:
  - **Task 3** is the highest-uncertainty task: selection-update wiring inside
    an encapsulated editor that today only emits on content change. Verify
    `onSelectionUpdate` fires as expected and that emits stay cheap enough to
    meet the one-frame update goal.
  - **Task 5** is constrained by the Vitest TipTap mock — meaningful
    caret-driven coverage likely requires Playwright/e2e rather than jsdom.
