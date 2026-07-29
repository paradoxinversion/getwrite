// Last Updated: 2026-03-11

/**
 * @module ResourceTree
 *
 * Renders the project's resource hierarchy as a drag-and-drop file/folder tree.
 *
 * The component reads all folders and resources from the Redux `resourcesSlice`,
 * transforms them into the flat-keyed map expected by `@headless-tree`, and
 * delegates rendering and interaction to `useTree`.  Drop events are translated
 * back into Redux dispatches so that in-memory state and on-disk order are kept
 * in sync via `persistReorder`.
 *
 * Features enabled on the tree:
 * - `syncDataLoaderFeature` — synchronous item/children loading
 * - `selectionFeature`     — single and multi-select with Shift/Ctrl
 * - `hotkeysCoreFeature`   — keyboard navigation
 * - `dragAndDropFeature`   — drag-to-reorder and drag-to-reparent
 * - `customClickBehavior`  — local override that mirrors selection state to Redux
 *
 * @example
 * ```tsx
 * <ResourceTree
 *   onResourceAction={(action, resourceId) => {
 *     if (action === "delete") handleDelete(resourceId);
 *   }}
 * />
 * ```
 */
import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
  dragAndDropFeature,
  FeatureImplementation,
  ItemInstance,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import {
  selectFoldersAndResources,
  updateResources,
  updateFolders,
  persistReorder,
  setSelectedResourceId,
} from "../../src/store/resourcesSlice";
import { selectActiveProjectDirectoryId } from "../../src/store/projectsSlice";
import ResourceContextMenu, {
  ResourceContextAction,
} from "./ResourceContextMenu";
import ResourceRowMenu from "./ResourceRowMenu";
import MoveResourceModal from "./MoveResourceModal";
import { computeMovePayload, collectDescendantIds } from "./moveResource";
import type { Folder } from "../../src/lib/models/types";
import { useMemo, useEffect, useState } from "react";
import { shallowEqual } from "react-redux";
import {
  ChevronDown,
  ChevronRight,
  FileTextIcon,
  ImageIcon,
  AudioIcon,
  FolderIcon,
} from "./ResourceTreeIcons";
import {
  buildResourceTree,
  ResourceItemData,
  ROOT_ITEM_ID,
} from "./buildResourceTree";
import { useResourceReorder } from "./useResourceReorder";

/** Horizontal pixel offset applied per nesting level when rendering tree items. */
const INDENTATION_WIDTH = 14;

/**
 * A `@headless-tree` feature plug-in that overrides the default click handler
 * so that:
 * - **Shift+click** extends the selection contiguously via `selectUpTo`.
 * - **Ctrl/Cmd+click** toggles individual items with `toggleSelect`.
 * - **Plain click** replaces the entire selection with the clicked item.
 *
 * The handler also focuses the clicked item and forwards the original event to
 * any previously registered `onClick` prop so that upstream features still
 * receive their callbacks.
 */
const customClickBehavior: FeatureImplementation = {
  itemInstance: {
    getProps: ({ tree, item, prev }) => ({
      ...prev?.(),
      onClick: (e: MouseEvent) => {
        if (e.shiftKey) {
          item.selectUpTo(e.ctrlKey || e.metaKey);
        } else if (e.ctrlKey || e.metaKey) {
          item.toggleSelect();
        } else {
          tree.setSelectedItems([item.getItemMeta().itemId]);
        }

        item.setFocused();
        prev?.()?.onClick?.(e);
        return {
          selectedItems: tree.getSelectedItems(),
          focusedItem: item.getItemMeta().itemId,
        };
      },
    }),
  },
};

/**
 * Returns the appropriate icon element for a tree node based on resource type.
 *
 * - Folders receive a `FolderIcon`
 * - Text resources receive a `FileTextIcon`
 * - Image resources receive an `ImageIcon`
 * - Audio resources receive an `AudioIcon`
 */
function renderResourceIcon(item: ItemInstance<ResourceItemData>) {
  switch (item.getItemData().resourceType) {
    case "folder":
      return <FolderIcon />;
    case "text":
      return <FileTextIcon />;
    case "image":
      return <ImageIcon />;
    case "audio":
      return <AudioIcon />;
    default:
      return <FileTextIcon />;
  }
}

/**
 * Returns the expand/collapse chevron icon for a folder node.
 *
 * Renders `ChevronDown` when the folder is expanded and `ChevronRight`
 * when it is collapsed, giving the user a visual affordance for the
 * current state.
 */
function renderExpandableStateIcon(item: ItemInstance<ResourceItemData>) {
  return item.isExpanded() ? <ChevronDown /> : <ChevronRight />;
}

/**
 * Props accepted by the {@link ResourceTree} component.
 */
interface ResourceTreeProps {
  /**
   * Called when the user selects a context-menu action on a resource.
   *
   * @param action     - The action that was chosen (e.g. `"rename"`, `"delete"`).
   * @param resourceId - ID of the resource the action targets, if applicable.
   */
  onResourceAction?: (
    action: ResourceContextAction,
    resourceId?: string,
    resourceTitle?: string,
  ) => void;
  /**
   * When `true`, enables additional debug logging inside the component.
   * Intended for development use only.
   */
  debug?: boolean;
}

/**
 * Renders the full resource tree for the active project.
 *
 * Reads folders and resources from the Redux store, transforms them into the
 * `@headless-tree` data format, and mounts a keyboard- and mouse-accessible
 * tree with drag-and-drop reordering support.  Drop events are dispatched back
 * to the store and persisted to disk via `persistReorder`.
 *
 * @param props - See {@link ResourceTreeProps}.
 */
export default function ResourceTree({
  onResourceAction,
  debug,
}: ResourceTreeProps) {
  const dispatch = useAppDispatch();

  const currentProject = useAppSelector(
    (s) => s.projects.projects[s.projects.selectedProjectId ?? ""] ?? null,
  );

  const rawResources = useAppSelector(
    (s) => selectFoldersAndResources(s.resources),
    shallowEqual,
  );

  const selectedResourceId = useAppSelector(
    (s) => s.resources.selectedResourceId,
  );

  const transformedResourceData = useMemo(
    () => buildResourceTree(rawResources),
    [rawResources],
  );

  const onDrop = useResourceReorder({
    dispatch,
    currentProject,
    rawResources,
    transformedResourceData,
    rootItemId: ROOT_ITEM_ID,
  });

  // On-disk directory basename used for the reorder route URL segment — the
  // same source `useResourceReorder` uses (never `currentProject.id`).
  const projectDirectoryId = useAppSelector(selectActiveProjectDirectoryId);

  // "Move to…" (touch reparenting) — replaces drag-and-drop on touch.
  const [moveTarget, setMoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const moveTargetItem = moveTarget
    ? rawResources.find((r) => r.id === moveTarget.id)
    : undefined;

  // Destinations offered in the picker: all folders, minus (when moving a
  // folder) the folder itself and its descendants so it can't nest in itself.
  const moveDestinationFolders = useMemo<Folder[]>(() => {
    const folders = rawResources.filter(
      (r): r is Folder => r.type === "folder",
    );
    if (!moveTarget || moveTargetItem?.type !== "folder") return folders;
    const excluded = collectDescendantIds(rawResources, moveTarget.id);
    return folders.filter((f) => f.id !== moveTarget.id && !excluded.has(f.id));
  }, [rawResources, moveTarget, moveTargetItem]);

  const handleMoveConfirm = (destParentId: string | undefined): void => {
    if (!moveTarget) return;
    const payload = computeMovePayload(
      rawResources,
      moveTarget.id,
      destParentId ?? null,
    );
    if (payload) {
      if (payload.folderOrder.length > 0) {
        dispatch(updateFolders(payload.folderOrder));
      }
      if (payload.resourceOrder.length > 0) {
        dispatch(updateResources(payload.resourceOrder));
      }
      if (currentProject && projectDirectoryId) {
        dispatch(
          persistReorder({
            projectId: projectDirectoryId,
            projectRoot: currentProject.rootPath,
            folderOrder: payload.folderOrder,
            resourceOrder: payload.resourceOrder,
          }),
        );
      }
    }
    setMoveTarget(null);
  };

  /**
   * Handles a primary (left) click on a tree item.
   *
   * Delegates to the `customClickBehavior` feature to determine the new
   * selection set, then mirrors the result to the Redux store via
   * `setSelectedResourceId` so that the rest of the app reacts to the change.
   *
   * @param e    - The originating mouse event.
   * @param item - The `@headless-tree` item instance that was clicked.
   */
  const handleClick = (
    e: React.MouseEvent,
    item: ItemInstance<ResourceItemData>,
  ) => {
    item.setFocused();

    const modificationData = item.getProps().onClick?.(e);

    if (modificationData.selectedItems.length === 1) {
      tree.setSelectedItems([item.getItemMeta().itemId]);
      dispatch(setSelectedResourceId(item.getId()));
    } else {
      tree.setSelectedItems(modificationData.selectedItems);
      item.selectUpTo(e.ctrlKey || e.metaKey);
      dispatch(setSelectedResourceId(modificationData.focusedItem));
    }
  };

  const tree = useTree<ResourceItemData>({
    rootItemId: ROOT_ITEM_ID,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().isFolder,
    dataLoader: {
      getItem: (itemId) =>
        transformedResourceData[itemId] ?? {
          resourceId: itemId,
          name: "",
          children: [],
          isFolder: false,
          parentId: null,
          orderIndex: 0,
          resourceType: "text" as const,
        },
      getChildren: (itemId) =>
        transformedResourceData[itemId].children.sort((a, b) => {
          const aData = transformedResourceData[a];
          const bData = transformedResourceData[b];
          return (aData?.orderIndex ?? 0) - (bData?.orderIndex ?? 0);
        }),
    },
    indent: INDENTATION_WIDTH,
    onPrimaryAction: (item) => {
      dispatch(setSelectedResourceId(item.getId()));
    },
    onDrop,
    setDragImage: () => ({
      imgElement: document.getElementById("dragpreview")!,
      xOffset: -40,
      yOffset: -40,
    }),
    canReorder: true,
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      customClickBehavior,
      dragAndDropFeature,
    ],
  });

  useEffect(() => {
    tree.rebuildTree();
  }, [transformedResourceData]);

  useEffect(() => {
    tree.setSelectedItems(selectedResourceId ? [selectedResourceId] : []);
  }, [selectedResourceId]);

  const draggedItems = tree.getState().dnd?.draggedItems;
  return (
    <div
      {...tree.getContainerProps()}
      aria-label="Resource tree"
      className="flex flex-col items-start mb-8"
    >
      {tree.getItems().map((item) => (
        <ResourceContextMenu
          key={item.getId()}
          resourceId={item.getId()}
          resourceName={item.getItemName()}
          onAction={(action, resourceId) => {
            onResourceAction?.(action, resourceId, item.getItemName());
          }}
          onClose={() => {}}
        >
          <div
            style={{
              paddingLeft: `${item.getItemMeta().level * INDENTATION_WIDTH}px`,
            }}
            className={`resource-tree-item ${item.isSelected() ? "resource-tree-item--selected" : ""}`}
          >
            {item.isFolder() && (
              <button
                className="resource-tree-icon-button"
                onClick={item.isExpanded() ? item.collapse : item.expand}
              >
                {renderExpandableStateIcon(item)}
              </button>
            )}
            <button
              {...item.getProps()}
              key={item.getId()}
              onClick={(e) => handleClick(e, item)}
              className={`resource-tree-button ${item.isSelected() ? "resource-tree-button--selected" : ""} ${item.isFolder() ? "text-gw-label text-gw-secondary" : ""}`}
            >
              <div
                className={`resource-tree-item-row ${item.isDragTarget() ? "resource-tree-item-row--drag-target" : ""}`}
              >
                {renderResourceIcon(item)}
                <div className="truncate">{item.getItemName()}</div>
              </div>
            </button>
            <ResourceRowMenu
              resourceId={item.getId()}
              resourceName={item.getItemName()}
              onAction={(action, resourceId) =>
                onResourceAction?.(action, resourceId, item.getItemName())
              }
              onMove={(resourceId) =>
                setMoveTarget({ id: resourceId, name: item.getItemName() })
              }
            />
          </div>
        </ResourceContextMenu>
      ))}
      <div style={tree.getDragLineStyle()} className="dragline" />
      <div
        id="dragpreview"
        style={{
          // move the drag preview off-screen by default
          position: "absolute",
          left: "-9999px",
        }}
        className="resource-tree-drag-preview"
      >
        {draggedItems
          ?.slice(0, 3)
          .map((item) => item.getItemName())
          .join(", ")}
        {(draggedItems?.length ?? 0) > 3 &&
          ` and ${(draggedItems?.length ?? 0) - 3} more`}
      </div>
      {moveTarget ? (
        <MoveResourceModal
          open
          itemName={moveTarget.name}
          folders={moveDestinationFolders}
          currentParentId={
            moveTargetItem?.type === "folder"
              ? ((moveTargetItem as Folder).parentId ??
                moveTargetItem?.folderId ??
                undefined)
              : (moveTargetItem?.folderId ?? undefined)
          }
          onClose={() => setMoveTarget(null)}
          onConfirm={handleMoveConfirm}
        />
      ) : null}
    </div>
  );
}
