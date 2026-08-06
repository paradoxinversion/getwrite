// Last Updated: 2026-08-06

/**
 * The desktop-only workspace-location control.
 *
 * The bridge it depends on is injected by `electron/src/preload.ts`, so these
 * tests stand a fake one on `window` rather than passing the component its
 * inputs — the question worth answering is whether the component finds the
 * bridge the way it will in the app, and whether it correctly finds *nothing*
 * on web.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkspaceLocationSettings from "../components/preferences/WorkspaceLocationSettings";
import type { WorkspaceChangeResult } from "../src/lib/desktop-bridge";

const CURRENT = "/Users/x/Documents/GetWrite";

/**
 * Installs a fake desktop bridge on `window`.
 *
 * @param chooseResult - What the folder picker should report.
 * @returns The bridge's spies.
 */
function installBridge(chooseResult: WorkspaceChangeResult) {
  const chooseWorkspaceDir = vi.fn(async () => chooseResult);
  const restart = vi.fn(async () => {});
  (window as unknown as Record<string, unknown>).getwriteDesktop = {
    getWorkspaceDir: vi.fn(async () => CURRENT),
    chooseWorkspaceDir,
    restart,
  };
  return { chooseWorkspaceDir, restart };
}

beforeEach(() => {
  delete (window as unknown as Record<string, unknown>).getwriteDesktop;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).getwriteDesktop;
  vi.restoreAllMocks();
});

describe("WorkspaceLocationSettings — off the desktop app", () => {
  it("renders nothing at all", () => {
    const { container } = render(<WorkspaceLocationSettings />);

    // Hosted and Android have no filesystem for a user to point at, so an
    // inert control would only raise a question it cannot answer.
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the bridge is half-initialised", () => {
    (window as unknown as Record<string, unknown>).getwriteDesktop = {};

    const { container } = render(<WorkspaceLocationSettings />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("WorkspaceLocationSettings — in the desktop app", () => {
  it("shows where projects are stored", async () => {
    installBridge({ ok: false, cancelled: true });

    render(<WorkspaceLocationSettings />);

    expect(await screen.findByText(CURRENT)).toBeInTheDocument();
  });

  it("asks for a restart after a folder is chosen", async () => {
    const chosen = "/Volumes/Work/Novels";
    const { restart } = installBridge({ ok: true, projectsDir: chosen });
    render(<WorkspaceLocationSettings />);
    await screen.findByText(CURRENT);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /change folder/i }));

    // The Next server receives GETWRITE_PROJECTS_DIR when it is forked, so the
    // running one is bound to the old directory. Saying so beats appearing to
    // have switched and then serving the previous workspace.
    expect(await screen.findByText(/after a restart/i)).toBeInTheDocument();
    expect(screen.getByText(chosen)).toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /restart now/i }));
    expect(restart).toHaveBeenCalledOnce();
  });

  it("reports a refused folder in the words the main process chose", async () => {
    installBridge({
      ok: false,
      message:
        "That folder is inside the GetWrite application. Updating the app would delete everything in it.",
    });
    render(<WorkspaceLocationSettings />);
    await screen.findByText(CURRENT);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /change folder/i }));

    expect(
      await screen.findByText(/inside the GetWrite application/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/after a restart/i)).not.toBeInTheDocument();
  });

  it("treats backing out of the picker as a non-event", async () => {
    installBridge({ ok: false, cancelled: true });
    render(<WorkspaceLocationSettings />);
    await screen.findByText(CURRENT);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /change folder/i }));

    // Cancelling is not a failure and must not leave an error on screen.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /change folder/i }),
      ).toBeEnabled(),
    );
    expect(screen.queryByText(/cannot be used/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/after a restart/i)).not.toBeInTheDocument();
  });

  it("says plainly that existing projects are not moved", async () => {
    installBridge({ ok: false, cancelled: true });

    render(<WorkspaceLocationSettings />);

    // Pointing at a folder and relocating a workspace are different
    // intentions; the user has to know which one this is.
    expect(await screen.findByText(/are not moved/i)).toBeInTheDocument();
  });
});
