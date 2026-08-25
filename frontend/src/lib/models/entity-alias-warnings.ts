/**
 * @module entity-alias-warnings
 *
 * Non-blocking noise heuristics for entity aliases (FR-15).
 *
 * `getAliasWarning` flags an alias as likely to match frequently and add
 * noise to mention detection — either because it is very short (fewer than
 * three characters) or because it coincides with a small, fixed list of
 * common English words and given names. This is advisory only: per FR-2 and
 * the Task 1 sidecar schema, alias validation never rejects an alias on
 * these grounds. The word list below is intentionally not exported or
 * parameterized — this feature ships one small, fixed, built-in list, not a
 * customizable one.
 */

/** Minimum alias length, in characters, below which an alias is flagged as
 * too short to be a reliable, low-noise match. */
const MIN_ALIAS_LENGTH = 3;

/**
 * Fixed, module-private list of common English words and given names that
 * frequently double as ordinary vocabulary. Matched case-insensitively.
 * Deliberately small and not exposed for extension — see module docs.
 */
const COMMON_WORDS: ReadonlySet<string> = new Set(
  [
    "May",
    "Will",
    "Art",
    "Grace",
    "Hope",
    "Faith",
    "Joy",
    "Rose",
    "Jack",
    "Mark",
    "Grant",
    "Bill",
    "Dawn",
    "Pat",
    "Mercy",
    "Summer",
    "June",
    "Rich",
    "Frank",
    "Sonny",
  ].map((word) => word.toLowerCase()),
);

/**
 * Flags an alias as noise-prone without ever rejecting it.
 *
 * @param alias - The candidate alias text, as typed by the user.
 * @returns A human-readable reason the alias may add noise, or `null` if the
 *   alias is clean.
 */
export function getAliasWarning(alias: string): string | null {
  const trimmed = alias.trim();

  if (trimmed.length < MIN_ALIAS_LENGTH) {
    return "This alias is very short and will match frequently and add noise.";
  }

  if (COMMON_WORDS.has(trimmed.toLowerCase())) {
    return "This alias is a common word or name and will match frequently and add noise.";
  }

  return null;
}
