// Last Updated: 2026-08-03

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { makeStore } from "../src/store/store";
import StartPage, {
  type StartPageProjectEntry,
} from "../components/Start/StartPage";

const PLAIN_ID = "11111111-1111-4111-8111-111111111111";
const SEALED_ID = "22222222-2222-4222-8222-222222222222";
const PASS = "correct horse battery staple";

function plainEntry(): StartPageProjectEntry {
  return {
    project: {
      id: PLAIN_ID,
      name: "Open Notebook",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    resources: [],
    folders: [],
  } as unknown as StartPageProjectEntry;
}

function lockedEntry(): StartPageProjectEntry {
  return {
    isEncrypted: true,
    isLocked: true,
    project: { id: SEALED_ID, createdAt: "2026-02-01T00:00:00.000Z" },
    resources: [],
    folders: [],
  } as unknown as StartPageProjectEntry;
}

function renderStart(
  overrides: Partial<React.ComponentProps<typeof StartPage>> = {},
) {
  const onUnlock = vi.fn();
  render(
    <Provider store={makeStore()}>
      <StartPage
        projects={[plainEntry(), lockedEntry()]}
        lockStatus="locked"
        encryptedProjectCount={1}
        onUnlock={onUnlock}
        {...overrides}
      />
    </Provider>,
  );
  return { onUnlock, user: userEvent.setup() };
}

describe("StartPage — when the workspace has no encryption", () => {
  it("never prompts", () => {
    renderStart({ lockStatus: "absent", encryptedProjectCount: 0 });
    // FR4: a user who never enabled encryption must not be asked for anything.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Open Notebook")).toBeInTheDocument();
  });

  it("never prompts once already unlocked", () => {
    renderStart({ lockStatus: "unlocked" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never prompts when no unlock handler is supplied", () => {
    renderStart({ onUnlock: undefined });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("StartPage — the unlock gate", () => {
  it("prompts before the list when a project is encrypted", async () => {
    renderStart();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^unlock$/i }),
    ).toBeInTheDocument();
  });

  it("says how many projects one passphrase opens", () => {
    renderStart({ encryptedProjectCount: 3 });
    // FR7: one unlock opens the whole workspace, and the prompt says so.
    expect(screen.getByText(/3 projects/i)).toBeInTheDocument();
    expect(
      screen.getByText(/one passphrase opens all of them/i),
    ).toBeInTheDocument();
  });

  it("passes the passphrase up on submit", async () => {
    const { onUnlock, user } = renderStart();
    await user.type(screen.getByLabelText(/passphrase/i), PASS);
    await user.click(screen.getByRole("button", { name: /^unlock$/i }));

    expect(onUnlock).toHaveBeenCalledExactlyOnceWith(PASS);
  });

  it("keeps the unlock action disabled until something is typed", async () => {
    renderStart();
    expect(screen.getByRole("button", { name: /^unlock$/i })).toBeDisabled();
  });

  it("reports a wrong passphrase without closing", async () => {
    renderStart({ unlockErrorMessage: "Incorrect passphrase." });

    expect(screen.getByText(/incorrect passphrase/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("disables everything while unlocking", () => {
    renderStart({ isUnlocking: true });
    expect(screen.getByRole("button", { name: /^unlocking/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /continue without unlocking/i }),
    ).toBeDisabled();
  });
});

describe("StartPage — the decline path", () => {
  it("offers declining as a real choice, not a dismissal", () => {
    renderStart();
    expect(
      screen.getByRole("button", { name: /continue without unlocking/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/unencrypted projects stay available/i),
    ).toBeInTheDocument();
  });

  it("shows the list with unencrypted projects usable after declining", async () => {
    const { user } = renderStart();
    await user.click(
      screen.getByRole("button", { name: /continue without unlocking/i }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // FR20: encrypting one project must not hold the rest of the work hostage.
    expect(screen.getByText("Open Notebook")).toBeInTheDocument();
    expect(screen.getByText(/encrypted project/i)).toBeInTheDocument();
  });

  it("does not unlock anything when declined", async () => {
    const { onUnlock, user } = renderStart();
    await user.click(
      screen.getByRole("button", { name: /continue without unlocking/i }),
    );
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("stays declined rather than re-prompting", async () => {
    const { user } = renderStart();
    await user.click(
      screen.getByRole("button", { name: /continue without unlocking/i }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    // Re-prompting on every re-render would make the decline meaningless.
    await user.click(screen.getByText("Open Notebook"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
