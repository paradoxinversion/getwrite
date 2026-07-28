import type { AnyResource, Folder } from "../../src/lib/models/types";

/**
 * Reparent payload shaped for `persistReorder` / `updateResources` /
 * `updateFolders`, mirroring the arrays `useResourceReorder` produces for
 * drag-and-drop. `null` parent means the project root.
 */
export interface MovePayload {
  folderOrder: Array<Partial<Folder> & { id: string }>;
  resourceOrder: Array<Partial<AnyResource> & { id: string }>;
}

/**
 * Resolves an item's current parent id the same way the tree does: folders
 * parent via `parentId ?? folderId`, other resources via `folderId`. Returns
 * `null` for root-level items. Mirrors `buildResourceTree.getEffectiveParentId`.
 */
function effectiveParentId(resource: AnyResource): string | null {
  const parent =
    resource.type === "folder"
      ? ((resource as Folder).parentId ?? resource.folderId)
      : resource.folderId;
  return parent ?? null;
}

/**
 * Collects every descendant id of `rootId` (folders and resources), so a
 * folder can never be moved into itself or one of its own descendants.
 */
export function collectDescendantIds(
  all: AnyResource[],
  rootId: string,
): Set<string> {
  const descendants = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const item of all) {
      if (item.id === current) continue;
      if (effectiveParentId(item) === current && !descendants.has(item.id)) {
        descendants.add(item.id);
        stack.push(item.id);
      }
    }
  }
  return descendants;
}

/**
 * Computes the reorder payload to move `movingId` under `destParentId`
 * (`null` = root), appending it to the destination's children and
 * re-sequencing both the destination and (if different) the old parent so
 * `orderIndex` stays contiguous.
 *
 * Returns `null` when the move is a no-op or invalid — the item is missing, the
 * destination is already the item's parent, or a folder would be dropped into
 * itself or a descendant.
 */
export function computeMovePayload(
  all: AnyResource[],
  movingId: string,
  destParentId: string | null,
): MovePayload | null {
  const moving = all.find((r) => r.id === movingId);
  if (!moving) return null;

  // No-op: dropping the item into the folder it already lives in would only
  // re-sequence its siblings and shuffle it to the bottom. Reparenting is the
  // point of "Move to…"; same-folder reordering happens via drag.
  if (effectiveParentId(moving) === destParentId) return null;

  if (destParentId !== null) {
    if (destParentId === movingId) return null;
    if (moving.type === "folder") {
      if (collectDescendantIds(all, movingId).has(destParentId)) return null;
    }
  }

  const folderOrder: MovePayload["folderOrder"] = [];
  const resourceOrder: MovePayload["resourceOrder"] = [];

  const pushOrder = (
    item: AnyResource,
    orderIndex: number,
    parentId: string | null,
  ) => {
    if (item.type === "folder") {
      folderOrder.push({
        id: item.id,
        orderIndex,
        parentId,
        folderId: parentId,
      });
    } else {
      resourceOrder.push({ id: item.id, orderIndex, folderId: parentId });
    }
  };

  const siblingsOf = (parentId: string | null): AnyResource[] =>
    all
      .filter((r) => r.id !== movingId && effectiveParentId(r) === parentId)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  // Destination: existing children (minus the moved item) then the moved item.
  [...siblingsOf(destParentId), moving].forEach((item, index) =>
    pushOrder(item, index, destParentId),
  );

  // Old parent: re-sequence remaining children when the parent actually changes.
  const currentParent = effectiveParentId(moving);
  if (currentParent !== destParentId) {
    siblingsOf(currentParent).forEach((item, index) =>
      pushOrder(item, index, currentParent),
    );
  }

  return { folderOrder, resourceOrder };
}
