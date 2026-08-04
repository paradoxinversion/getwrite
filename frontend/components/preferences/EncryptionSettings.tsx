"use client";

import React from "react";
import Button from "../common/UI/Button/Button";
import EncryptionSetupModal from "../common/EncryptionSetupModal";

export interface EncryptionSettingsProps {
  /** Name of the project these settings belong to. */
  projectName: string;
  /** Whether this project is already encrypted. */
  isEncrypted: boolean;
  /** Whether the workspace still needs a passphrase created. */
  needsPassphrase: boolean;
  /** Whether an enable request is in flight. */
  isBusy?: boolean;
  /** Failure text from a previous attempt. */
  errorMessage?: string;
  /** Files converted so far, shown while the sweep runs. */
  progress?: { done: number; total: number };
  /** Called with the new passphrase, or `null` when the workspace has one. */
  onEnableEncryption: (passphrase: string | null) => void;
  /** Whether a plaintext export is in flight. */
  isExporting?: boolean;
  /**
   * Writes an unencrypted copy of this project (FR24).
   *
   * Absent when the workspace is locked — the copy needs the project's key.
   */
  onExportPlaintextCopy?: () => void;
  /** Discards every key held this session. Absent when already locked. */
  onLockWorkspace?: () => void;
}

/**
 * The project-settings panel through which encryption is turned on.
 *
 * This is the *only* route into encryption (FR2). Nothing enables it implicitly
 * — not project creation, not a template, not an import, not a config value —
 * so this component deliberately exposes one explicit action and no automatic
 * behaviour of any kind.
 *
 * There is no disable action: v1 has no in-place decryption, and the escape
 * hatch is a full plaintext export (FR24).
 */
export default function EncryptionSettings({
  projectName,
  isEncrypted,
  needsPassphrase,
  isBusy = false,
  errorMessage,
  progress,
  onEnableEncryption,
  isExporting = false,
  onExportPlaintextCopy,
  onLockWorkspace,
}: EncryptionSettingsProps): JSX.Element {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  function handleConfirm(passphrase: string | null): void {
    // Deliberately left open: the modal owns the non-dismissible progress state
    // while the sweep runs, and closing here would drop the user into an editor
    // whose every write the barrier refuses.
    onEnableEncryption(passphrase);
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3 className="font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary">
          Encryption
        </h3>
        <p className="font-mono text-[10px] uppercase tracking-label text-gw-primary">
          {isEncrypted ? "Encrypted" : "Not encrypted"}
        </p>
      </header>

      <p className="text-[12px] leading-relaxed text-gw-secondary">
        {isEncrypted
          ? "Every file in this project is encrypted on disk. It opens when the workspace is unlocked."
          : "Encrypting this project scrambles every file on disk, so its contents cannot be read without your passphrase."}
      </p>

      {isEncrypted ? null : (
        <div className="flex flex-col items-start gap-2">
          <Button
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            disabled={isBusy}
          >
            Encrypt this project…
          </Button>
          <p className="text-[11px] leading-relaxed text-gw-dim">
            Encryption cannot be undone from here. To return to an unencrypted
            copy, export the project.
          </p>
        </div>
      )}

      {isEncrypted && onExportPlaintextCopy ? (
        <div className="flex flex-col items-start gap-2">
          <Button
            variant="secondary"
            onClick={onExportPlaintextCopy}
            disabled={isExporting}
          >
            {isExporting ? "Exporting…" : "Export an unencrypted copy"}
          </Button>
          <p className="text-[11px] leading-relaxed text-gw-dim">
            Adds a second, unencrypted project alongside this one. The original
            stays encrypted.
          </p>
        </div>
      ) : null}

      {onLockWorkspace ? (
        <div className="flex flex-col items-start gap-2">
          <Button variant="secondary" onClick={onLockWorkspace}>
            Lock workspace
          </Button>
          <p className="text-[11px] leading-relaxed text-gw-dim">
            Discards your keys until you enter the passphrase again.
          </p>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="font-mono text-[10px] text-gw-secondary">
          {errorMessage}
        </p>
      ) : null}

      <EncryptionSetupModal
        isOpen={isModalOpen}
        projectName={projectName}
        needsPassphrase={needsPassphrase}
        isBusy={isBusy}
        progress={progress}
        onConfirm={handleConfirm}
        onCancel={() => setIsModalOpen(false)}
      />
    </section>
  );
}
