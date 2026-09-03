# Feature: Entity highlighting in the editor

## Overview

Writers who declare entities (FR-35) currently see them called out only in
sidebar panels or search results. This feature adds a toggleable working mode
that visually marks every declared entity's name and alias inline, in the
editor, as the writer reads or drafts a passage — so which entities are
present is apparent at a glance. The highlight is a view-layer decoration
only: it never reads or writes persisted resource content, and it never
changes what content is saved.

## Goals

- A writer can turn entity highlighting on or off for a project, and the
  choice persists across sessions.
- Every occurrence of a declared entity's name or alias in the visible editor
  text is visually marked while the mode is on, using the same match rules
  already used for mention detection.
- Highlighting works fully offline and deterministically on desktop, web, and
  the native Android build.
- Turning highlighting on or off, or editing entity declarations, never
  alters `content.txt`, `content.tiptap.json`, or any index file.

## Non-goals

- This feature does not add any new way to declare an entity or an alias
  (FR-35's sidecar mechanism is unchanged).
- This feature does not change how mentions are indexed, persisted, or
  queried (`meta/index/mentions.json` and `mentions-core.ts` are untouched).
- This feature does not change backlinks computation or persistence.
- This feature does not perform pronoun or coreference resolution — only
  literal name/alias matches (plus possessive and simple-plural forms) are
  highlighted.
- This feature does not add a way to jump from a highlight to the entity's
  resource, filter by entity, or otherwise act on a highlight; it is a
  read-only visual cue.

## User stories

- US-1: As a writer, I want to see every entity present in a scene marked
  inline as I read or draft it, so that I can tell who and what is in a
  passage without opening a sidebar panel or running a search.

## Functional requirements

FR-1: Users MUST be able to toggle entity highlighting on or off for the current project via a new optional boolean on `ProjectFeatureFlagsSchema` (`frontend/src/lib/models/schemas.ts`), alongside `entities`, and the toggle state MUST persist per project across sessions and app restarts as part of that schema; it MUST NOT be stored in `editorConfigSlice`. [US-1]

FR-2: While the toggle is on, the editor MUST visually mark every substring in the visible document that matches a declared entity's name or alias, using the same matching rules as `findMentionOffsets` (case-insensitive, word boundary, possessive, and simple-plural forms; no match inside a larger word or across a hyphenated compound). [US-1]

FR-3: The highlight MUST be applied as a view-layer decoration and MUST NOT modify `content.txt`, `content.tiptap.json`, or trigger any write to the resource, its sidecar, or any index file. [US-1]

FR-4: Matching MUST run against the live, unsaved editor document state, not against the persisted mention index, so highlights reflect text the writer has typed but not yet saved. [US-1]

FR-5: Highlighting MUST update to reflect edits to the document (text changes) and edits to entity declarations (an entity's name, aliases, or existence changing) without requiring a manual refresh or reload of the resource. [US-1]

FR-6: Highlighting MUST function fully offline, without any network request, consistent with the local-first architecture, and MUST have a working implementation on the native Android build with parity to the web/desktop behavior (no highlighting-specific feature gap on native). [US-1]

FR-7: The highlight styling MUST NOT use the color token reserved for position/canonical-state indicators (`#D44040` / `red`), and MUST NOT reduce the editor's line height below its 1.8 minimum. [US-1]

FR-8: Entity highlighting MUST only be reachable and effective when the project's `entities` feature flag (`ProjectFeatureFlagsSchema.entities`) is enabled; the highlighting toggle MUST NOT be exposed or take visual effect when that flag is off. [US-1]

FR-9: A full editor-document scan for highlight decorations, on a resource of representative length for the project's type, MUST complete within a duration that does not produce user-visible input lag on every keystroke. The specific latency threshold is not yet defined and MUST be set from measurement, not invented; see the resolved OQ-1 entry below for the scoped benchmark that sets it. [US-1]

FR-10: While the toggle is on, a highlighted match MUST render in exactly one of two visual states: a plain-match style for a declared name or alias matched unambiguously, and a single shared "needs attention" style for a match that is either (a) an alias `entity-alias-warnings.ts` flags as short or common-word, or (b) a term claimed by more than one entity per `entity-alias-table.ts`'s `claimedBy`. No third visual style MUST be introduced for these two conditions, and neither state MUST use the reserved `red` token (FR-7). [US-1]

FR-11: When a highlighted match is in the "needs attention" state, hovering it (or its `title` attribute, for non-pointer access) MUST disclose which condition applies — short/common-word alias, ambiguous claim, or both — so that the single shared visual treatment does not hide the reason behind it. [US-1]

FR-12: The client MUST refetch the entity alias table on project load, on resource load, and whenever an entity sidecar write resolves in the same client session, and no server-side push signal (e.g. a `metadataRevision`-based counter) is built for this feature. This MUST NOT be relied on to propagate an alias edit made in a second browser tab or window to a first tab's open highlights within the same session — that is an accepted limitation (most relevant to web multi-tab use, since desktop is effectively single-window), not a defect this feature resolves. [US-1]

## Open questions

OQ-1 (resolved): What is the maximum acceptable latency for a full highlight rescan on each keystroke, and at what alias-count/document-length combination should it be measured? No numeric threshold is set by this spec — the threshold MUST come from measurement, not be invented. What is settled is the shape of the benchmark that will produce it: synthetic documents at 50, 200, and 500 declared aliases; document lengths in a representative range of roughly 500 to 5,000 words per resource, anchored on what the shipped project types actually produce — the `article` project type's whole-document `wordCountGoal` of 1,500 words (`article_project_type.json`), and the `novel`/`serial` project types splitting their 80,000-word `wordCountGoal` across many per-scene/per-chapter resources rather than one document, which keeps a single resource's length in the same low-thousands range rather than the whole-project total; and three mitigations profiled against those corpora — a single combined alternation regex, step-map-scoped rescanning of only the changed range, and debouncing. The rung-5 task breakdown MUST carry this benchmark as a measurement task; FR-9's threshold is filled in once it runs. — Impact: FR-9.

OQ-2 (resolved, merges former OQ-2 and OQ-3): Should a short/common-word-flagged alias, or a term claimed by more than one entity, render distinguishably from an unambiguous match? Yes, but as one shared "needs attention" state covering both conditions rather than two distinct styles — three inline visual treatments in running prose was judged too much signal for a reading surface. Which condition applies is discoverable via hover/`title` text, not a third color. The existing non-inline surfaces (`EntitySection.tsx`'s caption text for alias warnings, `EntityMentionsSection.tsx`'s italic ambiguity line) are unchanged; this feature merges the two conditions only for its own inline treatment. — Impact: FR-2, FR-10, FR-11.

OQ-3 (resolved): The toggle lives in `ProjectFeatureFlagsSchema` (`frontend/src/lib/models/schemas.ts`) as a new optional boolean alongside `entities`, not in `editorConfigSlice`. `editorConfigSlice` and its settings modules persist only string-valued typography config today and contain no boolean at all — this would be their first. `ProjectFeatureFlagsSchema` is already six optional booleans, and its `timelineView` flag is a direct precedent: a boolean gating a view/working mode independently of the data fields it depends on. The sibling `specs/features/entity-layer.md` resolved the identical always-on-vs-opt-in question into this same flag family (its FR-16). FR-8's `entities` flag and FR-1's new flag are complementary, not alternatives: FR-8 gates whether the feature is reachable at all; FR-1's flag stores whether it is currently on. — Impact: FR-1, FR-8.

OQ-4 (resolved): The client refetches the entity alias table on project load, on resource load, and whenever an entity sidecar write resolves in the same client (FR-12); no new server-side push signal is built. `sidecar.ts` already computes a `metadataRevision`, but it has no client precedent (only `query-cache.ts` consumes it server-side) and building one for this feature was judged disproportionate. The known limitation this leaves is that a second browser tab or window editing entity aliases concurrently does not propagate to a first tab's open highlights until that tab's next project or resource load — an accepted limitation, not a defect, and most relevant to web multi-tab use since desktop is effectively single-window (FR-12). — Impact: FR-5, FR-12.

Remaining:

None.

## Out of scope (deferred)

- Acting on a highlight (navigating to the entity's resource, filtering the
  view, or opening a mini-panel) — highlighting here is read-only.
- Highlighting entities across revision history rather than the live
  document.
- A user-configurable highlight color per entity or per entity kind.
- Surfacing ambiguous-alias or common-word warnings anywhere outside the
  highlight itself (e.g. a summary count, a dedicated warnings panel).
