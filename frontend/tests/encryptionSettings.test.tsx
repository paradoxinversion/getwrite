// Last Updated: 2026-08-03

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EncryptionSettings from "../components/preferences/EncryptionSettings";
import EncryptionSetupModal from "../components/common/EncryptionSetupModal";

const PROJECT = "The Whistleblower";
const PASS = "correct horse battery staple";

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof EncryptionSettings>> = {},
) {
  const onEnableEncryption = vi.fn();
  render(
    <EncryptionSettings
      projectName={PROJECT}
      isEncrypted={false}
      needsPassphrase
      onEnableEncryption={onEnableEncryption}
      {...overrides}
    />,
  );
  return { onEnableEncryption, user: userEvent.setup() };
}

/** Fills the modal's two passphrase fields. */
async function typePassphrases(
  user: ReturnType<typeof userEvent.setup>,
  first: string,
  second: string,
): Promise<void> {
  await user.type(screen.getByLabelText(/^passphrase$/i), first);
  await user.type(screen.getByLabelText(/repeat passphrase/i), second);
}

describe("EncryptionSettings — opt-in is the only route in", () => {
  it("does nothing on mount", () => {
    const { onEnableEncryption } = renderPanel();
    // FR1/FR2: rendering settings must never enable encryption by itself.
    expect(onEnableEncryption).not.toHaveBeenCalled();
    expect(screen.getByText(/not encrypted/i)).toBeInTheDocument();
  });

  it("does nothing when the modal is merely opened", async () => {
    const { onEnableEncryption, user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(onEnableEncryption).not.toHaveBeenCalled();
  });

  it("does nothing when the user backs out", async () => {
    const { onEnableEncryption, user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onEnableEncryption).not.toHaveBeenCalled();
  });

  it("offers no enable action once already encrypted", () => {
    renderPanel({ isEncrypted: true });
    expect(
      screen.queryByRole("button", { name: /encrypt this project/i }),
    ).not.toBeInTheDocument();
  });

  it("offers no disable action either", () => {
    renderPanel({ isEncrypted: true });
    // v1 has no in-place decryption; the escape hatch is a plaintext export.
    expect(
      screen.queryByRole("button", { name: /decrypt|disable|turn off/i }),
    ).not.toBeInTheDocument();
  });
});

describe("EncryptionSettings — the gates before encryption can start", () => {
  it("keeps the action disabled until every gate is satisfied", async () => {
    const { user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );

    const confirm = screen.getByRole("button", { name: /encrypt project/i });
    expect(confirm).toBeDisabled();

    await typePassphrases(user, PASS, PASS);
    // Passphrases match, but the acknowledgement is still outstanding (FR9).
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
  });

  it("blocks mismatched passphrases and says so", async () => {
    const { onEnableEncryption, user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );

    await typePassphrases(user, PASS, "a different passphrase");
    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /encrypt project/i }),
    ).toBeDisabled();
    expect(onEnableEncryption).not.toHaveBeenCalled();
  });

  it("blocks a passphrase that is too short", async () => {
    const { user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );

    await typePassphrases(user, "short", "short");
    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /encrypt project/i }),
    ).toBeDisabled();
  });

  it("blocks submission without the acknowledgement", async () => {
    const { onEnableEncryption, user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );
    await typePassphrases(user, PASS, PASS);

    await user.click(screen.getByRole("button", { name: /encrypt project/i }));
    expect(onEnableEncryption).not.toHaveBeenCalled();
  });

  it("states plainly that the passphrase cannot be recovered", async () => {
    const { user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );

    expect(screen.getByText(/cannot be recovered/i)).toBeInTheDocument();
    expect(screen.getByText(/no reset, no backup key/i)).toBeInTheDocument();
  });
});

describe("EncryptionSettings — confirming", () => {
  it("passes the new passphrase up once every gate is met", async () => {
    const { onEnableEncryption, user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );

    await typePassphrases(user, PASS, PASS);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /encrypt project/i }));

    expect(onEnableEncryption).toHaveBeenCalledExactlyOnceWith(PASS);
  });

  it("asks only for the acknowledgement when a workspace passphrase exists", async () => {
    const { onEnableEncryption, user } = renderPanel({
      needsPassphrase: false,
    });
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );

    // One passphrase covers the whole workspace, so it is not re-collected.
    expect(screen.queryByLabelText(/^passphrase$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /encrypt project/i }));

    expect(onEnableEncryption).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("does not retain a typed passphrase after closing", async () => {
    const { user } = renderPanel();
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );
    await typePassphrases(user, PASS, PASS);
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );
    expect(screen.getByLabelText(/^passphrase$/i)).toHaveValue("");
    expect(screen.getByLabelText(/repeat passphrase/i)).toHaveValue("");
  });

  it("disables everything while a conversion is running", async () => {
    const { user } = renderPanel({ isBusy: true });
    expect(
      screen.getByRole("button", { name: /encrypt this project/i }),
    ).toBeDisabled();
    // The panel's own action is the only way in, so a busy panel is inert.
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("surfaces a failure without losing the panel", () => {
    renderPanel({ errorMessage: "Could not set up encryption." });
    expect(
      screen.getByText(/could not set up encryption/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /encrypt this project/i }),
    ).toBeInTheDocument();
  });
});

describe("EncryptionSetupModal — the in-progress state", () => {
  function renderModal(
    overrides: Partial<React.ComponentProps<typeof EncryptionSetupModal>> = {},
  ) {
    const onCancel = vi.fn();
    render(
      <EncryptionSetupModal
        isOpen
        projectName={PROJECT}
        needsPassphrase
        onConfirm={vi.fn()}
        onCancel={onCancel}
        {...overrides}
      />,
    );
    return { onCancel, user: userEvent.setup() };
  }

  it("reports how far the conversion has got", () => {
    renderModal({ isBusy: true, progress: { done: 2, total: 7 } });
    // The counts are interpolated, so the sentence spans several text nodes —
    // and the confirm button also reads "Encrypting…", hence the tag filter.
    const line = screen
      .getAllByText(/encrypting/i)
      .find((element: HTMLElement) => element.tagName === "P");
    expect(line?.textContent).toContain("2");
    expect(line?.textContent).toContain("7");
    expect(line?.textContent).toMatch(/files/i);
  });

  it("cannot be dismissed with Escape while converting", async () => {
    const { onCancel, user } = renderModal({ isBusy: true });
    await user.keyboard("{Escape}");

    // The write barrier refuses every write to this project meanwhile, so
    // escaping into the editor would only produce "being converted" errors.
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("can be dismissed with Escape when idle", async () => {
    const { onCancel, user } = renderModal();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("EncryptionSettings — the escape hatch and lock control", () => {
  it("offers an unencrypted-copy export once encrypted", async () => {
    const onExportPlaintextCopy = vi.fn();
    render(
      <EncryptionSettings
        projectName={PROJECT}
        isEncrypted
        needsPassphrase={false}
        onEnableEncryption={vi.fn()}
        onExportPlaintextCopy={onExportPlaintextCopy}
      />,
    );

    // FR24: the panel already promises this route back; it must exist.
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: /export an unencrypted copy/i }),
      );
    expect(onExportPlaintextCopy).toHaveBeenCalledOnce();
  });

  it("offers no export before the project is encrypted", () => {
    render(
      <EncryptionSettings
        projectName={PROJECT}
        isEncrypted={false}
        needsPassphrase
        onEnableEncryption={vi.fn()}
        onExportPlaintextCopy={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /export an unencrypted copy/i }),
    ).not.toBeInTheDocument();
  });

  it("offers a lock control while unlocked", async () => {
    const onLockWorkspace = vi.fn();
    render(
      <EncryptionSettings
        projectName={PROJECT}
        isEncrypted
        needsPassphrase={false}
        onEnableEncryption={vi.fn()}
        onLockWorkspace={onLockWorkspace}
      />,
    );

    // FR7: keys are discarded on *explicit* lock, so there has to be one.
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /lock workspace/i }));
    expect(onLockWorkspace).toHaveBeenCalledOnce();
  });

  it("hides the lock control when the workspace is already locked", () => {
    render(
      <EncryptionSettings
        projectName={PROJECT}
        isEncrypted
        needsPassphrase={false}
        onEnableEncryption={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /lock workspace/i }),
    ).not.toBeInTheDocument();
  });
});

describe("EncryptionSettings — the modal closes on the outcome", () => {
  /** Drives the panel from "not encrypted" to whatever `next` describes. */
  function renderThenSettle(
    next: Partial<React.ComponentProps<typeof EncryptionSettings>>,
  ) {
    const onEnableEncryption = vi.fn();
    const props = {
      projectName: PROJECT,
      isEncrypted: false,
      needsPassphrase: true,
      onEnableEncryption,
    } as React.ComponentProps<typeof EncryptionSettings>;

    const view = render(<EncryptionSettings {...props} />);
    return {
      onEnableEncryption,
      user: userEvent.setup(),
      settle: () => view.rerender(<EncryptionSettings {...props} {...next} />),
    };
  }

  it("closes once the project is encrypted", async () => {
    const { user, settle } = renderThenSettle({ isEncrypted: true });
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );
    await typePassphrases(user, PASS, PASS);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /encrypt project/i }));

    // Left open through the sweep, closed by the outcome.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    settle();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("stays open with the reason when encryption fails", async () => {
    const { user, settle } = renderThenSettle({
      errorMessage: "Could not encrypt this project.",
    });
    await user.click(
      screen.getByRole("button", { name: /encrypt this project/i }),
    );
    await typePassphrases(user, PASS, PASS);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /encrypt project/i }));
    settle();

    // Closing on failure would strand the user with no idea what happened.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getAllByText(/could not encrypt this project/i).length,
    ).toBeGreaterThan(0);
  });
});
