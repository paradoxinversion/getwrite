import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HelpPage from "../../components/help/HelpPage";

describe("HelpPage", () => {
  it("renders the same tabbed help content and switches sections", async () => {
    const user = userEvent.setup();

    render(<HelpPage />);

    expect(
      screen.getByText(/GetWrite is a writing application/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Projects/i }));

    const projectsPanel = screen.getByRole("tabpanel", { name: /Projects/i });

    expect(
      within(projectsPanel).getByText(
        (_content: string, element: Element | null) => {
          return (
            (element?.tagName === "P" &&
              element?.textContent?.includes(
                "A project is a self-contained writing workspace",
              )) ??
            false
          );
        },
      ),
    ).toBeInTheDocument();

    expect(
      within(projectsPanel).getByText(
        (_content: string, element: Element | null) => {
          return (
            (element?.tagName === "P" &&
              element?.textContent?.includes(
                "no folder is protected, none is pinned to a fixed position",
              )) ??
            false
          );
        },
      ),
    ).toBeInTheDocument();
  });

  it("documents the metadata system in its own tab", async () => {
    const user = userEvent.setup();

    render(<HelpPage />);

    await user.click(screen.getByRole("tab", { name: /Metadata/i }));

    const metadataPanel = screen.getByRole("tabpanel", { name: /Metadata/i });

    expect(
      within(metadataPanel).getByText(
        (_content: string, element: Element | null) =>
          (element?.tagName === "P" &&
            element?.textContent?.includes(
              "structured information about a document",
            )) ??
          false,
      ),
    ).toBeInTheDocument();

    // Covers the build-up that a brand-new user needs: where to edit it,
    // the built-in fields, and what the metadata ultimately unlocks.
    expect(
      within(metadataPanel).getByText("The Metadata Panel"),
    ).toBeInTheDocument();
    expect(
      within(metadataPanel).getByText("Built-in fields"),
    ).toBeInTheDocument();
    expect(
      within(metadataPanel).getByText("What metadata unlocks"),
    ).toBeInTheDocument();
  });

  it("keeps the modal close button behavior intact", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<HelpPage renderInModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /Close help/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
