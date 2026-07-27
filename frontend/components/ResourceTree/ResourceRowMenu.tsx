"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Copy,
  Files,
  Trash2,
  Download,
  FolderInput,
  MoreVertical,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../common/UI/Popover/Popover";
import type { ResourceContextAction } from "./ResourceContextMenu";

export interface ResourceRowMenuProps {
  resourceId: string;
  resourceName: string;
  /** Mirrors `ResourceContextMenu`'s `onAction` (the right-click menu). */
  onAction: (action: ResourceContextAction, resourceId: string) => void;
  /** Opens the "Move to…" folder picker for this item. */
  onMove: (resourceId: string) => void;
}

/**
 * Tap/click-triggered overflow (⋯) menu for a resource-tree row.
 *
 * Touch has no right-click, so this exposes the same actions as
 * {@link ResourceContextMenu} (kept in sync by hand) plus a "Move to…" entry
 * that replaces drag-and-drop reparenting on touch. Built on `Popover` rather
 * than the right-click-only Radix `ContextMenu`. On pointer devices the trigger
 * is revealed on row hover/focus (see `.resource-tree-kebab` CSS); on touch it
 * is always visible.
 */
export default function ResourceRowMenu({
  resourceId,
  resourceName,
  onAction,
  onMove,
}: ResourceRowMenuProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const run = (fn: () => void) => {
    setIsOpen(false);
    fn();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="resource-tree-kebab resource-tree-icon-button"
          aria-label={`${resourceName} options`}
          title="Actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="resource-row-menu"
        aria-label={`${resourceName} options`}
      >
        <button
          type="button"
          className="resource-context-menu-item"
          onClick={() => run(() => onAction("create", resourceId))}
        >
          <Plus size={14} className="resource-context-menu-item-icon" />
          Create
        </button>
        <button
          type="button"
          className="resource-context-menu-item"
          onClick={() => run(() => onAction("smart-folder", resourceId))}
        >
          <Search size={14} className="resource-context-menu-item-icon" />
          New Smart Folder
        </button>
        <div className="resource-context-menu-separator" />
        <button
          type="button"
          className="resource-context-menu-item"
          onClick={() => run(() => onAction("rename", resourceId))}
        >
          <Pencil size={14} className="resource-context-menu-item-icon" />
          Rename
        </button>
        <button
          type="button"
          className="resource-context-menu-item"
          onClick={() => run(() => onMove(resourceId))}
        >
          <FolderInput size={14} className="resource-context-menu-item-icon" />
          Move to…
        </button>
        <button
          type="button"
          className="resource-context-menu-item"
          onClick={() => run(() => onAction("copy", resourceId))}
        >
          <Copy size={14} className="resource-context-menu-item-icon" />
          Copy
        </button>
        <button
          type="button"
          className="resource-context-menu-item"
          onClick={() => run(() => onAction("duplicate", resourceId))}
        >
          <Files size={14} className="resource-context-menu-item-icon" />
          Duplicate
        </button>
        <div className="resource-context-menu-separator" />
        <button
          type="button"
          className="resource-context-menu-item resource-context-menu-item-danger"
          onClick={() => run(() => onAction("delete", resourceId))}
        >
          <Trash2 size={14} className="resource-context-menu-item-icon" />
          Delete
        </button>
        <button
          type="button"
          className="resource-context-menu-item"
          onClick={() => run(() => onAction("export", resourceId))}
        >
          <Download size={14} className="resource-context-menu-item-icon" />
          Export
        </button>
      </PopoverContent>
    </Popover>
  );
}
