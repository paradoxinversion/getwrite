"use client";

import React from "react";
import Button from "./UI/Button/Button";
import Input from "./UI/Input/Input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./UI/Dialog";

export interface UnlockModalProps {
  /** Whether the prompt is visible. */
  isOpen: boolean;
  /** How many encrypted projects this passphrase would open. */
  encryptedProjectCount: number;
  /** Whether an unlock attempt is in flight. */
  isBusy?: boolean;
  /** Failure text from a previous attempt. */
  errorMessage?: string;
  /** Called with the entered passphrase. */
  onUnlock: (passphrase: string) => void;
  /**
   * Called when the user chooses to carry on without unlocking.
   *
   * Not a cancel: their unencrypted projects stay fully usable (FR20).
   */
  onDecline: () => void;
}

/**
 * Asks for the workspace passphrase, and offers to carry on without it.
 *
 * One passphrase opens every encrypted project at once (FR7), so this is shown
 * once per session rather than per project.
 *
 * The decline path is what keeps opt-in honest: encrypting one project must not
 * hold the rest of a writer's work hostage, so declining is a first-class button
 * rather than a dismissal (FR20).
 */
export default function UnlockModal({
  isOpen,
  encryptedProjectCount,
  isBusy = false,
  errorMessage,
  onUnlock,
  onDecline,
}: UnlockModalProps): JSX.Element {
  const [passphrase, setPassphrase] = React.useState("");

  // Never leave a typed passphrase sitting in memory once the prompt closes.
  React.useEffect(() => {
    if (!isOpen) setPassphrase("");
  }, [isOpen]);

  const canSubmit = passphrase.length > 0 && !isBusy;

  function handleUnlock(): void {
    if (canSubmit) onUnlock(passphrase);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onDecline();
      }}
    >
      <DialogContent maxWidth="max-w-[480px]" className="p-6">
        <DialogTitle>Unlock your encrypted projects</DialogTitle>
        <DialogDescription>
          {encryptedProjectCount === 1
            ? "One project in this workspace is encrypted. Enter your passphrase to open it."
            : `${encryptedProjectCount} projects in this workspace are encrypted. One passphrase opens all of them.`}
        </DialogDescription>

        <form
          className="mt-4 flex flex-col gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            handleUnlock();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-label text-gw-secondary">
              Passphrase
            </span>
            <Input
              type="password"
              autoComplete="current-password"
              value={passphrase}
              disabled={isBusy}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
        </form>

        {errorMessage ? (
          <p className="mt-3 font-mono text-[10px] text-gw-secondary">
            {errorMessage}
          </p>
        ) : null}

        <p className="mt-4 text-[11px] leading-relaxed text-gw-dim">
          You can carry on without unlocking. Your unencrypted projects stay
          available either way.
        </p>

        <DialogFooter>
          <Button variant="secondary" onClick={onDecline} disabled={isBusy}>
            Continue without unlocking
          </Button>
          <Button
            variant="outline"
            onClick={handleUnlock}
            disabled={!canSubmit}
          >
            {isBusy ? "Unlocking…" : "Unlock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
