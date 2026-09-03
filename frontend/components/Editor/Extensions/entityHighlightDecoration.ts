import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  ATTACHED_CHAR_CLASS,
  POSSESSIVE_OR_PLURAL_SUFFIX,
  escapeRegExp,
} from "../../../src/lib/models/entity-detection";
import { getAliasWarning } from "../../../src/lib/models/entity-alias-warnings";
import type { EntityAliasTable } from "../../../src/lib/models/entity-alias-table";

/**
 * @module entityHighlightDecoration
 *
 * Pure, framework-agnostic core for the entity-highlighting feature
 * (`specs/features/entity-highlighting.md`, Task 8). Given a ProseMirror
 * document and a project's `EntityAliasTable`, computes the ranges where a
 * declared entity's name or alias occurs in the live document, classified
 * into exactly one of the two FR-10 visual states.
 *
 * This module does not import `@tiptap/pm/view` or `@tiptap/core` — it
 * returns plain data (`EntityHighlightRange[]`), not `Decoration`/
 * `DecorationSet` objects, so the actual TipTap extension wrapper (Task 9)
 * can turn ranges into decorations however it needs to. It mirrors how
 * `buildWikiLinkDecorations` in `./WikiLinkDecoration.ts` is a plain
 * function driven by a plugin's `state.init`/`apply`, except this module
 * stops one layer short of building `Decoration` instances.
 *
 * ## Matching strategy (OQ-1 mitigation)
 *
 * `frontend/tests/entityHighlightBenchmark.test.ts` (Task 7) measured that,
 * at the spec's worst-case corpus (500 declared terms / 5,000-word
 * document), calling `findMentionOffsets` once per declared term costs
 * ~137ms — over 2.7x the recorded 50ms no-visible-lag threshold
 * (`specs/features/entity-highlighting/oq1-benchmark-notes.md`). This module
 * instead builds a single combined alternation regex across every declared
 * term and scans each document text block once, which the same benchmark
 * measured at ~1.9ms for the identical worst case — comfortably under
 * threshold. The combined regex reuses `entity-detection.ts`'s exported
 * `ATTACHED_CHAR_CLASS`/`POSSESSIVE_OR_PLURAL_SUFFIX`/`escapeRegExp` building
 * blocks so its case-insensitive/word-boundary/possessive/simple-plural
 * envelope stays byte-for-byte faithful to `findMentionOffsets`'s semantics
 * rather than re-deriving them.
 *
 * A combined regex only tells us where a match starts and ends, not which
 * declared term produced it. `attributeMatch` recovers that by re-checking
 * the matched text (case-insensitively) against the same term list, longest
 * first — safe because a term can only ever win the regex alternation if its
 * case-insensitive text is a genuine prefix of the match subject to the same
 * boundary rules the whole combined pattern already enforced, so the
 * re-check cannot select a term the regex itself would have rejected.
 */

/** One declared term's classification inputs, keyed by its normalized
 * (trimmed, lowercased) form. */
interface TermClassification {
  /** The term text as declared (original casing), used to render/report. */
  term: string;
  /** Every entity id that declares this normalized term. Length 1 unless the
   * term is `claimedBy`-ambiguous. */
  entityIds: string[];
  /** Whether `entity-alias-warnings.ts` flags this term as short/common. */
  isWarned: boolean;
}

/** The two — and only two — visual states FR-10 allows. */
export type EntityMatchState = "plain-match" | "needs-attention";

/** Which condition(s) put a match into the "needs attention" state, for
 * FR-11's hover/`title` disclosure. Both may be true for the same match. */
export interface NeedsAttentionReason {
  /** The term is flagged by `entity-alias-warnings.ts` as short or a common
   * word/name. */
  shortOrCommonWord: boolean;
  /** The term is claimed by more than one entity (`EntityAliasTable.claimedBy`). */
  ambiguousClaim: boolean;
}

/** A single computed highlight range in the live document. */
export interface EntityHighlightRange {
  /** ProseMirror position where the match starts (inclusive). */
  from: number;
  /** ProseMirror position where the match ends (exclusive). */
  to: number;
  /** The exact substring matched in the document (may carry a possessive or
   * plural suffix the declared term itself does not have). */
  matchedText: string;
  /** The declared term (name or alias, original casing) this match resolves
   * to. */
  term: string;
  /** Every entity id that declares this term. Length 1 unless the term is
   * ambiguous (claimed by more than one entity). */
  entityIds: string[];
  /** One of exactly two states, per FR-10. */
  state: EntityMatchState;
  /** Present only when `state` is `"needs-attention"`; `null` for a plain
   * match. */
  reason: NeedsAttentionReason | null;
}

/** Normalizes a term for lookup/dedup purposes: trimmed, lowercased. */
function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

/**
 * Builds the per-project term classification index (normalized term ->
 * declaring entity ids + warning flag) from an `EntityAliasTable`, and the
 * de-duplicated, longest-first list of original term strings the combined
 * regex alternates over.
 */
function buildTermIndex(aliasTable: EntityAliasTable): {
  classifications: Map<string, TermClassification>;
  orderedTerms: string[];
} {
  const classifications = new Map<string, TermClassification>();

  for (const entity of Object.values(aliasTable.entities)) {
    for (const term of entity.terms) {
      const normalized = normalizeTerm(term);
      if (!normalized) continue;

      const existing = classifications.get(normalized);
      if (existing) {
        if (!existing.entityIds.includes(entity.entityId)) {
          existing.entityIds.push(entity.entityId);
        }
        continue;
      }

      classifications.set(normalized, {
        term,
        entityIds: [entity.entityId],
        isWarned: getAliasWarning(term) !== null,
      });
    }
  }

  // The ambiguity table is the source of truth for "claimed by more than one
  // entity" (FR-10b) — reconcile it in case an entity table was constructed
  // independently of its accompanying `claimedBy` map.
  for (const [normalized, entityIds] of Object.entries(aliasTable.claimedBy)) {
    const existing = classifications.get(normalized);
    if (!existing) continue;
    for (const entityId of entityIds) {
      if (!existing.entityIds.includes(entityId)) {
        existing.entityIds.push(entityId);
      }
    }
  }

  const orderedTerms = Array.from(classifications.values())
    .map((c) => c.term)
    .sort((a, b) => b.length - a.length);

  return { classifications, orderedTerms };
}

/**
 * Builds the single combined alternation regex over every declared term,
 * mirroring `entity-detection.ts`'s `buildAliasRegex` envelope exactly
 * (case-insensitive `i`, Unicode `u`, global `g`; same boundary lookaround
 * and possessive/plural suffix) but alternating across every term in one
 * pattern instead of building one regex per term.
 *
 * Terms are sorted longest-first by the caller so that, when one declared
 * term is a prefix of another (e.g. `Kael` and `Kaelith`), the regex engine
 * prefers the longer, more specific alternative at a given match position.
 */
function buildCombinedRegex(orderedTerms: readonly string[]): RegExp | null {
  if (orderedTerms.length === 0) return null;
  const alternation = orderedTerms.map(escapeRegExp).join("|");
  return new RegExp(
    `(?<!${ATTACHED_CHAR_CLASS})(?:${alternation})${POSSESSIVE_OR_PLURAL_SUFFIX}(?!${ATTACHED_CHAR_CLASS})`,
    "giu",
  );
}

/**
 * Recovers which declared term produced a combined-regex match by checking
 * the matched text (case-insensitively) against the same longest-first term
 * list the regex alternated over. Returns `null` only if no declared term
 * could account for the match, which should not happen for a match the
 * combined regex itself produced.
 */
function attributeMatch(
  matchedText: string,
  orderedTerms: readonly string[],
  classifications: Map<string, TermClassification>,
): TermClassification | null {
  const lowerMatch = matchedText.toLowerCase();
  for (const term of orderedTerms) {
    const lowerTerm = term.toLowerCase();
    if (lowerMatch.startsWith(lowerTerm)) {
      const normalized = normalizeTerm(term);
      const classification = classifications.get(normalized);
      if (classification) return classification;
    }
  }
  return null;
}

/** One text segment within a document text block: its plain text and the
 * ProseMirror position where that text begins. */
interface TextSegment {
  text: string;
  pos: number;
}

/**
 * Collects every text block (paragraph, heading, list item paragraph, etc.)
 * in the document as a list of `{ blockText, segments }`, where `blockText`
 * concatenates every text node in that block (regardless of marks, so a
 * mid-word bold/italic split does not break matching across the boundary)
 * and `segments` records where each contributing text node starts in
 * ProseMirror position space, letting a block-relative text offset be mapped
 * back to a real document position.
 *
 * This is the offset-to-position bridge `WikiLinkDecoration.ts` does not
 * need (it matches within a single text node) but this module does, since a
 * declared term's occurrence in prose is not guaranteed to fall inside one
 * text node once marks (bold/italic/etc.) split it.
 */
function collectTextBlocks(
  doc: ProseMirrorNode,
): Array<{ blockText: string; segments: TextSegment[] }> {
  const blocks: Array<{ blockText: string; segments: TextSegment[] }> = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;

    const segments: TextSegment[] = [];
    let blockText = "";
    node.forEach((child, offsetInParent) => {
      if (!child.isText || !child.text) return;
      segments.push({ text: child.text, pos: pos + 1 + offsetInParent });
      blockText += child.text;
    });

    if (blockText) blocks.push({ blockText, segments });

    // Don't descend further — text nodes are leaves and every other child a
    // textblock can contain (inline atoms with no text) contributes nothing
    // to matching.
    return false;
  });

  return blocks;
}

/**
 * Maps a block-relative character offset back to its ProseMirror document
 * position, using the block's segment list built by {@link collectTextBlocks}.
 */
function positionForBlockOffset(
  segments: readonly TextSegment[],
  blockOffset: number,
): number {
  let consumed = 0;
  for (const segment of segments) {
    const segmentEnd = consumed + segment.text.length;
    if (blockOffset <= segmentEnd) {
      return segment.pos + (blockOffset - consumed);
    }
    consumed = segmentEnd;
  }
  // Offset past every segment (should not happen for a match within
  // `blockText`) — clamp to the end of the last segment.
  const last = segments[segments.length - 1];
  return last ? last.pos + last.text.length : 0;
}

/**
 * Computes every entity-highlight range in `doc`, classified per FR-10.
 *
 * Pure and synchronous: does not read from or write to the filesystem, the
 * mention index, or any persisted state — matching runs only against the
 * live, unsaved document text passed in, never `meta/index/mentions.json`.
 *
 * @param doc - The ProseMirror document to scan.
 * @param aliasTable - The project's declared entities and their
 *   `claimedBy` ambiguity map (`entity-alias-table.ts`).
 * @returns Every match, in document order, classified into exactly one of
 *   the two FR-10 states.
 */
export function computeEntityHighlightRanges(
  doc: ProseMirrorNode,
  aliasTable: EntityAliasTable,
): EntityHighlightRange[] {
  const { classifications, orderedTerms } = buildTermIndex(aliasTable);
  const regex = buildCombinedRegex(orderedTerms);
  if (!regex) return [];

  const ranges: EntityHighlightRange[] = [];
  const blocks = collectTextBlocks(doc);

  for (const { blockText, segments } of blocks) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(blockText)) !== null) {
      const matchedText = match[0];

      // Guard against zero-length matches looping forever, mirroring
      // `findMentionOffsets`'s own guard.
      if (matchedText.length === 0) {
        regex.lastIndex += 1;
        continue;
      }

      const classification = attributeMatch(
        matchedText,
        orderedTerms,
        classifications,
      );
      if (!classification) continue;

      const from = positionForBlockOffset(segments, match.index);
      const to = positionForBlockOffset(
        segments,
        match.index + matchedText.length,
      );

      const isAmbiguousClaim = classification.entityIds.length > 1;
      const isShortOrCommonWord = classification.isWarned;
      const isNeedsAttention = isAmbiguousClaim || isShortOrCommonWord;

      ranges.push({
        from,
        to,
        matchedText,
        term: classification.term,
        entityIds: classification.entityIds,
        state: isNeedsAttention ? "needs-attention" : "plain-match",
        reason: isNeedsAttention
          ? {
              shortOrCommonWord: isShortOrCommonWord,
              ambiguousClaim: isAmbiguousClaim,
            }
          : null,
      });
    }
  }

  return ranges;
}
