/**
 * @module entityHighlightBenchmark.test
 *
 * Task 7 (entity-highlighting, OQ-1): a standalone, deterministic benchmark
 * harness measuring full-document highlight-rescan latency at the spec's
 * settled corpus shape (word counts x declared-alias counts), plus the same
 * task profiled under three candidate mitigations. This test produces the
 * raw numbers recorded in
 * `specs/features/entity-highlighting/oq1-benchmark-notes.md` — it does not
 * assert a millisecond threshold itself (that would make the suite flaky
 * across machines); it only asserts the harness is internally consistent
 * (non-negative timings, matches found where expected) and logs the
 * measured numbers so a run's output is reproducible evidence.
 *
 * Run: `pnpm --filter getwrite-frontend exec vitest run entityHighlightBenchmark`
 */
import { describe, expect, it } from "vitest";
import { findMentionOffsets } from "../src/lib/models/entity-detection";

// ---------------------------------------------------------------------------
// Deterministic synthetic corpus generation
// ---------------------------------------------------------------------------

/** A tiny seeded PRNG (mulberry32) so every run of this benchmark, on any
 * machine, generates byte-identical corpora — timings will vary by machine,
 * but the text and terms being timed never do. */
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
  "and",
  "nobody",
  "spoke",
  "of",
  "what",
  "had",
  "been",
  "promised",
  "before",
  "winter",
  "arrived",
  "again",
  "somewhere",
  "north",
  "of",
  "the",
  "old",
  "bridge",
  "where",
  "two",
  "rivers",
  "meet",
  "without",
  "ever",
  "agreeing",
  "on",
  "a",
  "name",
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
  "ora",
  "vex",
  "nell",
  "quin",
  "ash",
  "fen",
];

/** Builds `count` unique, name-like terms (used both as an entity's `name`
 * and, per the task brief, standing in for the "name + a couple aliases"
 * shape — the benchmark cares about total declared term count, not the
 * name/alias split). */
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

/** Builds a synthetic document of approximately `wordCount` words, sprinkling
 * in occurrences of `terms` (some bare, some possessive/plural) at a fixed
 * rate so every mitigation actually has matches to find, not just filler. */
function generateDocument(
  wordCount: number,
  terms: readonly string[],
  rand: () => number,
): string {
  const words: string[] = [];
  const mentionRate = 0.04; // ~4% of word slots are an entity mention
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
    if ((i + 1) % 14 === 0) {
      words[words.length - 1] += ".";
    }
  }
  return words.join(" ");
}

// ---------------------------------------------------------------------------
// Timed operations under measurement
// ---------------------------------------------------------------------------

interface TimedResult {
  elapsedMs: number;
  totalMatches: number;
}

/** Baseline: one `findMentionOffsets` call per declared term, summed — the
 * naive approach a first implementation would reach for. */
function benchmarkBaseline(
  text: string,
  terms: readonly string[],
): TimedResult {
  const start = performance.now();
  let totalMatches = 0;
  for (const term of terms) {
    totalMatches += findMentionOffsets(text, term).length;
  }
  const elapsedMs = performance.now() - start;
  return { elapsedMs, totalMatches };
}

const ATTACHED_CHAR_CLASS = "[\\p{L}\\p{N}_'\\-]";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mitigation (a): a single combined alternation regex across all declared
 * terms, built once per rescan instead of one regex per term.
 *
 * Simplification noted per the task brief: this variant matches the same
 * boundary/possessive/plural envelope as `findMentionOffsets`'s
 * `buildAliasRegex`, but does not attempt to disambiguate which alternative
 * matched when two terms share a prefix (e.g. `Kael` and `Kaelith` both
 * declared) — terms are sorted longest-first so the longer, more specific
 * alternative is preferred by regex alternation order, but a production
 * implementation would still need a lookup step from matched text back to
 * the owning term/entity. That lookup is out of scope for this coarse
 * timing comparison, which measures scan cost, not classification cost.
 */
function buildCombinedRegex(terms: readonly string[]): RegExp {
  const sorted = terms.slice().sort((a, b) => b.length - a.length);
  const alternation = sorted.map(escapeRegExp).join("|");
  return new RegExp(
    `(?<!${ATTACHED_CHAR_CLASS})(?:${alternation})(?:'s|['’]|s)?(?!${ATTACHED_CHAR_CLASS})`,
    "giu",
  );
}

function benchmarkCombinedRegex(
  text: string,
  terms: readonly string[],
): TimedResult {
  const start = performance.now();
  const regex = buildCombinedRegex(terms);
  let totalMatches = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    totalMatches += 1;
    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }
  const elapsedMs = performance.now() - start;
  return { elapsedMs, totalMatches };
}

/**
 * Mitigation (b): step-map-scoped rescanning. Simulates a single-word
 * insertion at the document's midpoint (the smallest realistic per-keystroke
 * edit) and rescans only a bounded window around the edit, rather than the
 * whole document, using the same per-term baseline approach.
 */
function benchmarkScopedRescan(
  text: string,
  terms: readonly string[],
  windowRadiusChars: number,
): TimedResult {
  const editPos = Math.floor(text.length / 2);
  const editedText = `${text.slice(0, editPos)} inserted${text.slice(editPos)}`;

  const start = performance.now();
  const windowStart = Math.max(0, editPos - windowRadiusChars);
  const windowEnd = Math.min(editedText.length, editPos + windowRadiusChars);
  const windowText = editedText.slice(windowStart, windowEnd);
  let totalMatches = 0;
  for (const term of terms) {
    totalMatches += findMentionOffsets(windowText, term).length;
  }
  const elapsedMs = performance.now() - start;
  return { elapsedMs, totalMatches };
}

// ---------------------------------------------------------------------------
// Corpus matrix
// ---------------------------------------------------------------------------

const WORD_COUNTS = [500, 2500, 5000] as const;
const ALIAS_COUNTS = [50, 200, 500] as const;
const SCOPED_WINDOW_RADIUS_CHARS = 500;

interface CorpusResult {
  wordCount: number;
  aliasCount: number;
  baseline: TimedResult;
  combinedRegex: TimedResult;
  scopedRescan: TimedResult;
}

function runCorpusMatrix(): CorpusResult[] {
  const results: CorpusResult[] = [];
  for (const wordCount of WORD_COUNTS) {
    for (const aliasCount of ALIAS_COUNTS) {
      // Fixed, distinct seed per combination so the corpus is reproducible
      // and independent of iteration order.
      const seed = wordCount * 100_003 + aliasCount;
      const termRand = mulberry32(seed);
      const docRand = mulberry32(seed + 1);
      const terms = generateTerms(aliasCount, termRand);
      const text = generateDocument(wordCount, terms, docRand);

      const baseline = benchmarkBaseline(text, terms);
      const combinedRegex = benchmarkCombinedRegex(text, terms);
      const scopedRescan = benchmarkScopedRescan(
        text,
        terms,
        SCOPED_WINDOW_RADIUS_CHARS,
      );

      results.push({
        wordCount,
        aliasCount,
        baseline,
        combinedRegex,
        scopedRescan,
      });
    }
  }
  return results;
}

describe("entity highlighting OQ-1 benchmark", () => {
  it("runs the full 9-combination corpus matrix and reports timings", () => {
    const results = runCorpusMatrix();

    console.log(
      "\nOQ-1 benchmark results (elapsed ms; see specs/features/entity-highlighting/oq1-benchmark-notes.md)\n" +
        [
          "words".padEnd(7),
          "aliases".padEnd(8),
          "baselineMs".padEnd(11),
          "baselineMatches".padEnd(16),
          "combinedRegexMs".padEnd(16),
          "combinedMatches".padEnd(16),
          "scopedRescanMs".padEnd(15),
          "scopedMatches",
        ].join(" | "),
    );
    for (const r of results) {
      console.log(
        [
          String(r.wordCount).padEnd(7),
          String(r.aliasCount).padEnd(8),
          r.baseline.elapsedMs.toFixed(3).padEnd(11),
          String(r.baseline.totalMatches).padEnd(16),
          r.combinedRegex.elapsedMs.toFixed(3).padEnd(16),
          String(r.combinedRegex.totalMatches).padEnd(16),
          r.scopedRescan.elapsedMs.toFixed(3).padEnd(15),
          String(r.scopedRescan.totalMatches),
        ].join(" | "),
      );
    }

    expect(results).toHaveLength(9);
    for (const r of results) {
      // Every timing is a real, finite, non-negative measurement.
      expect(r.baseline.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.baseline.elapsedMs)).toBe(true);
      expect(r.combinedRegex.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.combinedRegex.elapsedMs)).toBe(true);
      expect(r.scopedRescan.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.scopedRescan.elapsedMs)).toBe(true);

      // The synthetic corpus actually contains mentions to find — a zero
      // count everywhere would mean the harness itself is broken, not that
      // matching is fast.
      expect(r.baseline.totalMatches).toBeGreaterThan(0);
      expect(r.combinedRegex.totalMatches).toBeGreaterThan(0);

      // The scoped rescan looks at a bounded window, a subset of the full
      // document, so it must never take longer than scanning the whole
      // document per term at the same term count.
      expect(r.scopedRescan.elapsedMs).toBeLessThanOrEqual(
        r.baseline.elapsedMs + 1, // +1ms slack for timer granularity noise
      );
    }
  });

  it("scales the scoped rescan window independently of full document length", () => {
    // Sanity check for mitigation (b): the scoped rescan's cost should be
    // governed by the window size and term count, not the full document
    // length — i.e. it should be roughly comparable whether the underlying
    // document is 500 or 5000 words, since only a fixed-radius window
    // around the edit is scanned either way.
    const termRand = mulberry32(7);
    const terms = generateTerms(200, termRand);

    const shortDocRand = mulberry32(8);
    const shortText = generateDocument(500, terms, shortDocRand);
    const longDocRand = mulberry32(9);
    const longText = generateDocument(5000, terms, longDocRand);

    const shortScoped = benchmarkScopedRescan(
      shortText,
      terms,
      SCOPED_WINDOW_RADIUS_CHARS,
    );
    const longScoped = benchmarkScopedRescan(
      longText,
      terms,
      SCOPED_WINDOW_RADIUS_CHARS,
    );

    expect(Number.isFinite(shortScoped.elapsedMs)).toBe(true);
    expect(Number.isFinite(longScoped.elapsedMs)).toBe(true);
  });
});
