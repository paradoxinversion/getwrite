"use client";

import { useState } from "react";
import type { Folder } from "../../src/lib/models/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../common/UI/Dialog";
import Button from "../common/UI/Button/Button";
import FolderTreePicker from "./FolderTreePicker";

export interface MoveResourceModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Name of the item being moved (for the prompt). */
  itemName: string;
  /**
   * Destination folders to choose from. Callers moving a folder should exclude
   * that folder and its descendants so an item can't be moved into itself.
   */
  folders: Folder[];
  /** The item's current parent folder id (`undefined` = project root). */
  currentParentId?: string;
  onClose: () => void;
  /** Confirm the move; `undefined` destination means the project root. */
  onConfirm: (destParentId: string | undefined) => void;
}

/**
 * Touch-friendly "Move to…" dialog. Reuses {@link FolderTreePicker} to pick a
 * destination folder (or the project root) and hands the choice back to
 * `ResourceTree`, which reparents via the shared reorder persistence path.
 */
export default function MoveResourceModal({
  open,
  itemName,
  folders,
  currentParentId,
  onClose,
  onConfirm,
}: MoveResourceModalProps): JSX.Element {
  const [destination, setDestination] = useState<string | undefined>(
    currentParentId,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent maxWidth="max-w-[420px]" className="p-6">
        <DialogTitle>Move “{itemName}”</DialogTitle>
        <DialogDescription className="mb-4">
          Choose a destination folder.
        </DialogDescription>
        <FolderTreePicker
          folders={folders}
          value={destination}
          onChange={setDestination}
          rootLabel="Project Root"
          aria-label="Destination folder"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            disabled={destination === currentParentId}
            onClick={() => onConfirm(destination)}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
