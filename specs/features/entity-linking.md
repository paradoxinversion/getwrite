# Feature Spec: Backlink Detection Repair (`resource-ref` / `multi-resource-ref`)

## Overview

`backlinks.ts` computes `meta/backlinks.json` from three sources: embedded
UUIDs, `[[wiki links]]`, and `resource-ref`/`multi-resource-ref` sidecar
fields. The third source has never worked: `extractSidecarRefIds` scans only
the sidecar's top-level keys, but every user-defined metadata value — where
`resource-ref` and `multi-resource-ref` fields live — is nested one level
down, under `sidecar.userMetadata`. Measured against a real 76-resource
project, every backlink entry is an empty array despite sidecars carrying
populated ref values; a controlled single-variable experiment (hoisting one
field to the sidecar top level) changed that resource's result from empty to
correctly populated, confirming the nesting as the cause. This is a repair of
existing, already-shipped behavior — no new linking UI or affordance is in
scope.

## Goals

- A `resource-ref` or `multi-resource-ref` field anywhere a sidecar actually
  stores it (including under `userMetadata`) produces a backlink entry.
- Existing top-level and other already-working detection paths (UUID, wiki
  link) are unaffected.
- `linkedFrom`/`linksTo` query intrinsics and the entity panel's LINKED view
  receive real data once the index is correct.
- Every existing project's on-disk `backlinks.json` becomes accurate, not
  just newly-created ones.

## Non-goals

- Any new linking UI, affordance, or user-facing way to create a reference.
  Rejected at the spec-owner's gate; this is detection/index repair only.
- Changing the wiki-link (`[[...]]`) or embedded-UUID detection paths. Not
  measured in this investigation; no claim is made about their correctness.
- Extending `InvertedIndex` or adding position data — unrelated to this bug.
- Changing `isResourceRef`'s deliberately schema-agnostic, structural
  contract (see FR-1).

## User stories

- US-1: As a writer, I want to fill in a `resource-ref`/`multi-resource-ref`
  field so that it actually produces a backlink, and smart folders and the
  entity panel's LINKED view work as documented.
- US-2: As a writer with an existing project, I want to open it after the
  fix ships so that its backlink index is already correct, without having to
  hand-run a command I don't know exists.

## Functional requirements

1. FR-1: `extractSidecarRefIds` MUST detect `resource-ref` and
   `multi-resource-ref` values stored under `sidecar.userMetadata`, in
   addition to any at the sidecar top level, by descending specifically into
   `userMetadata` rather than recursing generically through nested objects.
   This mirrors `flattenUserMetadata` (`field-values.ts:137-146`, one level
   deep) and matches where the schema actually puts data: every field, built
   in or user-defined, is declared flat under `sidecar.userMetadata`
   (`schemas.ts:339-354`, `default-metadata-schema.ts:8-35`,
   `MetadataSidebar.tsx:308`, `metadata-schema.ts:183`; confirmed against ~10
   populated sidecars across 5 real projects). Generic recursion was
   rejected: no `{id, name}`-shaped non-reference value was found anywhere in
   the codebase or sampled data (`aliases` is `string[]`; `tagAssignments`
   lives on project config, not the sidecar; sampled `exif` has no such
   shape), so the false-positive risk a broader descent would guard against
   is hypothetical rather than demonstrated. `isResourceRef`'s structural,
   schema-agnostic check MUST NOT change. [US-1]
2. FR-2: Detection MUST continue to find refs already at the sidecar top
   level (no regression). [US-1]
3. FR-3: A single `resource-ref` field with a non-null `id` MUST produce
   exactly one backlink id. [US-1]
4. FR-4: A `multi-resource-ref` array MUST produce one backlink id per
   non-null element. [US-1]
5. FR-5: A ref with `id: null` MUST be skipped, matching current behavior.
   [US-1]
6. FR-6: A ref whose `id` equals the containing resource's own id MUST be
   excluded from that resource's backlink list, matching current behavior at
   the `computeBacklinks` call site. [US-1]
7. FR-7: Migration code MUST NOT ship for existing projects' on-disk
   `backlinks.json`. Correctness for an active project is restored by
   existing behavior: `computeBacklinks` (`backlinks.ts:161`) rebuilds a
   project's entire index from scratch, and `indexer-queue.ts:203-204` calls
   it on every save with no per-resource incrementality — so the next save
   of ANY resource in a project fully repairs that project's index using the
   fixed extraction logic. An index-version marker that triggers an
   automatic rebuild was considered and rejected: no versioning mechanism
   exists anywhere in the repo today, and building one is disproportionate
   to this fix. [US-2]
8. FR-8: Documentation MUST tell writers to run `getwrite-cli reindex` once
   per existing project after this ships, for any project they will not be
   editing again. This addition belongs in `docs/features/cli.md`, which
   already documents `reindex`. The accepted limitation MUST be stated
   plainly, not hidden: a project that is never edited again and whose owner
   never reads the documentation keeps a stale index silently, with no
   in-app signal. This was accepted at the gate as proportionate to an index
   correction, since no data is lost or corrupted. [US-2]

## Open questions

Three design questions were resolved at the gate; the resolutions are
folded into FR-1 (narrow `userMetadata` descent, not generic recursion) and
FR-7/FR-8 (no migration code — self-heal on next save, plus a one-time
documented `reindex` step for untouched projects). The third — whether
`entity-layer.md`'s claim that backlinks resolve "resource-ref metadata
fields" needs qualification — resolved to no: the fix makes that existing
claim (`entity-layer.md:12-14`) true for the first time; no edit needed.
Two other candidates raised during triage don't apply and should not be
reopened: `getwrite.features.md` (~line 376, Feature 24 Organizer filtering)
describes a different path — filtering reads `userMetadata` through the
query evaluator, not `extractSidecarRefIds`; `CLAUDE.md`'s glossary makes no
resource-ref claim at all.

Remaining:

None.

## Out of scope (deferred)

- Any UI for authoring or discovering references (rejected at the gate).
- Re-auditing the wiki-link or embedded-UUID detection paths.
- An index schema-version/migration mechanism — considered for this bug and
  rejected as disproportionate (see FR-7).
