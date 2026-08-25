# Feature Spec: Entity Layer

> **Scope note:** this document substantially exceeds the 500-word guideline. The
> feature spans a sidecar schema addition, a new persisted index, an indexer
> path, a query intrinsic, and two UI surfaces. These are not independently
> shippable — the UI surfaces and the query intrinsic have nothing to read until
> the index exists — so they are specified together. It is at the upper bound of
> what should be one spec.

## Overview

GetWrite resolves explicit references between resources — embedded UUIDs,
`[[wiki links]]`, and `resource-ref` metadata fields — into a backlink index,
and `backlinks.ts` already builds resolver maps from every sidecar's `name`,
`slug`, and `aliases`. What it does not do is detect a resource being *named in
ordinary prose*: a scene reading "Aria drew her blade" produces no connection to
the Aria resource unless the writer manually brackets the name. Writers
therefore curate character, place, and object references by hand and lose them
the moment they forget. The entity layer makes a declared class of resources
detectable by name and alias across the whole corpus, so appearance lists,
per-entity mention indexes, and entity-scoped queries are computed rather than
maintained.

## Goals

- A writer declares a resource as an entity with aliases, and every prose
  mention of those aliases across the project is attributed to it without
  manual linking.
- Any resource shows which entities appear in it; any entity shows every
  resource mentioning it, with a text snippet per mention.
- Entity membership is queryable — saved queries and smart folders can filter
  on whether a resource mentions a given entity.
- Mention attribution updates incrementally through the existing
  `indexer-queue` on save, with no full-project rescan per edit.
- Explicit links and detected prose mentions remain distinguishable wherever
  both surface.

## Non-goals

- Discovering entities the writer never declared (NER over prose to invent
  characters, places, or objects).
- Pronoun and coreference resolution ("she", "the older woman") — only
  declared names and aliases are matched.
- Contradiction or continuity checking over entity attributes — a separate
  feature (POS `task_560695da`).
- Story-time or chronology reasoning — a separate feature (POS
  `task_1f33c891`).
- Changing how existing explicit backlinks are computed or persisted.
- Extending `ResourceTypeSchema`; entities are ordinary `text` resources
  distinguished by sidecar metadata (see FR-1).
- Any network- or model-backed inference. Detection MUST run fully offline,
  consistent with the local-first architecture and the native (Android) build,
  which has no server to call.

## User stories

- **US-1:** As a novelist, I want to have every scene that names a character
  attributed to that character automatically, so that my appearance list is
  never stale.
- **US-2:** As a novelist, I want to open an entity page listing every mention
  with its surrounding text, so that I can re-read a character's whole thread
  without running a search.
- **US-3:** As a novelist, I want to build a smart folder for "scenes
  mentioning Aria", so that I can work a POV thread as a unit.
- **US-4:** As a novelist, I want to declare alternate names ("the Duchess",
  "Ari"), so that every form a character is called by resolves to one entity.
- **US-5:** As a novelist, I want to tell a link I deliberately authored apart
  from a mention the system inferred, so that I know what is mine and what is
  derived.

## Functional requirements

1. **FR-1:** A resource MUST be declarable as an entity by an `entityKind`
   value on its sidecar (e.g. `character`, `place`, `object`).
   `ResourceTypeSchema` MUST remain `["text", "image", "audio"]`. [US-1]
2. **FR-2:** An entity's sidecar MUST support an ordered `aliases` array of
   non-empty strings, editable from the UI. `backlinks.ts` already reads this
   key; this requirement makes it a declared, validated part of the schema.
   Validation MUST be structural only — non-empty strings, ordered array — and
   MUST NOT reject an alias at write time for being short or for matching a
   common word, consistent with FR-14's edit-time guarantee. The alias-editing
   UI lives in the entity panel and is reachable only when the project's
   `entities` feature flag (FR-16) is enabled; the schema-level support and
   validation are unaffected by the flag. [US-4]
3. **FR-3:** Detection MUST match an entity's `name` and each alias
   case-insensitively at word boundaries, and MUST additionally match the
   possessive (`Aria's`, `Jones'`) and simple plural (`Aria`/`Arias`) forms. A
   short or common-word alias MUST still be matched under this rule; FR-15
   covers warning the writer rather than restricting matching. [US-1]
4. **FR-4:** Detection MUST NOT match an alias occurring inside a larger word:
   the alias `Ari` MUST NOT match `Aristocrat` or `Arias-Vela`. [US-1]
5. **FR-5:** Detected mentions MUST persist to a mention index under
   `meta/index/`, stored separately from `backlinks.json`, so that an explicit
   reference and a detected mention are never conflated at the data layer.
   [US-5]
6. **FR-6:** Each mention record MUST carry entity id, resource id, occurrence
   count, and the character offset of each occurrence, so that a snippet can be
   rendered without re-tokenizing the resource. `InvertedIndex` MUST remain
   `Record<term, Record<resourceId, count>>` — positions are NOT added to it.
   [US-2]
7. **FR-7:** Saving a resource MUST re-scan only that resource's persisted
   content — read via `loadResourceContent` from the canonical revision, the
   same source `indexer-queue`'s `runTask` and `computeBacklinks` already read
   from — against the current alias table, dispatched through the existing
   `indexer-queue` alongside the inverted-index and backlink updates. Detection
   MUST NOT read unsaved editor state: a mention typed into an unsaved buffer
   is not attributed until the resource is saved. This requirement states no
   corpus size or wall-clock ceiling and is therefore not performance-testable
   as written; a real-corpus measurement would settle what, if any, budget is
   warranted. [US-1]
8. **FR-8:** Editing an entity's `name` or `aliases` MUST re-scan the project
   for that entity alone, and MUST NOT rebuild the whole mention index. As with
   FR-7, no corpus size or wall-clock ceiling is stated; this requirement is
   not performance-testable as written absent a real-corpus measurement. [US-4]
9. **FR-9:** A resource's view MUST list the entities detected in it, each
   navigable to the entity resource. This surface appears only when the
   project's `entities` feature flag (FR-16) is enabled. [US-1]
10. **FR-10:** An entity's view MUST list every resource mentioning it, with
    one snippet per occurrence rendered through the existing `extractSnippet`.
    This surface appears only when the project's `entities` feature flag
    (FR-16) is enabled. [US-2]
11. **FR-11:** A `mentions` intrinsic field MUST be added to
    `INTRINSIC_FIELDS` so that `query-evaluator` and smart folders can filter
    resources by whether they mention a given entity. [US-3]
12. **FR-12:** Wherever explicit links and detected mentions appear in one
    list, the UI MUST distinguish them visually and label which is which.
    [US-5]
13. **FR-13:** `getwrite-cli reindex` MUST rebuild the mention index from
    scratch alongside the inverted index and backlinks. No corpus size or
    wall-clock ceiling is stated for this rebuild, so it is not
    performance-testable as written; it inherits, rather than introduces, the
    whole-file JSON `meta/index/` persistence scheme's known scaling risk,
    already named in the product spec for the adjacent inverted index. A
    real-corpus measurement would settle whether a budget is warranted. [US-1]
14. **FR-14:** When two or more entities claim the same alias, the mention MUST
    be recorded against every claimant and the collision MUST be surfaced to
    the writer as an ambiguity naming each claiming entity. The system MUST NOT
    silently attribute the mention to one of them, and MUST NOT reject the
    alias at edit time. [US-4]
15. **FR-15:** The alias-editing UI MUST surface a non-blocking warning when an
    alias is fewer than three characters or matches a small built-in
    list of common English words and given names that double as ordinary words
    ("May", "Will", "Art"), naming why: the alias will match frequently and add
    noise. This list is fixed and not user-extendable in this feature (see Out
    of scope). FR-9 and FR-10's visible mention counts are the intended
    feedback loop beyond the warning — the writer sees the noise and
    self-corrects. This warning lives inside the entity panel and is
    reachable only when the project's `entities` feature flag (FR-16) is
    enabled. [US-4]
16. **FR-16:** The entity metadata UI — the entity sidebar sections
    (`EntitySection`, `EntitiesMentionedSection`, `EntityMentionsSection`) and
    the resource/entity views listing detected entities and mentions (FR-9,
    FR-10) — MUST be gated behind a per-project `entities` feature flag on
    `ProjectFeatureFlagsSchema`, joining `timeline`, `timelineView`, `pov`,
    `synopsis`, and `notes`. The flag MUST default to disabled — an absent
    flag MUST evaluate to disabled, per `selectIsFeatureEnabled`'s existing
    semantics — and enabling it MUST be a per-project preference set through
    `ProjectFeatureToggles.tsx`, not a global or user-level setting. This flag
    gates the UI only: detection, the mention index, the `indexer-queue`
    wiring, the `mentions` query intrinsic, and `reindex` (FR-3 through FR-8,
    FR-11, FR-13, FR-14) MUST continue to run regardless of the flag's state.
    A project with the flag off still retains any mention index already
    built, and turning the flag on MUST NOT require a reindex or rebuild to
    surface previously computed mentions. [US-1]

## Open questions

Seven design questions were resolved before this spec was saved; the
resolutions are folded into FR-1 through FR-3, FR-4, FR-6 through FR-8, and
FR-13 through FR-15 rather than left open. For the record: entity declaration
is a sidecar marker field (not a new `ResourceType`); matching is
exact-plus-possessive-plus-plural (not fuzzy); snippet offsets live in the
mention index (the inverted index is not extended with positions); an
ambiguous alias is attributed to all claimants and flagged; detection reads
only persisted, saved content — never unsaved editor state — via the same
`loadResourceContent` path `indexer-queue` already uses; a short or
common-word alias is matched (not rejected at write time) but flagged by a
non-blocking UI warning, with the word list fixed and not user-extendable;
and no numeric performance target is stated for FR-7, FR-8, or FR-13, which
inherit rather than introduce the `meta/index/` whole-file JSON persistence
scheme's known scaling risk and are settled, if ever, by measurement against
a real corpus rather than an invented ceiling. An eighth question — whether
the entity metadata UI should be always-on or opt-in — was settled after the
feature was exercised in the running app: it joins the existing per-project
feature-flag family, default off (FR-16).

Remaining:

None.

## Out of scope (deferred)

- An entity relationship graph derived from co-occurrence plus explicit typed
  links.
- Entity-scoped compile/export — "everything about Aria" as one continuous
  read-through, composing `query-evaluator` with `compile-core.ts`.
- An optional local-model pass that *suggests* entities and aliases for the
  writer to confirm, seeding the deterministic layer without replacing it.
- Mention detection across revision history rather than canonical revisions
  only (would let a writer find an entity in cut drafts).
- Entity-aware search ranking, where a query for an entity name boosts
  resources that mention it as an entity over incidental term matches.
- A user-extensible or localized common-word list for FR-15's alias warning
  (this feature ships one small, fixed, built-in English list only).
