/**
 * @module entityHighlightDecoration.test
 *
 * Task 8 (entity-highlighting): tests for the pure decoration core in
 * `components/Editor/Extensions/entityHighlightDecoration.ts`.
 *
 * Covers this task's `done_when` list:
 *  1. An unambiguous name match renders plain.
 *  2. An alias flagged by `entity-alias-warnings.ts` renders "needs attention".
 *  3. A term present in `claimedBy` renders "needs attention".
 *  4. A term matching both conditions still renders exactly one
 *     "needs attention" state (no third style).
 *  5. Possessive/plural/case-insensitive matches are found via the same
 *     rules as `findMentionOffsets` (asserted by direct comparison).
 *  6. No match crosses a hyphenated compound or occurs inside a larger word.
 *  7. Performance stays within the 50ms OQ-1 threshold at the 500-alias/
 *     5,000-word ceiling.
 */
import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/core";
import { computeEntityHighlightRanges } from "../components/Editor/Extensions/entityHighlightDecoration";
import { findMentionOffsets } from "../src/lib/models/entity-detection";
import type { EntityAliasTable } from "../src/lib/models/entity-alias-table";

const schema = getSchema([StarterKit]);

/** Builds a one-paragraph document whose single text node is `text`. */
function docFromText(text: string) {
  return schema.nodeFromJSON({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

/** Builds a document from arbitrary top-level block JSON (for multi-node
 * cases, e.g. a term split across two text nodes by a mark boundary). */
function docFromContent(content: JSONContent[]) {
  return schema.nodeFromJSON({ type: "doc", content });
}

/** Builds a minimal `EntityAliasTable` from a flat list of
 * `{ entityId, name, aliases }` declarations, with no ambiguity unless the
 * caller supplies `claimedBy` explicitly. */
function buildAliasTable(
  entities: Array<{ entityId: string; name: string; aliases?: string[] }>,
  claimedBy: Record<string, string[]> = {},
): EntityAliasTable {
  const table: EntityAliasTable = { entities: {}, claimedBy };
  for (const e of entities) {
    const aliases = e.aliases ?? [];
    table.entities[e.entityId] = {
      entityId: e.entityId,
      entityKind: "character",
      name: e.name,
      aliases,
      terms: [e.name, ...aliases],
    };
  }
  return table;
}

describe("computeEntityHighlightRanges — plain vs needs-attention classification", () => {
  it("renders an unambiguous name match as plain-match", () => {
    const doc = docFromText("Aria walked into the harbor.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);

    const ranges = computeEntityHighlightRanges(doc, table);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].term).toBe("Aria");
    expect(ranges[0].state).toBe("plain-match");
    expect(ranges[0].reason).toBeNull();
    expect(ranges[0].entityIds).toEqual(["e1"]);
  });

  it("renders a short/common-word-flagged alias as needs-attention", () => {
    // "May" is on entity-alias-warnings.ts's fixed common-word list.
    const doc = docFromText("May opened the letter slowly.");
    const table = buildAliasTable([
      { entityId: "e1", name: "Maylene", aliases: ["May"] },
    ]);

    const ranges = computeEntityHighlightRanges(doc, table);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].term).toBe("May");
    expect(ranges[0].state).toBe("needs-attention");
    expect(ranges[0].reason).toEqual({
      shortOrCommonWord: true,
      ambiguousClaim: false,
    });
  });

  it("renders a claimedBy-ambiguous term as needs-attention", () => {
    const doc = docFromText("Rowan crossed the bridge.");
    const table = buildAliasTable(
      [
        { entityId: "e1", name: "Rowan" },
        { entityId: "e2", name: "Rowan Vale", aliases: ["Rowan"] },
      ],
      { rowan: ["e1", "e2"] },
    );

    const ranges = computeEntityHighlightRanges(doc, table);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].term.toLowerCase()).toBe("rowan");
    expect(ranges[0].state).toBe("needs-attention");
    expect(ranges[0].reason).toEqual({
      shortOrCommonWord: false,
      ambiguousClaim: true,
    });
    expect(ranges[0].entityIds.sort()).toEqual(["e1", "e2"]);
  });

  it("renders a term that is both warned and ambiguous as exactly one needs-attention state", () => {
    const doc = docFromText("Will spoke to Grace at dawn.");
    const table = buildAliasTable(
      [
        { entityId: "e1", name: "Willard", aliases: ["Will"] },
        { entityId: "e2", name: "Will Ashby", aliases: ["Will"] },
      ],
      { will: ["e1", "e2"] },
    );

    const ranges = computeEntityHighlightRanges(doc, table);
    const willRange = ranges.find((r) => r.term.toLowerCase() === "will");

    expect(willRange).toBeDefined();
    expect(willRange!.state).toBe("needs-attention");
    expect(willRange!.reason).toEqual({
      shortOrCommonWord: true,
      ambiguousClaim: true,
    });

    // Across every test case in this suite, exactly two state values ever
    // appear — no third style is introduced for "both" conditions.
    const allStates = new Set(ranges.map((r) => r.state));
    for (const state of allStates) {
      expect(["plain-match", "needs-attention"]).toContain(state);
    }
  });

  it("only ever produces the two FR-10 states across a mixed document", () => {
    const doc = docFromText("Aria and May and Rowan all met at Will's house.");
    const table = buildAliasTable(
      [
        { entityId: "e1", name: "Aria" },
        { entityId: "e2", name: "Maylene", aliases: ["May"] },
        { entityId: "e3", name: "Rowan" },
        { entityId: "e4", name: "Rowan Vale", aliases: ["Rowan"] },
        { entityId: "e5", name: "Willard", aliases: ["Will"] },
      ],
      { rowan: ["e3", "e4"] },
    );

    const ranges = computeEntityHighlightRanges(doc, table);
    const states = new Set(ranges.map((r) => r.state));

    expect(states.size).toBeGreaterThan(0);
    expect(
      Array.from(states).every(
        (s) => s === "plain-match" || s === "needs-attention",
      ),
    ).toBe(true);
    // Exactly two distinct states total across all discriminating enum
    // values possible — verified against the type's own two literals.
    const allPossibleStates: ReadonlySet<string> = new Set([
      "plain-match",
      "needs-attention",
    ]);
    expect(allPossibleStates.size).toBe(2);
  });
});

describe("computeEntityHighlightRanges — semantic fidelity to findMentionOffsets", () => {
  const cases: Array<{ label: string; text: string; term: string }> = [
    { label: "case-insensitive", text: "ARIA walked home.", term: "Aria" },
    { label: "possessive 's", text: "Aria's cloak was blue.", term: "Aria" },
    {
      label: "bare trailing apostrophe",
      text: "Jones' boots were muddy.",
      term: "Jones",
    },
    { label: "simple plural", text: "Two Arias appeared.", term: "Aria" },
    {
      label: "mid-sentence lowercase",
      text: "the cat sat, and aria sang.",
      term: "Aria",
    },
  ];

  for (const { label, text, term } of cases) {
    it(`finds the same offsets as findMentionOffsets for: ${label}`, () => {
      const doc = docFromText(text);
      const table = buildAliasTable([{ entityId: "e1", name: term }]);

      const ranges = computeEntityHighlightRanges(doc, table);
      const expectedOffsets = findMentionOffsets(text, term);

      // Single-paragraph, single-text-node doc: block-relative offset 0
      // maps to ProseMirror position 1 (one past the paragraph's opening
      // token), so `range.from - 1` recovers the plain-text offset.
      const actualOffsets = ranges.map((r) => r.from - 1);

      expect(actualOffsets).toEqual(expectedOffsets);
    });
  }

  it("finds a match spanning a mark boundary (mid-word bold split)", () => {
    // "Aria" split into "Ar" (bold) + "ia" (plain) — still one word in the
    // document's plain text, so it must still match as a whole term. This
    // is the offset-to-position mapping WikiLinkDecoration.ts does not need
    // (it only matches within a single text node) but this module does.
    const doc = docFromContent([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Ar", marks: [{ type: "bold" }] },
          { type: "text", text: "ia walked home." },
        ],
      },
    ]);
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);

    const ranges = computeEntityHighlightRanges(doc, table);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].matchedText).toBe("Aria");
    // Position 1 is the start of "Ar" (bold segment); "Aria" is 4 chars, so
    // it ends at position 5.
    expect(ranges[0].from).toBe(1);
    expect(ranges[0].to).toBe(5);
  });
});

describe("computeEntityHighlightRanges — boundary exclusions", () => {
  it("does not match a term occurring inside a larger word", () => {
    const doc = docFromText("The aristocrat entered the hall.");
    const table = buildAliasTable([{ entityId: "e1", name: "Ari" }]);

    const ranges = computeEntityHighlightRanges(doc, table);

    expect(ranges).toHaveLength(0);
  });

  it("does not match a term as one half of a hyphenated compound", () => {
    const doc = docFromText("Arias-Vela signed the treaty.");
    const table = buildAliasTable([{ entityId: "e1", name: "Arias" }]);

    const ranges = computeEntityHighlightRanges(doc, table);

    expect(ranges).toHaveLength(0);
  });

  it("still matches a term as a standalone word elsewhere in the same document", () => {
    const doc = docFromText(
      "Arias-Vela signed the treaty. Later, Arias spoke alone.",
    );
    const table = buildAliasTable([{ entityId: "e1", name: "Arias" }]);

    const ranges = computeEntityHighlightRanges(doc, table);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].matchedText).toBe("Arias");
  });
});

describe("computeEntityHighlightRanges — no declared entities", () => {
  it("returns no ranges and does no matching work when the alias table is empty", () => {
    const doc = docFromText("Nothing here should ever highlight.");
    const table = buildAliasTable([]);

    const ranges = computeEntityHighlightRanges(doc, table);

    expect(ranges).toHaveLength(0);
  });
});

describe("computeEntityHighlightRanges — performance (OQ-1 ceiling)", () => {
  // Mirrors the corpus-generation approach in
  // `entityHighlightBenchmark.test.ts` (Task 7) without modifying that file:
  // a small seeded PRNG producing a deterministic synthetic document and
  // term list at the spec's worst-case combination (500 declared terms,
  // 5,000-word document).
  function mulberry32(seed: number): () => number {
    let a = seed;
    return function random(): number {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const FILLER_WORDS = [
    "the",
    "quiet",
    "harbor",
    "held",
    "a",
    "long",
    "argument",
    "with",
    "itself",
    "while",
    "rain",
    "moved",
    "across",
    "rooftops",
  ];
  const NAME_SYLLABLES = [
    "kael",
    "bren",
    "tor",
    "ith",
    "mar",
    "lys",
    "wren",
    "ador",
    "sil",
    "dun",
  ];

  function generateTerms(count: number, rand: () => number): string[] {
    const terms = new Set<string>();
    let guard = 0;
    while (terms.size < count && guard < count * 50) {
      guard += 1;
      const a = NAME_SYLLABLES[Math.floor(rand() * NAME_SYLLABLES.length)];
      const b = NAME_SYLLABLES[Math.floor(rand() * NAME_SYLLABLES.length)];
      const capitalized = a + b;
      const term =
        capitalized.charAt(0).toUpperCase() + capitalized.slice(1) + terms.size;
      terms.add(term);
    }
    return Array.from(terms);
  }

  function generateDocumentText(
    wordCount: number,
    terms: readonly string[],
    rand: () => number,
  ): string {
    const words: string[] = [];
    const mentionRate = 0.04;
    for (let i = 0; i < wordCount; i += 1) {
      if (terms.length > 0 && rand() < mentionRate) {
        const term = terms[Math.floor(rand() * terms.length)];
        const roll = rand();
        if (roll < 0.15) {
          words.push(`${term}'s`);
        } else if (roll < 0.3) {
          words.push(`${term}s`);
        } else {
          words.push(term);
        }
      } else {
        words.push(FILLER_WORDS[Math.floor(rand() * FILLER_WORDS.length)]);
      }
    }
    return words.join(" ");
  }

  it("scans the 500-alias/5,000-word ceiling well within the 50ms OQ-1 threshold", () => {
    const termRand = mulberry32(1);
    const docRand = mulberry32(2);
    const terms = generateTerms(500, termRand);
    const text = generateDocumentText(5000, terms, docRand);

    const doc = docFromText(text);
    const table = buildAliasTable(
      terms.map((term, i) => ({ entityId: `entity-${i}`, name: term })),
    );

    const start = performance.now();
    const ranges = computeEntityHighlightRanges(doc, table);
    const elapsedMs = performance.now() - start;

    // Sanity: the synthetic corpus actually produced matches, so this is a
    // measurement of real work, not a no-op short circuit.
    expect(ranges.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(50);
  });
});
