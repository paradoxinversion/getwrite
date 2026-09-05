import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EntityCompileResourceList, {
  type EntityCompileEntry,
} from "../../components/common/EntityCompileResourceList";

const MIXED_ENTRIES: EntityCompileEntry[] = [
  { resourceId: "r1", name: "Opening Scene", resourceType: "text" },
  { resourceId: "r2", name: "Character Portrait", resourceType: "image" },
  { resourceId: "r3", name: "Closing Scene", resourceType: "text" },
];

describe("EntityCompileResourceList", () => {
  it("renders a count matching the input list length", () => {
    render(<EntityCompileResourceList entries={MIXED_ENTRIES} />);
    expect(screen.getByText("3 resources to compile")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("entity-compile-resource-list-item"),
    ).toHaveLength(3);
  });

  it("marks a non-text entry as excluded but not a text entry", () => {
    render(<EntityCompileResourceList entries={MIXED_ENTRIES} />);

    const items = screen.getAllByTestId("entity-compile-resource-list-item");
    const imageItem = items.find((item: HTMLElement) =>
      item.textContent?.includes("Character Portrait"),
    );
    const textItem = items.find((item: HTMLElement) =>
      item.textContent?.includes("Opening Scene"),
    );

    expect(imageItem).toHaveAttribute("data-excluded", "true");
    expect(imageItem?.textContent).toContain("excluded — not a text resource");

    expect(textItem).toHaveAttribute("data-excluded", "false");
    expect(textItem?.textContent).not.toContain(
      "excluded — not a text resource",
    );
  });

  it("renders a count of 0 with no error for an empty list", () => {
    render(<EntityCompileResourceList entries={[]} />);
    expect(screen.getByText("0 resources to compile")).toBeInTheDocument();
    expect(
      screen.queryAllByTestId("entity-compile-resource-list-item"),
    ).toHaveLength(0);
  });

  it("uses singular phrasing for exactly one resource", () => {
    render(
      <EntityCompileResourceList
        entries={[{ resourceId: "r1", name: "Solo", resourceType: "text" }]}
      />,
    );
    expect(screen.getByText("1 resource to compile")).toBeInTheDocument();
  });
});
