import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import EncryptionSettings from "../../components/preferences/EncryptionSettings";

const meta: Meta<typeof EncryptionSettings> = {
  title: "Preferences/EncryptionSettings",
  component: EncryptionSettings,
};

export default meta;

type Story = StoryObj<typeof EncryptionSettings>;

/** The default state: opt-in is available but nothing has happened. */
export const NotEncrypted: Story = {
  args: {
    projectName: "The Whistleblower",
    isEncrypted: false,
    needsPassphrase: true,
    onEnableEncryption: () => undefined,
  },
};

/** Workspace passphrase already exists, so this project reuses it. */
export const WorkspaceAlreadyHasPassphrase: Story = {
  args: {
    projectName: "Poetry 2026",
    isEncrypted: false,
    needsPassphrase: false,
    onEnableEncryption: () => undefined,
  },
};

/** Already encrypted: no enable action, and no disable action either. */
export const Encrypted: Story = {
  args: {
    projectName: "The Whistleblower",
    isEncrypted: true,
    needsPassphrase: false,
    onEnableEncryption: () => undefined,
  },
};

/** Conversion in progress. */
export const Busy: Story = {
  args: {
    projectName: "The Whistleblower",
    isEncrypted: false,
    needsPassphrase: true,
    isBusy: true,
    onEnableEncryption: () => undefined,
  },
};

/** A failed attempt, reported without losing the panel. */
export const WithError: Story = {
  args: {
    projectName: "The Whistleblower",
    isEncrypted: false,
    needsPassphrase: true,
    errorMessage: "Could not set up encryption for this workspace.",
    onEnableEncryption: () => undefined,
  },
};

/** The full opt-in path, from panel through modal to a confirmed result. */
export const Interactive: Story = {
  args: {
    projectName: "The Whistleblower",
    isEncrypted: false,
    needsPassphrase: true,
    onEnableEncryption: () => undefined,
  },
  render: function InteractiveStory(args) {
    const [isEncrypted, setIsEncrypted] = React.useState(false);

    return (
      <EncryptionSettings
        {...args}
        isEncrypted={isEncrypted}
        onEnableEncryption={() => setIsEncrypted(true)}
      />
    );
  },
};
