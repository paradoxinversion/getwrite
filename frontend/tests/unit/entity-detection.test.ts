import { describe, it, expect } from "vitest";
import { findMentionOffsets } from "../../src/lib/models/entity-detection";

describe("findMentionOffsets", () => {
  it("matches case-insensitively at word boundaries", () => {
    const text = "Aria drew her blade.";
    expect(findMentionOffsets(text, "aria")).toEqual([0]);
  });

  it("matches the exact-case occurrence within a longer sentence", () => {
    const text = "Everyone watched as Aria stepped forward.";
    const offsets = findMentionOffsets(text, "Aria");
    expect(offsets).toEqual([20]);
    expect(text.slice(offsets[0], offsets[0] + 4)).toBe("Aria");
  });

  it("matches the possessive 's form", () => {
    const text = "Aria's blade gleamed in the dark.";
    expect(findMentionOffsets(text, "Aria")).toEqual([0]);
  });

  it("matches the bare trailing-apostrophe possessive form", () => {
    const text = "Jones' cabin stood at the edge of the woods.";
    expect(findMentionOffsets(text, "Jones")).toEqual([0]);
  });

  it("matches the simple plural form", () => {
    const text = "There were two Arias in the story.";
    expect(findMentionOffsets(text, "Aria")).toEqual([15]);
  });

  it("does NOT match an alias occurring inside a larger word (Aristocrat)", () => {
    const text = "The aristocrat entered the hall.";
    expect(findMentionOffsets(text, "Ari")).toEqual([]);
  });

  it("does NOT match an alias occurring as half of a hyphenated compound (Arias-Vela)", () => {
    const text = "General Arias-Vela addressed the council.";
    expect(findMentionOffsets(text, "Ari")).toEqual([]);
  });

  it("does NOT match either an aristocrat or a hyphenated compound in one combined text", () => {
    const text = "The aristocrat and General Arias-Vela both arrived.";
    expect(findMentionOffsets(text, "Ari")).toEqual([]);
  });

  it("matches an alias at the very start of the text", () => {
    const text = "Aria left before dawn.";
    expect(findMentionOffsets(text, "Aria")).toEqual([0]);
  });

  it("matches an alias at the very end of the text", () => {
    const text = "The last one to leave was Aria";
    const offsets = findMentionOffsets(text, "Aria");
    expect(offsets).toEqual([26]);
  });

  it("matches an alias at the very end of the text when it is the whole text", () => {
    const text = "Aria";
    expect(findMentionOffsets(text, "Aria")).toEqual([0]);
  });

  it("finds independent, non-contaminating offsets when a shorter alias is a substring of a longer one searched against the same text", () => {
    const text = "Aria and Ari walked together while Aria waited.";
    // "Ari" is a real standalone word here, and also the prefix of "Aria".
    const ariOffsets = findMentionOffsets(text, "Ari");
    const ariaOffsets = findMentionOffsets(text, "Aria");

    expect(ariOffsets).toEqual([9]);
    expect(ariaOffsets).toEqual([0, 35]);

    // Calling with "Ari" first must not leave any state that affects the
    // subsequent call for "Aria" (or vice versa).
    expect(findMentionOffsets(text, "Aria")).toEqual(ariaOffsets);
  });

  it("returns an empty array when there are no matches", () => {
    expect(findMentionOffsets("Nothing to see here.", "Aria")).toEqual([]);
  });

  it("returns an empty array for empty text or empty alias", () => {
    expect(findMentionOffsets("", "Aria")).toEqual([]);
    expect(findMentionOffsets("Aria was here.", "")).toEqual([]);
  });

  it("escapes regex-special characters in the alias", () => {
    const text = "The ship named Sea+Star sailed north.";
    expect(findMentionOffsets(text, "Sea+Star")).toEqual([15]);
  });

  it("finds multiple occurrences across a longer text", () => {
    const text = "Aria ran. Then Aria stopped. Aria's blade was drawn.";
    expect(findMentionOffsets(text, "Aria")).toEqual([0, 15, 29]);
  });
});
