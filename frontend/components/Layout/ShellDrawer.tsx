"use client";

import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Button from "../common/UI/Button/Button";

export interface ShellDrawerProps {
  /** Which edge the drawer slides in from. */
  side: "left" | "right";
  /** Whether the drawer is open. */
  open: boolean;
  /** Called when the drawer requests to close (scrim tap, Esc, close button). */
  onClose: () => void;
  /** Accessible + visible header label (e.g. "Resources", "Metadata"). */
  title: string;
  children: React.ReactNode;
}

/**
 * Slide-in overlay sidebar for phone/tablet tiers.
 *
 * Built on Radix Dialog primitives so it inherits the modal affordances a
 * mobile drawer needs for free: a tap-to-close scrim, focus trapping, Esc to
 * close, `aria-modal`, focus return to the trigger, and background scroll lock
 * (via react-remove-scroll). Only the panel styling differs from the centered
 * {@link Dialog} — it's pinned full-height to the left/right edge and slides in.
 *
 * Mutual exclusion (one drawer at a time on phones) is enforced upstream in
 * `ShellLayoutProvider`, so at most one `ShellDrawer` is ever open.
 */
export default function ShellDrawer({
  side,
  open,
  onClose,
  title,
  children,
}: ShellDrawerProps): JSX.Element {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="appshell-scrim" />
        <DialogPrimitive.Content
          className={`appshell-drawer appshell-drawer--${side}`}
          // The visible header below is the accessible name; no separate
          // description is needed.
          aria-describedby={undefined}
        >
          <div className="appshell-sidebar-header">
            <DialogPrimitive.Title className="font-mono text-gw-nano uppercase tracking-label-wide font-semibold text-gw-secondary">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                title={`Close ${title.toLowerCase()} drawer`}
                aria-label={`Close ${title.toLowerCase()} drawer`}
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
