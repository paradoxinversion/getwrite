"use client";

import React from "react";
import Button from "./UI/Button/Button";
import Input from "./UI/Input/Input";
import Checkbox from "./UI/Checkbox/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./UI/Dialog";

/** Shortest passphrase accepted when creating a workspace keyring. */
const MIN_PASSPHRASE_LENGTH = 8;

export interface EncryptionSetupModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Name of the project being encrypted, shown for confirmation. */
  projectName: string;
  /**
   * Whether a workspace passphrase must be created.
   *
   * `false` once the workspace already has an unlocked keyring — one passphrase
   * covers every project, so only the acknowledgement is collected.
   */
  needsPassphrase: boolean;
  /** Whether the enable request is in flight. */
  isBusy?: boolean;
  /** Failure text from a previous attempt. */
  errorMessage?: string;
  /** Called with the new passphrase, or `null` when one already exists. */
  onConfirm: (passphrase: string | null) => void;
  /** Called when the user backs out. */
  onCancel: () => void;
}

/**
 * Collects everything required before a project can be encrypted: the workspace
 * passphrase entered twice, and an explicit acknowledgement that losing it
 * destroys the project (FR9).
 *
 * The warning is carried by copy and a required checkbox rather than by colour —
 * red is reserved for position and canonical state in this product, never for
 * alerts.
 */
export default function EncryptionSetupModal({
  isOpen,
  projectName,
  needsPassphrase,
  isBusy = false,
  errorMessage,
  onConfirm,
  onCancel,
}: EncryptionSetupModalProps): JSX.Element {
  const [passphrase, setPassphrase] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [hasAcknowledged, setHasAcknowledged] = React.useState(false);

  // Never carry a typed passphrase between openings.
  React.useEffect(() => {
    if (!isOpen) {
      setPassphrase("");
      setConfirmation("");
      setHasAcknowledged(false);
    }
  }, [isOpen]);

  const isTooShort =
    needsPassphrase &&
    passphrase.length > 0 &&
    passphrase.length < MIN_PASSPHRASE_LENGTH;
  const isMismatched =
    needsPassphrase && confirmation.length > 0 && passphrase !== confirmation;
  const isPassphraseReady =
    !needsPassphrase ||
    (passphrase.length >= MIN_PASSPHRASE_LENGTH && passphrase === confirmation);
  const canSubmit = isPassphraseReady && hasAcknowledged && !isBusy;

  function handleConfirm(): void {
    if (!canSubmit) return;
    onConfirm(needsPassphrase ? passphrase : null);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent maxWidth="max-w-[520px]" className="p-6">
        <DialogTitle>Encrypt “{projectName}”</DialogTitle>
        <DialogDescription>
          {needsPassphrase
            ? "Choose a passphrase for this workspace. One passphrase unlocks every encrypted project you have."
            : "This project will be encrypted with your existing workspace passphrase."}
        </DialogDescription>

        {needsPassphrase ? (
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-label text-gw-secondary">
                Passphrase
              </span>
              <Input
                type="password"
                autoComplete="new-password"
                value={passphrase}
                disabled={isBusy}
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-label text-gw-secondary">
                Repeat passphrase
              </span>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                disabled={isBusy}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>

            {isTooShort ? (
              <p className="font-mono text-[10px] text-gw-secondary">
                Use at least {MIN_PASSPHRASE_LENGTH} characters.
              </p>
            ) : null}
            {isMismatched ? (
              <p className="font-mono text-[10px] text-gw-secondary">
                The two passphrases do not match.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 border border-gw-border bg-gw-chrome2 p-4">
          <p className="text-[12px] leading-relaxed text-gw-primary">
            If you lose this passphrase, this project cannot be recovered. There
            is no reset, no backup key, and no way for anyone to open it for
            you.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2">
            <Checkbox
              checked={hasAcknowledged}
              disabled={isBusy}
              onChange={(event) => setHasAcknowledged(event.target.checked)}
            />
            <span className="text-[12px] leading-relaxed text-gw-secondary">
              I understand that losing my passphrase means losing this project
              permanently.
            </span>
          </label>
        </div>

        {errorMessage ? (
          <p className="mt-3 font-mono text-[10px] text-gw-secondary">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {isBusy ? "Encrypting…" : "Encrypt project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
