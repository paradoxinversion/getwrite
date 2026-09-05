import {
  buildResourceTree,
  ResourceItemData,
  ROOT_ITEM_ID,
} from "../ResourceTree/buildResourceTree";
import type { AnyResource } from "../../src/lib/models/types";

export { ROOT_ITEM_ID };
export type { ResourceItemData };
export type CompileTree = Record<string, ResourceItemData>;

/** Converts a flat resources array into the compile tree map. */
export function buildCompileTree(resources: AnyResource[]): CompileTree {
  return buildResourceTree(resources);
}

/** Returns child IDs of a node sorted by orderIndex. */
export function sortedChildren(nodeId: string, tree: CompileTree): string[] {
  const node = tree[nodeId];
  if (!node) return [];
  return [...node.children].sort(
    (a, b) => (tree[a]?.orderIndex ?? 0) - (tree[b]?.orderIndex ?? 0),
  );
}

/**
 * Returns all non-folder descendant IDs of nodeId, depth-first.
 * If nodeId is itself a leaf, returns [nodeId].
 */
export function getDescendantLeafIds(
  nodeId: string,
  tree: CompileTree,
): string[] {
  const node = tree[nodeId];
  if (!node) return [];
  if (!node.isFolder) return [nodeId];

  const result: string[] = [];
  const stack = [...sortedChildren(nodeId, tree)];
  while (stack.length > 0) {
    const current = stack.shift()!;
    const currentNode = tree[current];
    if (!currentNode) continue;
    if (currentNode.isFolder) {
      stack.unshift(...sortedChildren(current, tree));
    } else {
      result.push(current);
    }
  }
  return result;
}

/**
 * Returns a new Set after toggling nodeId:
 * - Folder: if all leaf descendants checked → uncheck all; otherwise check all.
 * - Leaf: flip its presence.
 */
export function toggleNode(
  nodeId: string,
  checkedIds: Set<string>,
  tree: CompileTree,
): Set<string> {
  const node = tree[nodeId];
  if (!node) return checkedIds;

  const next = new Set(checkedIds);

  if (node.isFolder) {
    const leaves = getDescendantLeafIds(nodeId, tree);
    const isAllChecked =
      leaves.length > 0 && leaves.every((id) => next.has(id));
    if (isAllChecked) {
      leaves.forEach((id) => next.delete(id));
    } else {
      leaves.forEach((id) => next.add(id));
    }
  } else {
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
  }

  return next;
}

/**
 * True when ALL non-folder descendants of folderId are in checkedIds.
 * Vacuously true for empty folders.
 */
export function isFolderChecked(
  folderId: string,
  checkedIds: Set<string>,
  tree: CompileTree,
): boolean {
  const leaves = getDescendantLeafIds(folderId, tree);
  return leaves.every((id) => checkedIds.has(id));
}

/**
 * True when SOME but not ALL non-folder descendants are in checkedIds.
 */
export function isFolderIndeterminate(
  folderId: string,
  checkedIds: Set<string>,
  tree: CompileTree,
): boolean {
  const leaves = getDescendantLeafIds(folderId, tree);
  const isSomeChecked = leaves.some((id) => checkedIds.has(id));
  const isAllChecked = leaves.every((id) => checkedIds.has(id));
  return isSomeChecked && !isAllChecked;
}

/**
 * Orders an arbitrary set of resource IDs by their depth-first,
 * orderIndex-sibling-ordered position in the full project resource tree.
 *
 * Independently walks the tree via buildCompileTree/getDescendantLeafIds
 * rather than trusting any caller-supplied ordering — ids not present in
 * the tree are silently dropped, and duplicates in the input are collapsed.
 */
export function orderResourceIdsByTreePosition(
  resources: AnyResource[],
  resourceIds: string[],
): string[] {
  if (resourceIds.length === 0) return [];

  const tree = buildCompileTree(resources);
  const fullOrder = getDescendantLeafIds(ROOT_ITEM_ID, tree);
  const wanted = new Set(resourceIds);

  return fullOrder.filter((id) => wanted.has(id));
}

/** Returns a Set containing every leaf ID in the tree (initial "all selected" state). */
export function initAllChecked(tree: CompileTree): Set<string> {
  const result = new Set<string>();
  const stack = [...sortedChildren(ROOT_ITEM_ID, tree)];
  while (stack.length > 0) {
    const current = stack.shift()!;
    const node = tree[current];
    if (!node) continue;
    if (node.isFolder) {
      stack.unshift(...sortedChildren(current, tree));
    } else {
      result.add(current);
    }
  }
  return result;
}
