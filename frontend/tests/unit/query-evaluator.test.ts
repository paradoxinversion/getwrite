import { describe, it, expect } from "vitest";
import {
  evaluate,
  EvaluatorNotImplementedError,
  QueryCycleError,
} from "../../src/lib/models/query-evaluator";
import type { EvaluationInput } from "../../src/lib/models/query-evaluator";
import type { QueryContext } from "../../src/lib/models/query-intrinsics";
import type { ResourceBase, MetadataValue } from "../../src/lib/models/types";
import type { QueryAST } from "../../src/lib/models/query-ast";

// ── Fixtures ──────────────────────────────────────────────────────────────

const R1 = "aaaaaaaa-0000-4000-a000-000000000001";
const R2 = "aaaaaaaa-0000-4000-a000-000000000002";
const R3 = "aaaaaaaa-0000-4000-a000-000000000003";
const FOLDER_A = "ffffffff-0000-4000-a000-000000000001";
const TAG_1 = "tttttttt-0000-4000-a000-000000000001";
const TAG_2 = "tttttttt-0000-4000-a000-000000000002";
const ENTITY_A = "eeeeeeee-0000-4000-a000-000000000001";
const ENTITY_B = "eeeeeeee-0000-4000-a000-000000000002";

const r1: ResourceBase = {
  id: R1,
  slug: "scene-one",
  name: "Scene One",
  type: "text",
  folderId: FOLDER_A,
  orderIndex: 0,
  statuses: ["draft", "revised"],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-06-01T00:00:00.000Z",
};

const r2: ResourceBase = {
  id: R2,
  slug: "scene-two",
  name: "Scene Two",
  type: "image",
  folderId: null,
  orderIndex: 1,
  statuses: [],
  createdAt: "2024-03-01T00:00:00.000Z",
  updatedAt: undefined,
};

const r3: ResourceBase = {
  id: R3,
  slug: "scene-three",
  name: "Scene Three",
  type: "text",
  folderId: FOLDER_A,
  orderIndex: 2,
  statuses: ["published"],
  createdAt: "2024-05-01T00:00:00.000Z",
  updatedAt: "2024-07-01T00:00:00.000Z",
};

const sidecars: Record<string, Record<string, MetadataValue>> = {
  [R1]: {
    title: "A long chapter",
    wordCount: 1200,
    pov: { id: R2, name: "Bob" },
    tags: [
      { id: TAG_1, name: "Action" },
      { id: TAG_2, name: "Drama" },
    ],
    rating: 4,
    notes: "Contains dragon reference",
    active: true,
    score: 8.5,
  },
  [R2]: {
    title: "A short note",
    wordCount: 200,
    pov: null,
    active: false,
    score: 3.0,
  },
  [R3]: {
    title: "Medium chapter",
    wordCount: 600,
    pov: { id: R1, name: "Alice" },
    active: true,
    score: 6.0,
  },
};

const ctx: QueryContext = {
  config: {
    editorConfig: {},
    tags: [
      { id: TAG_1, name: "Action" },
      { id: TAG_2, name: "Drama" },
    ],
    tagAssignments: { [R1]: [TAG_1], [R3]: [TAG_1, TAG_2] },
    statuses: ["draft", "revised", "published"],
  },
  backlinks: { [R1]: [R2, R3], [R2]: [R1], [R3]: [] },
  // ENTITY_A mentions R1 and R3; ENTITY_B mentions only R2.
  mentions: { [ENTITY_A]: [R1, R3], [ENTITY_B]: [R2] },
};

const resources = [r1, r2, r3];

function input(overrides?: Partial<EvaluationInput>): EvaluationInput {
  return { resources, sidecars, context: ctx, ...overrides };
}

async function ids(
  ast: QueryAST,
  inp?: Partial<EvaluationInput>,
): Promise<string[]> {
  return evaluate(ast, input(inp));
}

// ── eq predicate ──────────────────────────────────────────────────────────

describe("eq predicate", () => {
  it("matches a string sidecar field", async () => {
    const result = await ids({
      op: "eq",
      field: "title",
      value: "A long chapter",
    });
    expect(result).toEqual([R1]);
  });

  it("does not match when value differs", async () => {
    const result = await ids({ op: "eq", field: "title", value: "Nope" });
    expect(result).toEqual([]);
  });

  it("matches a number sidecar field", async () => {
    const result = await ids({ op: "eq", field: "score", value: 6.0 });
    expect(result).toEqual([R3]);
  });

  it("matches a boolean sidecar field", async () => {
    const result = await ids({ op: "eq", field: "active", value: true });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("matches resource-ref field by id string", async () => {
    const result = await ids({ op: "eq", field: "pov", value: R2 });
    expect(result).toEqual([R1]);
  });

  it("matches resource-ref field by ResourceRef object", async () => {
    const result = await ids({
      op: "eq",
      field: "pov",
      value: { id: R2, name: "Bob" },
    });
    expect(result).toEqual([R1]);
  });

  it("returns empty when field is missing from sidecar", async () => {
    const result = await ids({ op: "eq", field: "nonexistent", value: "x" });
    expect(result).toEqual([]);
  });

  it("matches intrinsic `type` field", async () => {
    const result = await ids({ op: "eq", field: "type", value: "text" });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("matches intrinsic `folderId` field by UUID string", async () => {
    const result = await ids({ op: "eq", field: "folderId", value: FOLDER_A });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });
});

// ── ne predicate ──────────────────────────────────────────────────────────

describe("ne predicate", () => {
  it("excludes matching resources", async () => {
    const result = await ids({ op: "ne", field: "type", value: "text" });
    expect(result).toEqual([R2]);
  });

  it("includes resources with missing field", async () => {
    const result = await ids({
      op: "ne",
      field: "nonexistent",
      value: "anything",
    });
    expect(result).toEqual([R1, R2, R3]);
  });
});

// ── FR7: query-continuity for hidden / removed fields ─────────────────────

describe("FR7 — querying field keys hidden or removed from the schema", () => {
  // The evaluator is schema-agnostic: EvaluationInput carries `resources`,
  // `sidecars`, and `context` — never a metadata schema. A field key that has
  // been removed or hidden from the schema therefore stays fully queryable as
  // long as its values remain in the sidecars (FR6 preserves them; FR7 keeps
  // them matchable). `removedField` below is intentionally absent from any
  // schema yet present in stored sidecar values.
  const legacyResources: ResourceBase[] = [{ ...r1 }, { ...r3 }];
  const legacySidecars: Record<string, Record<string, MetadataValue>> = {
    [R1]: { removedField: "legacy value" },
    [R3]: { removedField: "other value" },
  };

  it("matches resources by a removed/hidden field key that still has stored values", async () => {
    const result = await ids(
      { op: "eq", field: "removedField", value: "legacy value" },
      { resources: legacyResources, sidecars: legacySidecars },
    );
    expect(result).toEqual([R1]);
  });

  it("evaluates inequality on a removed field key independent of any schema", async () => {
    const result = await ids(
      { op: "ne", field: "removedField", value: "legacy value" },
      { resources: legacyResources, sidecars: legacySidecars },
    );
    expect(result).toEqual([R3]);
  });
});

// ── lt / gt / gte / lte predicates ───────────────────────────────────────

describe("comparison predicates on numbers", () => {
  it("lt selects resources below threshold", async () => {
    const result = await ids({ op: "lt", field: "score", value: 5.0 });
    expect(result).toEqual([R2]);
  });

  it("gt selects resources above threshold", async () => {
    const result = await ids({ op: "gt", field: "score", value: 6.0 });
    expect(result).toEqual([R1]);
  });

  it("gte includes the boundary", async () => {
    const result = await ids({ op: "gte", field: "score", value: 6.0 });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("lte includes the boundary", async () => {
    const result = await ids({ op: "lte", field: "score", value: 6.0 });
    expect(result).toContain(R2);
    expect(result).toContain(R3);
    expect(result).not.toContain(R1);
  });

  it("returns empty when field is missing", async () => {
    const result = await ids({ op: "lt", field: "nonexistent", value: 100 });
    expect(result).toEqual([]);
  });
});

describe("comparison predicates on dates (intrinsic)", () => {
  it("gt on createdAt filters by ISO date string", async () => {
    const result = await ids({
      op: "gt",
      field: "createdAt",
      value: "2024-02-01T00:00:00.000Z",
    });
    expect(result).toContain(R2);
    expect(result).toContain(R3);
    expect(result).not.toContain(R1);
  });

  it("lt on updatedAt filters by ISO date string", async () => {
    const result = await ids({
      op: "lt",
      field: "updatedAt",
      value: "2024-07-01T00:00:00.000Z",
    });
    expect(result).toEqual([R1]);
  });
});

// ── in predicate ──────────────────────────────────────────────────────────

describe("in predicate", () => {
  it("matches select-style field against value array", async () => {
    const result = await ids({
      op: "in",
      field: "type",
      value: ["text", "audio"],
    });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("matches resource-ref field by UUID strings in array", async () => {
    const result = await ids({ op: "in", field: "pov", value: [R1, R2] });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
  });

  it("matches multiselect-style field (any overlap)", async () => {
    const result = await ids({
      op: "in",
      field: "statuses",
      value: ["published", "archived"],
    });
    expect(result).toEqual([R3]);
  });

  it("returns empty when no items match", async () => {
    const result = await ids({ op: "in", field: "type", value: ["audio"] });
    expect(result).toEqual([]);
  });

  it("returns empty when field is missing", async () => {
    const result = await ids({ op: "in", field: "nonexistent", value: ["x"] });
    expect(result).toEqual([]);
  });

  it("matches multi-resource-ref array element by name when predicate is a plain string", async () => {
    // Simulates the QueryBuilder chip storing a typed name rather than a ResourceRef UUID.
    // R1 has pov = { id: R2, name: "Bob" } — querying by name "Bob" should match.
    const result = await ids({ op: "in", field: "pov", value: "Bob" });
    expect(result).toContain(R1);
    expect(result).not.toContain(R2);
    expect(result).not.toContain(R3);
  });

  it("name matching is case-insensitive", async () => {
    const result = await ids({ op: "in", field: "pov", value: "bob" });
    expect(result).toContain(R1);
  });

  it("matches a ResourceRef element in an array by name string predicate", async () => {
    // R1 has tags = [{ id: TAG_1, name: "Action" }, { id: TAG_2, name: "Drama" }]
    const result = await ids({ op: "in", field: "tags", value: "Action" });
    expect(result).toContain(R1);
    expect(result).not.toContain(R2);
  });
});

// ── exists predicate ──────────────────────────────────────────────────────

describe("exists predicate", () => {
  it("returns resources where field has a non-null value", async () => {
    const result = await ids({ op: "exists", field: "pov" });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("returns empty for a field absent from all sidecars", async () => {
    const result = await ids({ op: "exists", field: "completely-missing" });
    expect(result).toEqual([]);
  });

  it("returns empty when field is null", async () => {
    const result = await ids({ op: "exists", field: "pov" });
    // R2 has pov: null, should not be in result
    expect(result).not.toContain(R2);
  });

  it("returns empty when statuses is an empty array", async () => {
    const result = await ids({ op: "exists", field: "statuses" });
    // r2 has statuses: [] on resource, so the intrinsic returns []
    expect(result).not.toContain(R2);
  });

  it("matches intrinsic field when it has a value", async () => {
    const result = await ids({ op: "exists", field: "folderId" });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });
});

// ── contains / matches predicates ────────────────────────────────────────

describe("contains predicate (text fields)", () => {
  it("matches case-insensitively", async () => {
    const result = await ids({
      op: "contains",
      field: "title",
      value: "CHAPTER",
    });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("matches substring within longer string", async () => {
    const result = await ids({
      op: "contains",
      field: "notes",
      value: "dragon",
    });
    expect(result).toEqual([R1]);
  });

  it("returns empty when no fields match", async () => {
    const result = await ids({ op: "contains", field: "title", value: "zzz" });
    expect(result).toEqual([]);
  });

  it("returns empty for non-string field", async () => {
    const result = await ids({
      op: "contains",
      field: "wordCount",
      value: "12",
    });
    expect(result).toEqual([]);
  });
});

describe("matches predicate (regex on text fields)", () => {
  it("matches valid regex pattern", async () => {
    const result = await ids({ op: "matches", field: "title", value: "^A" });
    expect(result).toContain(R1);
    expect(result).toContain(R2);
    expect(result).not.toContain(R3);
  });

  it("returns empty for non-matching regex", async () => {
    const result = await ids({ op: "matches", field: "title", value: "^ZZZ" });
    expect(result).toEqual([]);
  });

  it("returns empty for invalid regex without throwing", async () => {
    const result = await ids({
      op: "matches",
      field: "title",
      value: "[invalid",
    });
    expect(result).toEqual([]);
  });
});

// ── linksTo / linkedFrom predicates ──────────────────────────────────────

describe("linksTo predicate", () => {
  it("matches resources that link to the specified id", async () => {
    const result = await ids({ op: "linksTo", id: R2 });
    expect(result).toEqual([R1]);
  });

  it("returns empty when nothing links to the specified id", async () => {
    const result = await ids({ op: "linksTo", id: TAG_1 });
    expect(result).toEqual([]);
  });
});

describe("linkedFrom predicate", () => {
  it("matches resources that are linked from the specified id", async () => {
    const result = await ids({ op: "linkedFrom", id: R1 });
    expect(result).toContain(R2);
    expect(result).toContain(R3);
  });

  it("returns empty when the source has no outgoing links", async () => {
    const result = await ids({ op: "linkedFrom", id: R3 });
    expect(result).toEqual([]);
  });
});

// ── boolean composition ───────────────────────────────────────────────────

describe("and combinator", () => {
  it("returns resources matching all children", async () => {
    const result = await ids({
      op: "and",
      children: [
        { op: "eq", field: "type", value: "text" },
        { op: "gt", field: "score", value: 7.0 },
      ],
    });
    expect(result).toEqual([R1]);
  });

  it("returns empty when no resource satisfies all conditions", async () => {
    const result = await ids({
      op: "and",
      children: [
        { op: "eq", field: "type", value: "image" },
        { op: "gt", field: "wordCount", value: 500 },
      ],
    });
    expect(result).toEqual([]);
  });

  it("returns all resources for empty children list", async () => {
    const result = await ids({ op: "and", children: [] });
    expect(result).toHaveLength(3);
  });
});

describe("or combinator", () => {
  it("returns resources matching any child", async () => {
    const result = await ids({
      op: "or",
      children: [
        { op: "eq", field: "type", value: "image" },
        { op: "lt", field: "wordCount", value: 300 },
      ],
    });
    expect(result).toContain(R2);
  });

  it("returns empty for empty children list", async () => {
    const result = await ids({ op: "or", children: [] });
    expect(result).toEqual([]);
  });
});

describe("not combinator", () => {
  it("inverts the child predicate", async () => {
    const result = await ids({
      op: "not",
      child: { op: "eq", field: "type", value: "text" },
    });
    expect(result).toEqual([R2]);
  });

  it("not of a false predicate matches everything", async () => {
    const result = await ids({
      op: "not",
      child: { op: "eq", field: "type", value: "audio" },
    });
    expect(result).toHaveLength(3);
  });
});

describe("nested boolean composition", () => {
  it("and(or(...), ...) composes correctly", async () => {
    const result = await ids({
      op: "and",
      children: [
        {
          op: "or",
          children: [
            { op: "eq", field: "type", value: "text" },
            { op: "eq", field: "type", value: "image" },
          ],
        },
        { op: "gt", field: "score", value: 7.0 },
      ],
    });
    expect(result).toEqual([R1]);
  });
});

// ── ref node — no resolveRef (backward compat) ────────────────────────────

describe("ref node — no resolveRef", () => {
  it("throws EvaluatorNotImplementedError when resolveRef is not provided", async () => {
    await expect(ids({ op: "ref", id: "some-saved-query-id" })).rejects.toThrow(
      EvaluatorNotImplementedError,
    );
  });
});

// ── ref node — with resolveRef ─────────────────────────────────────────────

const Q_TEXT = "q1111111-0000-4000-a000-000000000001";
const Q_IMAGE = "q2222222-0000-4000-a000-000000000002";
const Q_MISSING = "qmissing-0000-4000-a000-000000000099";

/** Simple resolveRef that returns canned definitions for known query IDs. */
function makeResolver(
  entries: Record<string, QueryAST>,
): (id: string) => Promise<QueryAST | null> {
  return async (id) => entries[id] ?? null;
}

describe("ref node — with resolveRef", () => {
  it("transparently splices a single-hop ref", async () => {
    const resolveRef = makeResolver({
      [Q_TEXT]: { op: "eq", field: "type", value: "text" },
    });
    const result = await evaluate(
      { op: "ref", id: Q_TEXT },
      input({ resolveRef }),
    );
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("splices a ref nested inside an `and` combinator", async () => {
    const resolveRef = makeResolver({
      [Q_TEXT]: { op: "eq", field: "type", value: "text" },
    });
    // and([ref(Q_TEXT), eq(active, true)]) — text resources where active=true
    const result = await evaluate(
      {
        op: "and",
        children: [
          { op: "ref", id: Q_TEXT },
          { op: "eq", field: "active", value: true },
        ],
      },
      input({ resolveRef }),
    );
    expect(result).toContain(R1); // text + active=true
    expect(result).toContain(R3); // text + active=true
    expect(result).not.toContain(R2); // image
  });

  it("splices a ref nested inside a `not` combinator", async () => {
    const resolveRef = makeResolver({
      [Q_TEXT]: { op: "eq", field: "type", value: "text" },
    });
    // not(ref(Q_TEXT)) — non-text resources
    const result = await evaluate(
      { op: "not", child: { op: "ref", id: Q_TEXT } },
      input({ resolveRef }),
    );
    expect(result).toContain(R2);
    expect(result).not.toContain(R1);
    expect(result).not.toContain(R3);
  });

  it("resolves a two-hop chain (A refs B which is a leaf)", async () => {
    const resolveRef = makeResolver({
      [Q_TEXT]: { op: "ref", id: Q_IMAGE },
      [Q_IMAGE]: { op: "eq", field: "type", value: "image" },
    });
    const result = await evaluate(
      { op: "ref", id: Q_TEXT },
      input({ resolveRef }),
    );
    expect(result).toEqual([R2]);
  });

  it("throws QueryCycleError for a direct self-cycle (A → A)", async () => {
    const resolveRef = makeResolver({ [Q_TEXT]: { op: "ref", id: Q_TEXT } });
    await expect(
      evaluate({ op: "ref", id: Q_TEXT }, input({ resolveRef })),
    ).rejects.toThrow(QueryCycleError);
  });

  it("throws QueryCycleError for a two-node cycle (A → B → A)", async () => {
    const resolveRef = makeResolver({
      [Q_TEXT]: { op: "ref", id: Q_IMAGE },
      [Q_IMAGE]: { op: "ref", id: Q_TEXT },
    });
    await expect(
      evaluate({ op: "ref", id: Q_TEXT }, input({ resolveRef })),
    ).rejects.toThrow(QueryCycleError);
  });

  it("QueryCycleError message includes the cycle path", async () => {
    const resolveRef = makeResolver({
      [Q_TEXT]: { op: "ref", id: Q_IMAGE },
      [Q_IMAGE]: { op: "ref", id: Q_TEXT },
    });
    const err = await evaluate(
      { op: "ref", id: Q_TEXT },
      input({ resolveRef }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QueryCycleError);
    const msg = (err as QueryCycleError).message;
    expect(msg).toContain(Q_TEXT);
    expect(msg).toContain(Q_IMAGE);
  });

  it("throws a descriptive Error when the ref target is not found", async () => {
    const resolveRef = makeResolver({});
    await expect(
      evaluate({ op: "ref", id: Q_MISSING }, input({ resolveRef })),
    ).rejects.toThrow(/not found/i);
  });
});

describe("param node", () => {
  it("throws EvaluatorNotImplementedError", async () => {
    await expect(ids({ op: "param", name: "myParam" })).rejects.toThrow(
      EvaluatorNotImplementedError,
    );
  });
});

// ── intrinsic field coverage ──────────────────────────────────────────────

describe("intrinsic fields — evaluator integration", () => {
  it("wordCount intrinsic: lt matches TextResource below threshold", async () => {
    const TXT_ID = "text-r-wc-1";
    const txtResource: ResourceBase = {
      ...r1,
      id: TXT_ID,
      type: "text",
      wordCount: 800,
    } as ResourceBase;
    const result = await evaluate(
      { op: "lt", field: "wordCount", value: 1000 },
      input({
        resources: [txtResource, r2],
        sidecars: { [TXT_ID]: {}, [R2]: {} },
      }),
    );
    expect(result).toContain(TXT_ID);
    expect(result).not.toContain(R2); // image — wordCount intrinsic returns null
  });

  it("statuses intrinsic with `in` predicate", async () => {
    const result = await ids({ op: "in", field: "statuses", value: ["draft"] });
    expect(result).toContain(R1);
    expect(result).not.toContain(R2);
    expect(result).not.toContain(R3);
  });

  it("tags intrinsic with `in` predicate", async () => {
    const result = await ids({ op: "in", field: "tags", value: [TAG_2] });
    expect(result).toContain(R3);
    expect(result).not.toContain(R1);
    expect(result).not.toContain(R2);
  });

  it("linksTo intrinsic via linksTo predicate node", async () => {
    const result = await ids({ op: "linksTo", id: R3 });
    expect(result).toEqual([R1]);
  });

  it("linkedFrom intrinsic via linkedFrom predicate node", async () => {
    const result = await ids({ op: "linkedFrom", id: R2 });
    expect(result).toEqual([R1]);
  });

  it("mentions intrinsic with `in` predicate returns exactly the resources mentioning the entity", async () => {
    const result = await ids({
      op: "in",
      field: "mentions",
      value: [ENTITY_A],
    });
    expect(result).toEqual(expect.arrayContaining([R1, R3]));
    expect(result).toHaveLength(2);
    expect(result).not.toContain(R2);
  });

  it("mentions intrinsic with `in` predicate for a different entity", async () => {
    const result = await ids({
      op: "in",
      field: "mentions",
      value: [ENTITY_B],
    });
    expect(result).toEqual([R2]);
  });

  it("mentions intrinsic returns no resources for an entity with no mentions", async () => {
    const result = await ids({
      op: "in",
      field: "mentions",
      value: ["unmentioned-entity-uuid"],
    });
    expect(result).toEqual([]);
  });
});

// ── charCount intrinsic ────────────────────────────────────────────────────

describe("charCount intrinsic (TextResource)", () => {
  const CC_ID = "text-r-cc-1";
  const charResource: ResourceBase = {
    ...r1,
    id: CC_ID,
    type: "text",
    charCount: 4200,
  } as ResourceBase;

  it("gt matches TextResource above threshold", async () => {
    const result = await evaluate(
      { op: "gt", field: "charCount", value: 4000 },
      input({
        resources: [charResource, r2],
        sidecars: { [CC_ID]: {}, [R2]: {} },
      }),
    );
    expect(result).toContain(CC_ID);
    expect(result).not.toContain(R2);
  });

  it("returns empty for non-text resources", async () => {
    const result = await evaluate(
      { op: "lt", field: "charCount", value: 99999 },
      input({ resources: [r2], sidecars: { [R2]: {} } }),
    );
    expect(result).toEqual([]);
  });
});

// ── not(contains) — does-not-contain ─────────────────────────────────────

describe("not(contains) — does-not-contain", () => {
  it("excludes resources whose field contains the term", async () => {
    const result = await ids({
      op: "not",
      child: { op: "contains", field: "title", value: "chapter" },
    });
    expect(result).toEqual([R2]); // only "A short note" lacks "chapter"
  });

  it("includes resources with a missing field (not contains → true)", async () => {
    const result = await ids({
      op: "not",
      child: { op: "contains", field: "notes", value: "dragon" },
    });
    expect(result).toContain(R2); // notes absent → contains false → not true
    expect(result).toContain(R3); // notes absent
    expect(result).not.toContain(R1); // "Contains dragon reference"
  });
});

// ── not(in) — is-none-of / includes-none-of ───────────────────────────────

describe("not(in) — is-none-of (scalar) and includes-none-of (array)", () => {
  it("scalar: excludes resources whose field value is in the array", async () => {
    const result = await ids({
      op: "not",
      child: { op: "in", field: "type", value: ["text"] },
    });
    expect(result).toEqual([R2]);
  });

  it("multiselect: excludes resources with any matching element", async () => {
    const result = await ids({
      op: "not",
      child: { op: "in", field: "statuses", value: ["published"] },
    });
    expect(result).toContain(R1); // statuses: ["draft","revised"]
    expect(result).toContain(R2); // statuses: [] → evalIn false → not true
    expect(result).not.toContain(R3); // statuses: ["published"]
  });
});

// ── and([gte, lte]) — is-between ──────────────────────────────────────────

describe("and([gte, lte]) — is-between range", () => {
  it("number: selects resources within inclusive range", async () => {
    const result = await ids({
      op: "and",
      children: [
        { op: "gte", field: "score", value: 4.0 },
        { op: "lte", field: "score", value: 7.0 },
      ],
    });
    expect(result).toEqual([R3]); // 6.0 ∈ [4, 7]; R1=8.5 > 7; R2=3.0 < 4
  });

  it("date: selects resources within date range", async () => {
    const result = await ids({
      op: "and",
      children: [
        { op: "gte", field: "createdAt", value: "2024-02-01T00:00:00.000Z" },
        { op: "lte", field: "createdAt", value: "2024-04-30T00:00:00.000Z" },
      ],
    });
    expect(result).toEqual([R2]); // 2024-03-01 is in range; R1=2024-01-01; R3=2024-05-01
  });

  it("excludes all when range is inverted (gte > lte)", async () => {
    const result = await ids({
      op: "and",
      children: [
        { op: "gte", field: "score", value: 10 },
        { op: "lte", field: "score", value: 1 },
      ],
    });
    expect(result).toEqual([]);
  });
});

// ── multi-resource-ref patterns for tags ──────────────────────────────────
// Fixture: R1→[TAG_1], R3→[TAG_1,TAG_2], R2→[]

describe("multi-resource-ref: includes-all-of / includes-any-of / includes-none-of via tags", () => {
  it("and([in,in]) — both tags required (includes-all-of)", async () => {
    const result = await ids({
      op: "and",
      children: [
        { op: "in", field: "tags", value: [TAG_1] },
        { op: "in", field: "tags", value: [TAG_2] },
      ],
    });
    expect(result).toEqual([R3]); // Only R3 has both TAG_1 and TAG_2
  });

  it("or([in,in]) — either tag matches (includes-any-of)", async () => {
    const result = await ids({
      op: "or",
      children: [
        { op: "in", field: "tags", value: [TAG_1] },
        { op: "in", field: "tags", value: [TAG_2] },
      ],
    });
    expect(result).toContain(R1); // has TAG_1
    expect(result).toContain(R3); // has both
    expect(result).not.toContain(R2); // no tags
  });

  it("not(or([in,in])) — neither tag (includes-none-of)", async () => {
    const result = await ids({
      op: "not",
      child: {
        op: "or",
        children: [
          { op: "in", field: "tags", value: [TAG_1] },
          { op: "in", field: "tags", value: [TAG_2] },
        ],
      },
    });
    expect(result).toEqual([R2]); // R2 has no tags
  });

  it("exists on tags returns false for resources with no assignments", async () => {
    const result = await ids({ op: "exists", field: "tags" });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("not(exists) on tags matches resources with no tag assignments", async () => {
    const result = await ids({
      op: "not",
      child: { op: "exists", field: "tags" },
    });
    expect(result).toEqual([R2]);
  });
});

// ── ResourceRef with id: null (deleted target) ────────────────────────────

describe("ResourceRef with id: null — deleted reference edge cases", () => {
  const deletedPov = { id: null as null, name: "Deleted Character" };
  const sidecarWithDeleted: Record<string, Record<string, MetadataValue>> = {
    ...sidecars,
    [R1]: { ...sidecars[R1], pov: deletedPov },
  };

  it("eq never matches a null-id ResourceRef", async () => {
    const result = await ids(
      { op: "eq", field: "pov", value: R2 },
      { sidecars: sidecarWithDeleted },
    );
    expect(result).not.toContain(R1);
  });

  it("exists returns true for a ResourceRef with null id (slot is populated)", async () => {
    const result = await ids(
      { op: "exists", field: "pov" },
      { sidecars: sidecarWithDeleted },
    );
    expect(result).toContain(R1); // {id:null, name:"..."} is a non-null object
  });

  it("in never matches a null-id ResourceRef against any candidate UUID", async () => {
    const result = await ids(
      { op: "in", field: "pov", value: [R1, R2] },
      { sidecars: sidecarWithDeleted },
    );
    expect(result).not.toContain(R1); // null id → no match
    expect(result).toContain(R3); // pov: { id: R1, name: "Alice" } → matches
  });

  it("ne returns false for null-id ref compared to any UUID (no match → ne is true)", async () => {
    const result = await ids(
      { op: "ne", field: "pov", value: R2 },
      { sidecars: sidecarWithDeleted },
    );
    expect(result).toContain(R1); // valuesEqual returns false → ne returns true
  });
});

// ── Additional intrinsic field coverage ───────────────────────────────────

describe("intrinsic fields — additional coverage", () => {
  it("ne on intrinsic type excludes matched resources", async () => {
    const result = await ids({ op: "ne", field: "type", value: "text" });
    expect(result).toEqual([R2]);
  });

  it("folderId: not(exists) matches root-level resources", async () => {
    const result = await ids({
      op: "not",
      child: { op: "exists", field: "folderId" },
    });
    expect(result).toEqual([R2]); // only R2 has folderId: null
  });

  it("folderId: in predicate matches resources in any listed folder", async () => {
    const OTHER_FOLDER = "ffffffff-0000-4000-a000-000000000002";
    const result = await ids({
      op: "in",
      field: "folderId",
      value: [FOLDER_A, OTHER_FOLDER],
    });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });

  it("updatedAt: undefined excluded from lt (compareValues returns null)", async () => {
    // r2 has updatedAt: undefined; r1 has 2024-06-01; r3 has 2024-07-01
    const result = await ids({
      op: "lt",
      field: "updatedAt",
      value: "2099-01-01T00:00:00.000Z",
    });
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2); // undefined → null → compareValues returns null → false
  });

  it("ne on missing field includes all resources", async () => {
    const result = await ids({
      op: "ne",
      field: "nonexistent",
      value: "anything",
    });
    expect(result).toEqual([R1, R2, R3]);
  });
});

// ── or result ordering and deduplication ─────────────────────────────────

describe("or result ordering", () => {
  it("result preserves resource order and contains no duplicates", async () => {
    const result = await ids({
      op: "or",
      children: [
        { op: "eq", field: "type", value: "text" },
        { op: "gt", field: "score", value: 5.0 },
      ],
    });
    // R1: text + score 8.5 → matches both; should appear once
    // R2: image + score 3.0 → matches neither
    // R3: text + score 6.0 → matches both
    const uniqueSet = new Set(result);
    expect(uniqueSet.size).toBe(result.length);
    expect(result).toContain(R1);
    expect(result).toContain(R3);
    expect(result).not.toContain(R2);
  });
});

// ── exists semantics across value types ───────────────────────────────────

describe("exists semantics across value types", () => {
  it("empty string is not considered 'exists'", async () => {
    const emptyStrSidecars: Record<string, Record<string, MetadataValue>> = {
      ...sidecars,
      [R1]: { ...sidecars[R1], title: "" },
    };
    const result = await ids(
      { op: "exists", field: "title" },
      { sidecars: emptyStrSidecars },
    );
    expect(result).not.toContain(R1);
    expect(result).toContain(R2);
  });

  it("boolean false is considered 'exists' (field is set, just false)", async () => {
    const result = await ids({ op: "exists", field: "active" });
    expect(result).toContain(R1); // active: true
    expect(result).toContain(R2); // active: false — still exists
    expect(result).toContain(R3); // active: true — also exists
  });

  it("not(exists) — is-empty — matches missing and null fields", async () => {
    const result = await ids({
      op: "not",
      child: { op: "exists", field: "pov" },
    });
    expect(result).toContain(R2); // pov: null
    expect(result).not.toContain(R1); // pov: { id: R2, name: "Bob" }
    expect(result).not.toContain(R3); // pov: { id: R1, name: "Alice" }
  });

  it("not(exists) matches resources where field is absent from sidecar", async () => {
    // notes field only exists for R1
    const result = await ids({
      op: "not",
      child: { op: "exists", field: "notes" },
    });
    expect(result).toContain(R2);
    expect(result).toContain(R3);
    expect(result).not.toContain(R1);
  });
});
