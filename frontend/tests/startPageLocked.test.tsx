// Last Updated: 2026-08-03

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { makeStore } from "../src/store/store";
import StartPage, {
  type StartPageProjectEntry,
} from "../components/Start/StartPage";

const PLAIN_ID = "11111111-1111-4111-8111-111111111111";
const SEALED_ID = "22222222-2222-4222-8222-222222222222";

/** A normal, readable project card entry. */
function plainEntry(): StartPageProjectEntry {
  return {
    project: {
      id: PLAIN_ID,
      name: "Open Notebook",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    resources: [],
    folders: [],
  } as unknown as StartPageProjectEntry;
}

/** What `listProjectsCore` emits for an encrypted project while locked. */
function lockedEntry(): StartPageProjectEntry {
  return {
    isLocked: true,
    project: { id: SEALED_ID, createdAt: "2026-02-01T00:00:00.000Z" },
    resources: [],
    folders: [],
  } as unknown as StartPageProjectEntry;
}

function renderStart(projects: StartPageProjectEntry[]) {
  render(
    <Provider store={makeStore()}>
      <StartPage projects={projects} />
    </Provider>,
  );
}

/** An unlocked but lazily-listed encrypted project. */
function lazyEncryptedEntry(): StartPageProjectEntry {
  return {
    isEncrypted: true,
    isLocked: false,
    project: {
      id: SEALED_ID,
      name: "The Whistleblower",
      createdAt: "2026-02-01T00:00:00.000Z",
    },
    resources: [],
    folders: [],
  } as unknown as StartPageProjectEntry;
}

describe("StartPage — lazily listed encrypted projects", () => {
  it("shows the name but no counts it never read", () => {
    renderStart([lazyEncryptedEntry()]);

    expect(screen.getByText("The Whistleblower")).toBeInTheDocument();
    // "0 resources" would be a lie: nothing was read, so nothing is claimed.
    expect(screen.queryByText(/0 resources/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^encrypted$/i)).toBeInTheDocument();
  });

  it("still shows counts for an unencrypted project", () => {
    renderStart([plainEntry()]);
    expect(screen.getByText(/0 resources · 0 folders/i)).toBeInTheDocument();
  });
});

describe("StartPage — locked project cards", () => {
  it("shows a locked project without revealing its name", () => {
    renderStart([plainEntry(), lockedEntry()]);

    expect(screen.getByText(/encrypted project/i)).toBeInTheDocument();
    expect(screen.getByText(/project · locked/i)).toBeInTheDocument();
    // FR18: the title must not appear anywhere in the rendered card.
    expect(screen.queryByText("The Whistleblower")).not.toBeInTheDocument();
  });

  it("keeps unencrypted projects fully usable alongside it", () => {
    renderStart([plainEntry(), lockedEntry()]);

    // FR20: encrypting one project must not hold the rest of the work hostage.
    expect(screen.getByText("Open Notebook")).toBeInTheDocument();
  });

  it("tells the user what to do about it", () => {
    renderStart([lockedEntry()]);
    expect(screen.getByText(/unlock this workspace/i)).toBeInTheDocument();
  });

  it("offers no actions that would need the project's contents", () => {
    renderStart([lockedEntry()]);

    for (const label of [/open/i, /compile/i, /package/i, /rename/i]) {
      expect(
        screen.queryByRole("button", { name: label }),
      ).not.toBeInTheDocument();
    }
  });

  it("renders nothing differently when no project is locked", () => {
    renderStart([plainEntry()]);

    // FR3: a workspace that never opted in sees no change at all.
    expect(screen.queryByText(/encrypted project/i)).not.toBeInTheDocument();
    expect(screen.getByText("Open Notebook")).toBeInTheDocument();
  });
});

describe("StartPage — card fields an encrypted project cannot supply", () => {
  it("never shows a locked project as 'Untitled Project'", () => {
    renderStart([lockedEntry()]);

    // The reported symptom: the locked branch was not being reached, so a
    // nameless entry fell through to the ordinary card's placeholder.
    expect(screen.queryByText(/untitled project/i)).not.toBeInTheDocument();
    expect(screen.getByText(/encrypted project/i)).toBeInTheDocument();
  });

  it("never shows zero counts for a locked project", () => {
    renderStart([lockedEntry()]);
    // Scoped to the card: the page also renders a workspace-wide summary, which
    // legitimately totals zero here.
    const card = screen.getByRole("article");
    expect(within(card).queryByText(/resources/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/folders/i)).not.toBeInTheDocument();
  });

  it("labels an unlocked encrypted project's date as encrypted, not edited", () => {
    renderStart([lazyEncryptedEntry()]);
    // The date is the marker's encryptedAt — the manifest is never opened — so
    // calling it "Last edited" would state something untrue.
    const card = screen.getByRole("article");
    expect(within(card).queryByText(/last edited/i)).not.toBeInTheDocument();
    expect(card.textContent).toMatch(/encrypted/i);
  });
});

describe("StartPage — declining the unlock prompt", () => {
  /**
   * Renders the Start screen with a controllable lock state.
   *
   * @param lockStatus - The workspace lock state to render at.
   * @returns The testing-library rerender helper, bound to the same store.
   */
  function renderAt(lockStatus: "locked" | "unlocked") {
    const store = makeStore();
    const view = render(
      <Provider store={store}>
        <StartPage
          projects={[plainEntry()]}
          lockStatus={lockStatus}
          onUnlock={() => {}}
        />
      </Provider>,
    );
    return (next: "locked" | "unlocked") =>
      view.rerender(
        <Provider store={store}>
          <StartPage
            projects={[plainEntry()]}
            lockStatus={next}
            onUnlock={() => {}}
          />
        </Provider>,
      );
  }

  it("stops asking for the rest of the session", async () => {
    renderAt("locked");
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: /continue without unlocking/i }),
      );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks again after a real unlock and a later lock", async () => {
    const rerender = renderAt("locked");

    // Decline first — without this the flag was never set and the test would
    // pass whether or not it is ever cleared.
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: /continue without unlocking/i }),
      );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Unlock for real, then lock again: the user is asking to be prompted,
    // not asking to be left alone for the rest of the mount.
    rerender("unlocked");
    rerender("locked");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
