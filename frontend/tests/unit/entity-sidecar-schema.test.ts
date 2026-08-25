import { describe, it, expect } from "vitest";
import {
  EntitySidecarFieldsSchema,
  ResourceBaseSchema,
} from "../../src/lib/models/schemas";

const baseResourceFields = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  slug: "some-resource",
  name: "Some Resource",
  type: "text" as const,
  orderIndex: 0,
  createdAt: "2026-08-25T00:00:00.000Z",
};

describe("EntitySidecarFieldsSchema", () => {
  it("accepts an arbitrary, unlisted entityKind (e.g. 'faction') identically to well-known kinds", () => {
    const factionResult = EntitySidecarFieldsSchema.safeParse({
      entityKind: "faction",
      aliases: ["The Order"],
    });
    const characterResult = EntitySidecarFieldsSchema.safeParse({
      entityKind: "character",
      aliases: ["Ada"],
    });

    expect(factionResult.success).toBe(true);
    expect(characterResult.success).toBe(true);
  });

  it("accepts a sidecar with no entityKind at all (plain, non-entity resource)", () => {
    const result = EntitySidecarFieldsSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityKind).toBeUndefined();
      expect(result.data.aliases).toBeUndefined();
    }
  });

  it("rejects an aliases list containing an empty string", () => {
    const result = EntitySidecarFieldsSchema.safeParse({
      entityKind: "place",
      aliases: ["Central City", ""],
    });

    expect(result.success).toBe(false);
  });

  it("preserves aliases order through parse", () => {
    const orderedAliases = ["Third", "First", "Second"];
    const result = EntitySidecarFieldsSchema.safeParse({
      entityKind: "object",
      aliases: orderedAliases,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aliases).toEqual(orderedAliases);
    }
  });

  it("does not constrain entityKind to a fixed enum of values", () => {
    const result = EntitySidecarFieldsSchema.safeParse({
      entityKind: "mechanic",
    });

    expect(result.success).toBe(true);
  });
});

describe("ResourceBaseSchema entity fields integration", () => {
  it("validates a resource sidecar carrying entityKind and aliases", () => {
    const result = ResourceBaseSchema.safeParse({
      ...baseResourceFields,
      entityKind: "faction",
      aliases: ["The Order", "The Brotherhood"],
    });

    expect(result.success).toBe(true);
  });

  it("still validates a plain resource sidecar with no entity fields", () => {
    const result = ResourceBaseSchema.safeParse({ ...baseResourceFields });

    expect(result.success).toBe(true);
  });
});
