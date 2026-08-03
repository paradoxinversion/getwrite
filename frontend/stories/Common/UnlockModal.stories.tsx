import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import UnlockModal from "../../components/common/UnlockModal";

const meta: Meta<typeof UnlockModal> = {
  title: "Common/UnlockModal",
  component: UnlockModal,
};

export default meta;

type Story = StoryObj<typeof UnlockModal>;

/** A workspace with several encrypted projects, all opened by one passphrase. */
export const Default: Story = {
  args: {
    isOpen: true,
    encryptedProjectCount: 3,
    onUnlock: () => undefined,
    onDecline: () => undefined,
  },
};

/** Singular wording when only one project is encrypted. */
export const SingleProject: Story = {
  args: {
    isOpen: true,
    encryptedProjectCount: 1,
    onUnlock: () => undefined,
    onDecline: () => undefined,
  },
};

/** The passphrase was wrong; the prompt stays open. */
export const WrongPassphrase: Story = {
  args: {
    isOpen: true,
    encryptedProjectCount: 2,
    errorMessage: "Incorrect passphrase.",
    onUnlock: () => undefined,
    onDecline: () => undefined,
  },
};

/** Deriving the key — Argon2id takes about a second on a phone. */
export const Unlocking: Story = {
  args: {
    isOpen: true,
    encryptedProjectCount: 2,
    isBusy: true,
    onUnlock: () => undefined,
    onDecline: () => undefined,
  },
};

/** Both outcomes: unlocking, and declining to. */
export const Interactive: Story = {
  args: {
    isOpen: true,
    encryptedProjectCount: 2,
    onUnlock: () => undefined,
    onDecline: () => undefined,
  },
  render: function InteractiveStory(args) {
    const [isOpen, setIsOpen] = React.useState(true);
    const [outcome, setOutcome] = React.useState("Awaiting a choice");

    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-label text-gw-secondary">
          {outcome}
        </p>
        <UnlockModal
          {...args}
          isOpen={isOpen}
          onUnlock={() => {
            setOutcome("Unlocked");
            setIsOpen(false);
          }}
          onDecline={() => {
            setOutcome("Continued without unlocking");
            setIsOpen(false);
          }}
        />
      </div>
    );
  },
};
