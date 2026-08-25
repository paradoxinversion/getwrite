# Feature Spec: Node Display

## Overview

The GetWrite editor gives no visible signal of what kind of node the cursor
currently occupies (body paragraph, heading, list item, etc.). When node types
change unexpectedly — for example, heading nodes silently downgrading to body
after a style change — writers have no way to notice at a glance. This feature
adds a node-type indicator to the editor footer, beside the word count, that
reflects the node at the current cursor position and updates as the cursor
moves.

## Goals

- Writers can read the current node's type from the editor footer without
  leaving the document.
- The indicator updates within one frame of the cursor moving to a different
  node.
- Unexpected node-type changes (e.g. heading → body) become visible
  immediately.
- Selections that span multiple node types are represented coherently in the
  indicator.
- The indicator is unobtrusive and consistent with the existing footer styling.

## Non-goals

- Allowing the user to _change_ node type from this indicator (read-only
  display).
- Displaying inline mark formatting (bold, italic, links) — node type only.
- Surfacing node type in non-editor views (DataView, Organizer, Timeline).

## User stories

- As a writer, I want to see the current node's type in the footer so that I
  can confirm my cursor is in the heading/list/body I expect.
- As a writer, I want the indicator to update as I move the cursor so that I
  always see the node I'm actually editing.
- As a writer, I want a clear signal when a node changed type unexpectedly so
  that I can catch silent formatting regressions.

## Functional requirements

1. The editor footer **must** display a node-type indicator alongside the
   existing word count.
2. The indicator **must** reflect the node type at the current cursor position
   (e.g. Body, Heading, Bullet List, Ordered List, Blockquote, Code Block).
3. The indicator **must** update when the selection changes to a node of a
   different type.
4. Heading labels **must** include the heading level (e.g. "Heading 1",
   "Heading 2"), so that a heading silently changing level or downgrading to
   body is visible.
5. When a selection spans more than one distinct node type, the indicator
   **must** list every distinct type (e.g. "Heading 2, Body"). The displayed
   list **must** truncate past a defined length, and the full, expanded list
   **must** be available on hover via a tooltip.
6. When no resource is open, or the editor is unfocused with no cursor
   position, the indicator **must** render a neutral placeholder (e.g. "—")
   rather than a stale value.
7. The indicator **should** use the same typographic and color tokens as the
   surrounding footer text, and **must not** use red (reserved for
   canonical/position state).
8. The indicator label **must** be human-readable, not a raw TipTap node name
   (e.g. "Heading 2", not `heading`).

## Open questions

None identified.

## Out of scope (deferred)

- Click-to-change node type from the indicator.
- Showing nesting depth/breadcrumb (e.g. "List item › Body").
- Per-node-type icons.
