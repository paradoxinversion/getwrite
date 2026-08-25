import { describe, it, expect } from "vitest";
import {
  INTRINSIC_FIELDS,
  INTRINSIC_FIELD_KEYS,
  getIntrinsicField,
} from "../../src/lib/models/query-intrinsics";
import type { QueryContext } from "../../src/lib/models/query-intrinsics";
import type { TextResource, ResourceBase } from "../../src/lib/models/types";

// ── minimal fixtures ──────────────────────────────────────────────────────

const RESOURCE_ID = "resource-uuid-1";
const FOLDER_ID = "folder-uuid-1";
const TAG_ID_1 = "tag-uuid-1";
const TAG_ID_2 = "tag-uuid-2";
const ENTITY_ID_1 = "entity-uuid-1";
const ENTITY_ID_2 = "entity-uuid-2";

const baseResource: ResourceBase = {
  id: RESOURCE_ID,
  slug: "scene-1",
  name: "Scene 1",
  type: "text",
  folderId: FOLDER_ID,
  orderIndex: 0,
  statuses: ["draft"],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-06-01T00:00:00.000Z",
};

const textResource: TextResource = {
  ...baseResource,
  type: "text",
  wordCount: 420,
  charCount: 2100,
};

const imageResource: ResourceBase = {
  ...baseResource,
  id: "resource-uuid-img",
  type: "image",
};

const ctx: QueryContext = {
  config: {
    editorConfig: {},
    tags: [
      { id: TAG_ID_1, name: "Draft" },
      { id: TAG_ID_2, name: "Published" },
    ],
    tagAssignments: { [RESOURCE_ID]: [TAG_ID_1, TAG_ID_2] },
    statuses: ["draft", "published"],
  },
  backlinks: {
    // RESOURCE_ID links to two targets
    [RESOURCE_ID]: ["target-uuid-1", "target-uuid-2"],
    // two other resources link to RESOURCE_ID
    "source-uuid-a": [RESOURCE_ID],
    "source-uuid-b": [RESOURCE_ID, "target-uuid-1"],
  },
  mentions: {
    // RESOURCE_ID is mentioned by two entities
    [ENTITY_ID_1]: [RESOURCE_ID, "other-resource-uuid"],
    [ENTITY_ID_2]: [RESOURCE_ID],
  },
};

// ── registry shape ────────────────────────────────────────────────────────

describe("INTRINSIC_FIELDS registry", () => {
  const EXPECTED_KEYS = [
    "type",
    "folderId",
    "wordCount",
    "charCount",
    "createdAt",
    "updatedAt",
    "statuses",
    "tags",
    "linkedFrom",
    "linksTo",
    "mentions",
  ] as const;

  it("exports all expected intrinsic field keys", () => {
    const keys = INTRINSIC_FIELDS.map((f) => f.key);
    for (const k of EXPECTED_KEYS) {
      expect(keys).toContain(k);
    }
  });

  it("each field has a non-empty label", () => {
    for (const field of INTRINSIC_FIELDS) {
      expect(field.label.length).toBeGreaterThan(0);
    }
  });

  it("each field has a valid MetadataFieldType", () => {
    const validTypes = new Set([
      "text",
      "number",
      "date",
      "boolean",
      "select",
      "multiselect",
      "resource-ref",
      "multi-resource-ref",
    ]);
    for (const field of INTRINSIC_FIELDS) {
      expect(validTypes.has(field.type)).toBe(true);
    }
  });

  it("each field has a valid source", () => {
    const validSources = new Set([
      "resource",
      "sidecar",
      "config",
      "backlinks",
      "mentions",
    ]);
    for (const field of INTRINSIC_FIELDS) {
      expect(validSources.has(field.source)).toBe(true);
    }
  });

  it("INTRINSIC_FIELD_KEYS set matches INTRINSIC_FIELDS keys", () => {
    for (const field of INTRINSIC_FIELDS) {
      expect(INTRINSIC_FIELD_KEYS.has(field.key)).toBe(true);
    }
    expect(INTRINSIC_FIELD_KEYS.size).toBe(INTRINSIC_FIELDS.length);
  });
});

describe("getIntrinsicField", () => {
  it("returns the field for a known key", () => {
    const field = getIntrinsicField("type");
    expect(field).toBeDefined();
    expect(field?.key).toBe("type");
  });

  it("returns undefined for an unknown key", () => {
    expect(getIntrinsicField("nonexistent")).toBeUndefined();
  });

  it("returns undefined for a declared-schema key (empty string)", () => {
    expect(getIntrinsicField("")).toBeUndefined();
  });
});

// ── read accessors ────────────────────────────────────────────────────────

describe("type field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "type")!;

  it("returns the resource type string", () => {
    expect(field.read(baseResource, ctx)).toBe("text");
  });

  it("returns 'image' for an image resource", () => {
    expect(field.read(imageResource, ctx)).toBe("image");
  });
});

describe("folderId field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "folderId")!;

  it("returns a ResourceRef when folderId is set", () => {
    const result = field.read(baseResource, ctx);
    expect(result).toEqual({ id: FOLDER_ID, name: "" });
  });

  it("returns null when folderId is undefined", () => {
    const noFolder: ResourceBase = { ...baseResource, folderId: undefined };
    expect(field.read(noFolder, ctx)).toBeNull();
  });

  it("returns null when folderId is explicitly null", () => {
    const noFolder: ResourceBase = { ...baseResource, folderId: null };
    expect(field.read(noFolder, ctx)).toBeNull();
  });
});

describe("wordCount field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "wordCount")!;

  it("returns the word count for a text resource", () => {
    expect(field.read(textResource, ctx)).toBe(420);
  });

  it("returns null for a non-text resource", () => {
    expect(field.read(imageResource, ctx)).toBeNull();
  });

  it("returns null when wordCount is not set on a text resource", () => {
    const sparse: ResourceBase = { ...baseResource, type: "text" };
    expect(field.read(sparse, ctx)).toBeNull();
  });
});

describe("charCount field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "charCount")!;

  it("returns the char count for a text resource", () => {
    expect(field.read(textResource, ctx)).toBe(2100);
  });

  it("returns null for a non-text resource", () => {
    expect(field.read(imageResource, ctx)).toBeNull();
  });

  it("returns null when charCount is not set on a text resource", () => {
    const sparse: ResourceBase = { ...baseResource, type: "text" };
    expect(field.read(sparse, ctx)).toBeNull();
  });
});

describe("createdAt field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "createdAt")!;

  it("returns the ISO creation timestamp", () => {
    expect(field.read(baseResource, ctx)).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("updatedAt field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "updatedAt")!;

  it("returns the ISO update timestamp when set", () => {
    expect(field.read(baseResource, ctx)).toBe("2024-06-01T00:00:00.000Z");
  });

  it("returns null when updatedAt is not set", () => {
    const noUpdate: ResourceBase = { ...baseResource, updatedAt: undefined };
    expect(field.read(noUpdate, ctx)).toBeNull();
  });
});

describe("statuses field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "statuses")!;

  it("returns the statuses array", () => {
    expect(field.read(baseResource, ctx)).toEqual(["draft"]);
  });

  it("returns an empty array when statuses is not set", () => {
    const noStatuses: ResourceBase = { ...baseResource, statuses: undefined };
    expect(field.read(noStatuses, ctx)).toEqual([]);
  });
});

describe("tags field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "tags")!;

  it("returns ResourceRef array for assigned tags with resolved names", () => {
    const result = field.read(baseResource, ctx) as Array<{
      id: string;
      name: string;
    }>;
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ id: TAG_ID_1, name: "Draft" });
    expect(result).toContainEqual({ id: TAG_ID_2, name: "Published" });
  });

  it("returns an empty array when no tags are assigned", () => {
    const noTagCtx: QueryContext = {
      ...ctx,
      config: { ...ctx.config, tagAssignments: {} },
    };
    expect(field.read(baseResource, noTagCtx)).toEqual([]);
  });

  it("returns an empty array when tagAssignments is absent", () => {
    const noAssignCtx: QueryContext = {
      ...ctx,
      config: { ...ctx.config, tagAssignments: undefined },
    };
    expect(field.read(baseResource, noAssignCtx)).toEqual([]);
  });

  it("returns a ref with empty name when tag definition is missing", () => {
    const missingTagCtx: QueryContext = {
      ...ctx,
      config: {
        ...ctx.config,
        tags: [],
        tagAssignments: { [RESOURCE_ID]: [TAG_ID_1] },
      },
    };
    const result = field.read(baseResource, missingTagCtx) as Array<{
      id: string;
      name: string;
    }>;
    expect(result).toEqual([{ id: TAG_ID_1, name: "" }]);
  });
});

describe("linkedFrom field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "linkedFrom")!;

  it("returns ResourceRef array of resources that link to this one", () => {
    const result = field.read(baseResource, ctx) as Array<{
      id: string;
      name: string;
    }>;
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    expect(ids).toContain("source-uuid-a");
    expect(ids).toContain("source-uuid-b");
  });

  it("each returned ref has an empty name (names not in BacklinkIndex)", () => {
    const result = field.read(baseResource, ctx) as Array<{
      id: string;
      name: string;
    }>;
    for (const ref of result) {
      expect(ref.name).toBe("");
    }
  });

  it("returns an empty array when nothing links to this resource", () => {
    const isolated: ResourceBase = { ...baseResource, id: "isolated-uuid" };
    expect(field.read(isolated, ctx)).toEqual([]);
  });

  it("returns an empty array when backlinks index is empty", () => {
    const emptyCtx: QueryContext = { ...ctx, backlinks: {} };
    expect(field.read(baseResource, emptyCtx)).toEqual([]);
  });
});

describe("linksTo field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "linksTo")!;

  it("returns ResourceRef array of resources this one links to", () => {
    const result = field.read(baseResource, ctx) as Array<{
      id: string;
      name: string;
    }>;
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ id: "target-uuid-1", name: "" });
    expect(result).toContainEqual({ id: "target-uuid-2", name: "" });
  });

  it("returns an empty array when this resource has no outgoing links", () => {
    const noLinks: ResourceBase = { ...baseResource, id: "no-links-uuid" };
    expect(field.read(noLinks, ctx)).toEqual([]);
  });

  it("returns an empty array when backlinks index is empty", () => {
    const emptyCtx: QueryContext = { ...ctx, backlinks: {} };
    expect(field.read(baseResource, emptyCtx)).toEqual([]);
  });
});

describe("mentions field", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "mentions")!;

  it("returns ResourceRef array of entities that mention this resource", () => {
    const result = field.read(baseResource, ctx) as Array<{
      id: string;
      name: string;
    }>;
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    expect(ids).toContain(ENTITY_ID_1);
    expect(ids).toContain(ENTITY_ID_2);
  });

  it("each returned ref has an empty name (names not in the mention index)", () => {
    const result = field.read(baseResource, ctx) as Array<{
      id: string;
      name: string;
    }>;
    for (const ref of result) {
      expect(ref.name).toBe("");
    }
  });

  it("returns an empty array when no entity mentions this resource", () => {
    const unmentioned: ResourceBase = {
      ...baseResource,
      id: "unmentioned-uuid",
    };
    expect(field.read(unmentioned, ctx)).toEqual([]);
  });

  it("returns an empty array when the mention index is empty", () => {
    const emptyCtx: QueryContext = { ...ctx, mentions: {} };
    expect(field.read(baseResource, emptyCtx)).toEqual([]);
  });
});

describe("type field options", () => {
  const field = INTRINSIC_FIELDS.find((f) => f.key === "type")!;

  it("declares the resource-type values as select options", () => {
    expect(field.type).toBe("select");
    expect(field.options).toEqual(["text", "image", "audio", "folder"]);
  });
});
