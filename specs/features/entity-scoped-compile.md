# Feature: Entity-scoped compile

## Overview

A writer tracking a character, place, or other declared entity across a large
project today can only see that entity's associations one resource at a time
— the entity panel's mentions list, or following backlinks. This feature adds
a compile action, reachable from the entity's own panel, that assembles every
resource associated with the entity — both detected prose mentions and
explicit links — into a single ordered document, so the writer can read that
entity's whole thread as one continuous consistency-check pass instead of
navigating association-by-association. It reuses the existing compile
renderers and mention/backlink retrieval; the only genuinely new work is the
bridge that orders the entity's resource set the way the rest of compile
already orders a subtree.

## Goals

- A writer can trigger, from a declared entity's own panel, a compile of
  every resource that entity is linked from or detected as mentioned in.
- The compiled resource set is never narrower than what the entity panel's
  own mentions list already shows for that entity.
- The compiled output orders resources by resource-tree position
  (depth-first, siblings by `orderIndex`), matching the ordering convention
  subtree compile already uses.
- The action works identically on web/desktop and native Android, with no
  platform-specific gap.
- Entity-scoped compile never writes to a revision, an entity declaration,
  or the mention index.

## Non-goals

- This feature does not change how mentions or backlinks are detected,
  indexed, or persisted (`mention-index.ts`, `backlinks.ts` are untouched).
- This feature does not add a way to reorder, include, or exclude individual
  resources from the compiled set before running it — the set is computed,
  not user-picked (contrast with FR-14's subtree compile, which is a
  user-picked checkbox tree).
- This feature does not add a new per-project feature flag; it rides the
  existing `entities` flag.
- This feature does not change the four existing compile renderers
  (`compilePdfCore` / `compileDocxCore` / `compileTextCore` /
  `compileMarkdownCore`) or their output formatting beyond supplying an
  ordered resource-id list.
- This feature does not add pagination, streaming, or a resource-count cap
  to the compile pipeline beyond what subtree compile already has (none).

## User stories

- US-1: As a novelist tracking a character across a large project, I want to
  compile every resource associated with that character into one document,
  so that I can read their whole thread as a continuous pass without
  following mention links one at a time.

## Functional requirements

FR-1: Users MUST be able to trigger a compile of the currently-selected declared entity's associated resources from the entity's own panel (`EntityMentionsSection.tsx`, the section that renders only when the selected resource has `entityKind` set), reachable only when the project's `entities` feature flag is enabled. The triggering UI MUST reuse `CompilePreviewModal.tsx`'s existing output-option controls (format `Select`, headers checkbox, name input) and MUST replace its user-editable checkbox selection tree with the FR-11 read-only ordered resource list; whether this is implemented as a new component or a prop-driven mode within the existing modal is an implementation choice, not a spec-level one. [US-1]

FR-2: The resource set compiled MUST be exactly the merged set `mentions-core.ts`'s `getEntityMentionedIn` returns for the selected entity — every resource with `isLinked` and/or `isMentioned` true — with no narrowing or additional filtering beyond what that function already applies. The compiled output does not distinguish, by badge or otherwise, which included resources came from an explicit link versus a detected mention; that signal remains available in the entity panel this compile is triggered from. [US-1]

FR-3: The compiled resources MUST be ordered by resource-tree position: a depth-first walk of the full resource tree with siblings ordered by `orderIndex`, filtered to only the resource ids in the FR-2 merged set. This ordering MUST be computed by walking the project's resource tree and filtering the walk's output to the merged set — it MUST NOT rely on the merged set's own return order (`getEntityMentionedIn`'s array order reflects mention-index and backlink-map iteration order, not tree position, and is not a valid substitute). [US-1]

FR-4: The ordering logic in FR-3 MUST be implemented in a transport-agnostic module with no platform-specific (DOM- or Node-`fs`-specific) dependency, so the same ordering result is produced whether the compile is initiated on web/desktop or native Android. [US-1]

FR-5: Once the ordered resource-id list is computed, entity-scoped compile MUST reuse the existing `compilePdf` / `compileDocx` / `compileText` / `compileMarkdown` client functions and the existing `CompileBody` shape (`projectId`, `resourceIds`, `resources`, `includeHeaders`, `projectName`) unchanged, so no new compile renderer, HTTP route, or native transport backend is introduced. [US-1]

FR-6: Users MUST be able to choose the compiled output format (PDF, DOCX, Markdown, or plain text), whether to include headers, and the compilation name before running an entity-scoped compile, using the same format `Select`, headers checkbox, and name `input` controls the FR-1 UI reuses unchanged from `CompilePreviewModal.tsx`. [US-1]

FR-7: Entity-scoped compile MUST NOT impose any resource-count cap, threshold, or advisory warning on the size of the FR-2 merged set — it inherits the existing compile pipeline's standing no-cap behavior, consistent with the product spec's decision that no performance budget is measured in this product. The FR-11 read-only ordered list already discloses the resource count to the writer before they confirm, which is what makes the absence of a separate warning acceptable here — that visibility is a consequence of the FR-1/FR-11 UI, not an additional safeguard built for this purpose. When the FR-2 merged set is empty (the entity has neither a detected mention nor an explicit link anywhere in the project), the compile action MUST be either disabled or MUST produce a clear, non-error empty-result message — it MUST NOT silently produce and download an empty or malformed file. [US-1]

FR-8: Entity-scoped compile MUST NOT write to any resource's revisions, to the entity's own or any other sidecar/entity declaration, or to the mention index (`meta/index/mentions.json`) — it is export-only, consistent with the existing compile constraint (FR-14). [US-1]

FR-9: The entity-scoped compile trigger MUST be operable by keyboard alone and MUST expose an accessible name and role consistent with this codebase's existing button/modal accessibility conventions, per the project's WCAG 2.1 AA target. [US-1]

FR-10: Entity-scoped compile MUST function identically on native Android and on web/desktop, reusing the existing native-parity retrieval (`lib/api/mentions.ts` / `native-mentions-backend.ts`) and render (`lib/api/compile.ts` / `native-compile-backend.ts`) transports without introducing any new native-specific gap. [US-1]

FR-11: The FR-1 UI MUST render a read-only list of the FR-3 ordered resource set before the writer confirms the compile, and that list MUST make the resource count visible and MUST visually mark any entry whose resource type is not `"text"` (e.g. image, audio) as excluded from the compiled output — since `loadTextSections` (`frontend/src/lib/export/section-loader.ts`) silently drops non-text resources from what it returns to the compile pipeline. This list is the writer's only point of contact for noticing such an exclusion, since — unlike subtree compile, where the writer picked the resources themselves — the entity-scoped set is computed. [US-1]

## Open questions

None. All four open questions raised while drafting this spec (UI shape,
link-vs-mention distinction in output, large result sets, and non-text
resources) were resolved at the Gate 3 review and folded into the
requirements above — FR-1, FR-2, FR-6, FR-7, and FR-11.

## Out of scope (deferred)

- Reordering, including, or excluding individual resources from an
  entity-scoped compile's computed set before running it.
- A resource-count cap, pagination, or progress indicator for very large
  entity-associated sets — entity-scoped compile inherits the existing
  compile pipeline's no-cap behavior (FR-7).
- Any visual distinction in the compiled output between linked and
  mentioned resources — the compiled output does not mark this distinction
  (FR-2).
- Compiling more than one entity's thread into a single document in one
  action.
- `loadTextSections` silently dropping non-text resources from a compiled
  set's actual output (as opposed to their exclusion being visible in the
  FR-11 read-only list beforehand). This is pre-existing, shared behavior
  that already affects the shipped subtree compile — it is not introduced
  by this feature, and a fix to `section-loader.ts` is out of scope here
  and tracked separately against subtree compile.
