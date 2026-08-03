// Last Updated: 2026-08-03

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
