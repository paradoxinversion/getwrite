import { describe, it, expect } from "vitest";
import type { AnyResource } from "../../src/lib/models/types";
import {
  buildCompileTree,
  getDescendantLeafIds,
  toggleNode,
  isFolderChecked,
  isFolderIndeterminate,
  initAllChecked,
  orderResourceIdsByTreePosition,
  ROOT_ITEM_ID,
} from "../../components/common/compileSelection";

// Fixture: 1 top-level folder (f1) with 2 docs (r1, r2),
//          1 nested folder (f2, inside f1) with 1 doc (r3),
//          1 top-level doc (r4).
const resources: AnyResource[] = [
  {
    id: "f1",
    slug: "chapter-1",
    name: "Chapter 1",
    type: "folder",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    orderIndex: 0,
  },
  {
    id: "r1",
    slug: "scene-1",
    name: "Scene 1",
    type: "text",
    plainText: "",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    folderId: "f1",
    orderIndex: 0,
  },
  {
    id: "r2",
    slug: "scene-2",
    name: "Scene 2",
    type: "text",
    plainText: "",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    folderId: "f1",
    orderIndex: 1,
  },
  {
    id: "f2",
    slug: "notes",
    name: "Notes",
    type: "folder",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    folderId: "f1",
    orderIndex: 2,
  },
  {
    id: "r3",
    slug: "note-1",
    name: "Note 1",
    type: "text",
    plainText: "",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    folderId: "f2",
    orderIndex: 0,
  },
  {
    id: "r4",
    slug: "epilogue",
    name: "Epilogue",
    type: "text",
    plainText: "",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    orderIndex: 1,
  },
] as AnyResource[];

describe("buildCompileTree", () => {
  it("returns a record containing the root node", () => {
    const tree = buildCompileTree(resources);
    expect(tree[ROOT_ITEM_ID]).toBeDefined();
    expect(tree[ROOT_ITEM_ID].isFolder).toBe(true);
  });

  it("handles an empty resources array", () => {
    const tree = buildCompileTree([]);
    expect(tree[ROOT_ITEM_ID]).toBeDefined();
    expect(tree[ROOT_ITEM_ID].children).toHaveLength(0);
  });

  it("places top-level resources as children of root", () => {
    const tree = buildCompileTree(resources);
    expect(tree[ROOT_ITEM_ID].children).toContain("f1");
    expect(tree[ROOT_ITEM_ID].children).toContain("r4");
  });

  it("nests child resources under their folder", () => {
    const tree = buildCompileTree(resources);
    expect(tree["f1"].children).toContain("r1");
    expect(tree["f1"].children).toContain("r2");
    expect(tree["f1"].children).toContain("f2");
    expect(tree["f2"].children).toContain("r3");
  });
});

describe("getDescendantLeafIds", () => {
  const tree = buildCompileTree(resources);

  it("returns [nodeId] when the node is a leaf", () => {
    expect(getDescendantLeafIds("r1", tree)).toEqual(["r1"]);
  });

  it("returns direct leaf children of a folder", () => {
    const leaves = getDescendantLeafIds("f2", tree);
    expect(leaves).toContain("r3");
    expect(leaves).not.toContain("f2");
  });

  it("recursively returns leaf descendants of nested folders", () => {
    const leaves = getDescendantLeafIds("f1", tree);
    expect(leaves).toContain("r1");
    expect(leaves).toContain("r2");
    expect(leaves).toContain("r3");
  });

  it("does not include folder IDs in the result", () => {
    const leaves = getDescendantLeafIds("f1", tree);
    expect(leaves).not.toContain("f1");
    expect(leaves).not.toContain("f2");
  });

  it("returns empty array for an unknown nodeId", () => {
    expect(getDescendantLeafIds("unknown", tree)).toEqual([]);
  });
});

describe("toggleNode — leaf", () => {
  const tree = buildCompileTree(resources);

  it("adds leaf to checkedIds when unchecked", () => {
    const result = toggleNode("r1", new Set(), tree);
    expect(result.has("r1")).toBe(true);
  });

  it("removes leaf from checkedIds when checked", () => {
    const result = toggleNode("r1", new Set(["r1"]), tree);
    expect(result.has("r1")).toBe(false);
  });
});

describe("toggleNode — folder", () => {
  const tree = buildCompileTree(resources);
  const allLeaves = ["r1", "r2", "r3"];

  it("checks all leaf descendants when none are checked", () => {
    const result = toggleNode("f1", new Set(), tree);
    allLeaves.forEach((id) => expect(result.has(id)).toBe(true));
  });

  it("checks all leaf descendants when only some are checked (partial → all)", () => {
    const result = toggleNode("f1", new Set(["r1"]), tree);
    allLeaves.forEach((id) => expect(result.has(id)).toBe(true));
  });

  it("unchecks all leaf descendants when all are already checked", () => {
    const result = toggleNode("f1", new Set(allLeaves), tree);
    allLeaves.forEach((id) => expect(result.has(id)).toBe(false));
  });

  it("does not affect leaves outside the toggled folder", () => {
    const result = toggleNode("f1", new Set(["r4"]), tree);
    expect(result.has("r4")).toBe(true);
  });
});

describe("isFolderChecked", () => {
  const tree = buildCompileTree(resources);

  it("returns true when all leaf descendants are checked", () => {
    expect(isFolderChecked("f1", new Set(["r1", "r2", "r3"]), tree)).toBe(true);
  });

  it("returns false when no leaf descendants are checked", () => {
    expect(isFolderChecked("f1", new Set(), tree)).toBe(false);
  });

  it("returns false when only some leaf descendants are checked", () => {
    expect(isFolderChecked("f1", new Set(["r1"]), tree)).toBe(false);
  });
});

describe("isFolderIndeterminate", () => {
  const tree = buildCompileTree(resources);

  it("returns true when some but not all leaf descendants are checked", () => {
    expect(isFolderIndeterminate("f1", new Set(["r1"]), tree)).toBe(true);
  });

  it("returns false when all leaf descendants are checked", () => {
    expect(isFolderIndeterminate("f1", new Set(["r1", "r2", "r3"]), tree)).toBe(
      false,
    );
  });

  it("returns false when no leaf descendants are checked", () => {
    expect(isFolderIndeterminate("f1", new Set(), tree)).toBe(false);
  });
});

describe("initAllChecked", () => {
  const tree = buildCompileTree(resources);

  it("returns a Set containing all leaf IDs", () => {
    const result = initAllChecked(tree);
    expect(result.has("r1")).toBe(true);
    expect(result.has("r2")).toBe(true);
    expect(result.has("r3")).toBe(true);
    expect(result.has("r4")).toBe(true);
  });

  it("does not include folder IDs", () => {
    const result = initAllChecked(tree);
    expect(result.has("f1")).toBe(false);
    expect(result.has("f2")).toBe(false);
  });

  it("does not include the root item", () => {
    const result = initAllChecked(tree);
    expect(result.has(ROOT_ITEM_ID)).toBe(false);
  });

  it("returns empty Set when resources array has only folders and no leaves", () => {
    const folderOnly: AnyResource[] = [
      {
        id: "f1",
        slug: "f1",
        name: "Folder",
        type: "folder",
        createdAt: "",
        updatedAt: "",
        userMetadata: {},
      },
    ] as AnyResource[];
    const t = buildCompileTree(folderOnly);
    expect(initAllChecked(t).size).toBe(0);
  });
});

describe("orderResourceIdsByTreePosition", () => {
  it("orders a shuffled subset into tree order", () => {
    const result = orderResourceIdsByTreePosition(resources, [
      "r4",
      "r1",
      "r3",
    ]);
    expect(result).toEqual(["r1", "r3", "r4"]);
  });

  it("silently drops ids not present in the tree", () => {
    const result = orderResourceIdsByTreePosition(resources, [
      "r4",
      "unknown",
      "r1",
    ]);
    expect(result).toEqual(["r1", "r4"]);
  });

  it("collapses duplicate ids in the input", () => {
    const result = orderResourceIdsByTreePosition(resources, [
      "r1",
      "r1",
      "r4",
    ]);
    expect(result).toEqual(["r1", "r4"]);
  });

  it("returns an empty array for empty resourceIds input", () => {
    expect(orderResourceIdsByTreePosition(resources, [])).toEqual([]);
  });

  it("returns all leaves in tree order when the full set is passed unordered", () => {
    const result = orderResourceIdsByTreePosition(resources, [
      "r3",
      "r4",
      "r2",
      "r1",
    ]);
    expect(result).toEqual(["r1", "r2", "r3", "r4"]);
  });
});
