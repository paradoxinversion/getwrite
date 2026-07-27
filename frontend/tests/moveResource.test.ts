import { describe, it, expect } from "vitest";
import {
  computeMovePayload,
  collectDescendantIds,
} from "../components/ResourceTree/moveResource";
import type { AnyResource } from "../src/lib/models/types";

/** Minimal resource/folder factories for reparenting tests. */
function folder(
  id: string,
  parentId: string | null,
  orderIndex: number,
): AnyResource {
  return {
    id,
    name: id,
    type: "folder",
    parentId,
    folderId: parentId,
    orderIndex,
  } as unknown as AnyResource;
}

function doc(
  id: string,
  folderId: string | null,
  orderIndex: number,
): AnyResource {
  return {
    id,
    name: id,
    type: "text",
    folderId,
    orderIndex,
  } as unknown as AnyResource;
}

describe("collectDescendantIds", () => {
  it("collects nested descendants of a folder", () => {
    const all = [
      folder("f1", null, 0),
      folder("f2", "f1", 0),
      doc("d1", "f2", 0),
      doc("d2", null, 1),
    ];
    const descendants = collectDescendantIds(all, "f1");
    expect(descendants).toEqual(new Set(["f2", "d1"]));
  });
});

describe("computeMovePayload", () => {
  it("moves a document into a folder and appends it after existing children", () => {
    const all = [
      folder("f1", null, 0),
      doc("existing", "f1", 0),
      doc("moving", null, 1),
    ];
    const payload = computeMovePayload(all, "moving", "f1");
    expect(payload).not.toBeNull();
    expect(payload!.resourceOrder).toEqual([
      { id: "existing", orderIndex: 0, folderId: "f1" },
      { id: "moving", orderIndex: 1, folderId: "f1" },
    ]);
    // Leaving the root re-sequences the root's remaining children (just f1).
    expect(payload!.folderOrder).toEqual([
      { id: "f1", orderIndex: 0, parentId: null, folderId: null },
    ]);
  });

  it("re-sequences the old parent when the parent changes", () => {
    const all = [
      folder("dest", null, 0),
      doc("a", "src", 0),
      doc("moving", "src", 1),
      doc("b", "src", 2),
      folder("src", null, 1),
    ];
    const payload = computeMovePayload(all, "moving", "dest")!;
    // Destination gets the moved item at the end.
    expect(payload.resourceOrder).toContainEqual({
      id: "moving",
      orderIndex: 0,
      folderId: "dest",
    });
    // Old parent "src" is re-sequenced without the moved item.
    expect(payload.resourceOrder).toContainEqual({
      id: "a",
      orderIndex: 0,
      folderId: "src",
    });
    expect(payload.resourceOrder).toContainEqual({
      id: "b",
      orderIndex: 1,
      folderId: "src",
    });
  });

  it("moves a folder to the root with null parent", () => {
    const all = [folder("parent", null, 0), folder("moving", "parent", 0)];
    const payload = computeMovePayload(all, "moving", null)!;
    // Appended to root after the existing "parent" folder.
    expect(payload.folderOrder).toContainEqual({
      id: "moving",
      orderIndex: 1,
      parentId: null,
      folderId: null,
    });
  });

  it("returns null when moving a folder into itself", () => {
    const all = [folder("f1", null, 0)];
    expect(computeMovePayload(all, "f1", "f1")).toBeNull();
  });

  it("returns null when moving a folder into one of its descendants", () => {
    const all = [folder("f1", null, 0), folder("f2", "f1", 0)];
    expect(computeMovePayload(all, "f1", "f2")).toBeNull();
  });

  it("returns null for an unknown item", () => {
    expect(computeMovePayload([], "nope", null)).toBeNull();
  });
});
