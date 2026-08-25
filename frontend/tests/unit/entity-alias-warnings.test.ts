import { describe, it, expect } from "vitest";
import { getAliasWarning } from "../../src/lib/models/entity-alias-warnings";

describe("getAliasWarning", () => {
  it("warns on an alias under three characters", () => {
    expect(getAliasWarning("Al")).not.toBeNull();
  });

  it("warns case-insensitively on a common word/name in the fixed list", () => {
    expect(getAliasWarning("May")).not.toBeNull();
    expect(getAliasWarning("may")).not.toBeNull();
    expect(getAliasWarning("MAY")).not.toBeNull();
  });

  it("does not warn on an ordinary alias", () => {
    expect(getAliasWarning("Duchess")).toBeNull();
  });

  it("never throws or mutates its input regardless of alias content", () => {
    const inputs = [
      "",
      "   ",
      "a".repeat(10_000),
      "!@#$%^&*()_+-=[]{}|;':\",./<>?",
      "\n\t\r",
      "Ariá-Véla",
    ];

    for (const input of inputs) {
      const original = input;
      expect(() => getAliasWarning(input)).not.toThrow();
      expect(input).toBe(original);
    }
  });
});
