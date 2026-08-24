# Feature Spec: Entity Layer

> **Scope note:** this document exceeds the 500-word guideline (~800 words). The
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

- **US-1:** As a novelist, I want every scene that names a character to be
  attributed to that character automatically, so that my appearance list is
  never stale.
- **US-2:** As a novelist, I want an entity page listing every mention with its
  surrounding text, so that I can re-read a character's whole thread without
  running a search.
- **US-3:** As a novelist, I want a smart folder for "scenes mentioning Aria",
  so that I can work a POV thread as a unit.
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
   [US-4]
3. **FR-3:** Detection MUST match an entity's `name` and each alias
   case-insensitively at word boundaries, and MUST additionally match the
   possessive (`Aria's`, `Jones'`) and simple plural (`Aria`/`Arias`) forms.
   [US-1]
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
7. **FR-7:** Saving a resource MUST re-scan only that resource against the
   current alias table, dispatched through the existing `indexer-queue`
   alongside the inverted-index and backlink updates. [US-1]
8. **FR-8:** Editing an entity's `name` or `aliases` MUST re-scan the project
   for that entity alone, and MUST NOT rebuild the whole mention index. [US-4]
9. **FR-9:** A resource's view MUST list the entities detected in it, each
   navigable to the entity resource. [US-1]
10. **FR-10:** An entity's view MUST list every resource mentioning it, with
    one snippet per occurrence rendered through the existing `extractSnippet`.
    [US-2]
11. **FR-11:** A `mentions` intrinsic field MUST be added to
    `INTRINSIC_FIELDS` so that `query-evaluator` and smart folders can filter
    resources by whether they mention a given entity. [US-3]
12. **FR-12:** Wherever explicit links and detected mentions appear in one
    list, the UI MUST distinguish them visually and label which is which.
    [US-5]
13. **FR-13:** `getwrite-cli reindex` MUST rebuild the mention index from
    scratch alongside the inverted index and backlinks. [US-1]
14. **FR-14:** When two or more entities claim the same alias, the mention MUST
    be recorded against every claimant and the collision MUST be surfaced to
    the writer as an ambiguity naming each claiming entity. The system MUST NOT
    silently attribute the mention to one of them, and MUST NOT reject the
    alias at edit time. [US-4]

## Open questions

Four design questions were resolved before this spec was saved; the resolutions
are folded into FR-1, FR-3, FR-4, FR-6, and FR-14 rather than left open. For the
record: entity declaration is a sidecar marker field (not a new `ResourceType`);
matching is exact-plus-possessive-plus-plural (not fuzzy); snippet offsets live
in the mention index (the inverted index is not extended with positions); and an
ambiguous alias is attributed to all claimants and flagged.

Remaining:

- **OQ-1:** Does detection run over the canonical revision's persisted content
  only, or also over unsaved editor state? — Impact: FR-7 (what triggers a
  re-scan and what text it reads).
- **OQ-2:** Is there a minimum alias length or a stop-word guard? A one- or
  two-character alias, or a common word used as a name ("May", "Will", "Art"),
  will match constantly and drown the index. — Impact: FR-3, FR-14, and whether
  FR-2 needs validation on write.
- **OQ-3:** What corpus size must FR-7's incremental scan and FR-13's full
  rebuild hold under, and what is the acceptable wall-clock ceiling for each?
  No target is currently stated, so neither requirement is performance-testable
  as written. — Impact: FR-7, FR-8, FR-13.

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
