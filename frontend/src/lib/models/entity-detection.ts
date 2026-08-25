/**
 * @module entity-detection
 *
 * Pure, offline detection of prose mentions of an entity's name or alias.
 *
 * `findMentionOffsets` scans plain text for occurrences of a single alias,
 * matching case-insensitively at word boundaries plus the possessive
 * (`Aria's`, `Jones'`) and simple plural (`Arias`) forms. It deliberately
 * does not match an alias occurring inside a larger word or as one half of a
 * hyphenated compound (`Ari` must not match `Aristocrat` or `Arias-Vela`).
 *
 * This module has no filesystem, index, or network dependencies by design —
 * it is the reusable matching primitive that callers (e.g. the indexer)
 * apply against persisted resource content.
 */

/** Characters that are part of a "word" for boundary purposes, plus the
 * apostrophe and hyphen — both of which continue a token (a possessive or a
 * hyphenated compound) rather than terminating one. */
const ATTACHED_CHAR_CLASS = "[\\p{L}\\p{N}_'\\-]";

/**
 * Escapes regex metacharacters in a user-supplied string so it can be safely
 * interpolated into a `RegExp` pattern.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the per-alias regex used by {@link findMentionOffsets}.
 *
 * The alias is matched literally (case-insensitively), followed by an
 * optional possessive suffix (`'s` or a bare trailing apostrophe) or a
 * simple plural suffix (`s`). Both before the alias and after any consumed
 * suffix, the match must not be directly attached to another word,
 * apostrophe, or hyphen character — this is what rejects `Aristocrat`
 * (alias immediately continues with more letters) and `Arias-Vela` (the
 * plural-look-alike is immediately continued by a hyphenated compound).
 */
function buildAliasRegex(alias: string): RegExp {
  const escaped = escapeRegExp(alias);
  return new RegExp(
    `(?<!${ATTACHED_CHAR_CLASS})${escaped}(?:'s|['’]|s)?(?!${ATTACHED_CHAR_CLASS})`,
    "giu",
  );
}

/**
 * Finds every occurrence of `alias` in `text`, matching case-insensitively
 * at word boundaries plus its possessive and simple plural forms.
 *
 * @param text - The plain text to scan.
 * @param alias - The name or alias to search for. Must be non-empty.
 * @returns The start character offset of each match, in ascending order.
 */
export function findMentionOffsets(text: string, alias: string): number[] {
  if (!text || !alias) return [];

  const regex = buildAliasRegex(alias);
  const offsets: number[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    offsets.push(match.index);

    // Guard against zero-length matches looping forever. The alias itself
    // is always non-empty, so a real match always advances `lastIndex`, but
    // this keeps the loop safe against any future change to the pattern.
    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  return offsets;
}
