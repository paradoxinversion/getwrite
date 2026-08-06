import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import EncryptionSetupModal from "../../components/common/EncryptionSetupModal";

const meta: Meta<typeof EncryptionSetupModal> = {
  title: "Common/EncryptionSetupModal",
  component: EncryptionSetupModal,
};

export default meta;

type Story = StoryObj<typeof EncryptionSetupModal>;

/** First time: the workspace has no passphrase yet, so one must be created. */
export const CreatePassphrase: Story = {
  args: {
    isOpen: true,
    projectName: "The Whistleblower",
    needsPassphrase: true,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
};

/** A second project, once the workspace passphrase already exists. */
export const ExistingPassphrase: Story = {
  args: {
    isOpen: true,
    projectName: "Poetry 2026",
    needsPassphrase: false,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
};

/** Conversion under way — everything is disabled until it finishes. */
export const Busy: Story = {
  args: {
    isOpen: true,
    projectName: "The Whistleblower",
    needsPassphrase: true,
    isBusy: true,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
};

/** A previous attempt failed. */
export const WithError: Story = {
  args: {
    isOpen: true,
    projectName: "The Whistleblower",
    needsPassphrase: true,
    errorMessage: "Could not set up encryption for this workspace.",
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
};

/** Live validation: the action stays disabled until every gate is satisfied. */
export const Interactive: Story = {
  args: {
    isOpen: true,
    projectName: "The Whistleblower",
    needsPassphrase: true,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
  render: function InteractiveStory(args) {
    const [isOpen, setIsOpen] = React.useState(true);
    const [lastResult, setLastResult] = React.useState<string>("");

    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-label text-gw-secondary">
          {lastResult || "Awaiting confirmation"}
        </p>
        <EncryptionSetupModal
          {...args}
          isOpen={isOpen}
          onConfirm={(passphrase) => {
            setLastResult(
              passphrase ? "Confirmed with a new passphrase" : "Confirmed",
            );
            setIsOpen(false);
          }}
          onCancel={() => {
            setLastResult("Cancelled");
            setIsOpen(false);
          }}
        />
      </div>
    );
  },
};
