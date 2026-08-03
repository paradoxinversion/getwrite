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
  /** Called with the new passphrase, or `null` when the workspace has one. */
  onEnableEncryption: (passphrase: string | null) => void;
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
  onEnableEncryption,
}: EncryptionSettingsProps): JSX.Element {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  function handleConfirm(passphrase: string | null): void {
    setIsModalOpen(false);
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
        onConfirm={handleConfirm}
        onCancel={() => setIsModalOpen(false)}
      />
    </section>
  );
}
