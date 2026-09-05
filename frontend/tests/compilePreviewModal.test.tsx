import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CompilePreviewModal, {
  type EntityCompileMode,
} from "../components/common/CompilePreviewModal";
import type { AnyResource } from "../src/lib/models/types";

const sampleResources: AnyResource[] = [
  {
    id: "f1",
    slug: "chapter-1",
    name: "Chapter 1",
    type: "folder",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    orderIndex: 0,
  },
  {
    id: "r1",
    slug: "scene-1",
    name: "Scene 1",
    type: "text",
    plainText: "",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    folderId: "f1",
    orderIndex: 0,
  },
  {
    id: "r2",
    slug: "scene-2",
    name: "Scene 2",
    type: "text",
    plainText: "",
    createdAt: "",
    updatedAt: "",
    userMetadata: {},
    folderId: "f1",
    orderIndex: 1,
  },
] as AnyResource[];

describe("CompilePreviewModal", () => {
  it("renders tree and calls onConfirm for legacy single-resource flow", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const resource: AnyResource = {
      id: "r1",
      slug: "test-doc",
      name: "Test Doc",
      type: "text",
      plainText: "",
      createdAt: "",
      updatedAt: "",
      userMetadata: {},
    } as AnyResource;

    render(
      <CompilePreviewModal
        isOpen={true}
        resource={resource}
        resources={[resource]}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Compile Project")).toBeInTheDocument();
    expect(screen.getByTestId("compile-resource-tree")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /compile/i });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

/**
 * T028: US3 — AppShell parity coverage for CompilePreviewModal.
 *
 * Verifies that the close lifecycle is preserved after ShellModalCoordinator
 * extraction.
 */
describe("CompilePreviewModal — AppShell parity (T028)", () => {
  it("calls onClose when the Close button is clicked", () => {
    const onClose = vi.fn();

    render(
      <CompilePreviewModal
        isOpen={true}
        resource={undefined}
        resources={[]}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render when isOpen is false", () => {
    render(
      <CompilePreviewModal
        isOpen={false}
        resource={undefined}
        resources={[]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByText("Compile Project")).not.toBeInTheDocument();
  });
});

describe("CompilePreviewModal — tree selection", () => {
  it("renders the resource tree", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("compile-resource-tree")).toBeInTheDocument();
  });

  it("all leaf resources are checked by default", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Both leaf checkboxes should be checked by default
    const r1Checkbox = screen.getByRole("checkbox", {
      name: "Scene 1",
    }) as HTMLInputElement;
    const r2Checkbox = screen.getByRole("checkbox", {
      name: "Scene 2",
    }) as HTMLInputElement;

    expect(r1Checkbox.checked).toBe(true);
    expect(r2Checkbox.checked).toBe(true);
  });

  it("compile button shows selected count", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /compile \(2\)/i }),
    ).toBeInTheDocument();
  });

  it("compile button is disabled when no resources are selected", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={[]}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const compileBtn = screen.getByRole("button", {
      name: /compile \(0\)/i,
    }) as HTMLButtonElement;
    expect(compileBtn.disabled).toBe(true);
  });

  it("unchecking a leaf reduces the selected count", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const r1Checkbox = screen.getByRole("checkbox", { name: "Scene 1" });
    fireEvent.click(r1Checkbox);

    expect(
      screen.getByRole("button", { name: /compile \(1\)/i }),
    ).toBeInTheDocument();
  });

  it("folder checkbox toggles all leaf descendants", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const folderCheckbox = screen.getByRole("checkbox", { name: "Chapter 1" });

    // Uncheck the folder — should uncheck all children
    fireEvent.click(folderCheckbox);

    expect(
      screen.getByRole("button", { name: /compile \(0\)/i }),
    ).toBeInTheDocument();

    // Check folder again — should check all children
    fireEvent.click(folderCheckbox);
    expect(
      screen.getByRole("button", { name: /compile \(2\)/i }),
    ).toBeInTheDocument();
  });

  it("calls onConfirmCompile with selected ids on confirm", () => {
    const onConfirmCompile = vi.fn();

    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        onConfirmCompile={onConfirmCompile}
        onClose={vi.fn()}
      />,
    );

    const compileBtn = screen.getByRole("button", { name: /compile \(2\)/i });
    fireEvent.click(compileBtn);

    expect(onConfirmCompile).toHaveBeenCalledTimes(1);
    const passedIds: string[] = onConfirmCompile.mock.calls[0][0];
    expect(passedIds).toContain("r1");
    expect(passedIds).toContain("r2");
  });

  it("offers a Markdown format option and reports it on confirm", () => {
    const onConfirmCompile = vi.fn();

    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        onConfirmCompile={onConfirmCompile}
        onClose={vi.fn()}
      />,
    );

    const formatSelect = screen.getByLabelText(/compile as/i);
    expect(screen.getByRole("option", { name: "md" })).toBeInTheDocument();

    fireEvent.change(formatSelect, { target: { value: "md" } });
    fireEvent.click(screen.getByRole("button", { name: /compile \(2\)/i }));

    expect(onConfirmCompile).toHaveBeenCalledTimes(1);
    expect(onConfirmCompile.mock.calls[0][1].format).toBe("md");
  });
});

describe("CompilePreviewModal — entity mode", () => {
  const entityMode: EntityCompileMode = {
    entries: [
      { resourceId: "r2", name: "Scene 2", resourceType: "text" },
      { resourceId: "r1", name: "Scene 1", resourceType: "text" },
    ],
    orderedResourceIds: ["r2", "r1"],
  };

  it("does not render the checkbox tree or Select All/None buttons", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        entityMode={entityMode}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("compile-resource-tree"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /select all/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /select none/i }),
    ).not.toBeInTheDocument();
  });

  it("renders EntityCompileResourceList showing entityMode.entries", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        entityMode={entityMode}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("entity-compile-resource-list"),
    ).toBeInTheDocument();
    expect(screen.getByText("Scene 2")).toBeInTheDocument();
    expect(screen.getByText("Scene 1")).toBeInTheDocument();
    expect(screen.getByText("2 resources to compile")).toBeInTheDocument();
  });

  it("clicking Compile calls onConfirmCompile with orderedResourceIds regardless of tree/checkbox state", () => {
    const onConfirmCompile = vi.fn();

    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        entityMode={entityMode}
        onConfirmCompile={onConfirmCompile}
        onClose={vi.fn()}
      />,
    );

    const compileBtn = screen.getByRole("button", { name: /compile \(2\)/i });
    fireEvent.click(compileBtn);

    expect(onConfirmCompile).toHaveBeenCalledTimes(1);
    expect(onConfirmCompile.mock.calls[0][0]).toEqual(["r2", "r1"]);
  });

  it("disables the Compile button when orderedResourceIds is empty", () => {
    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        entityMode={{ entries: [], orderedResourceIds: [] }}
        onConfirmCompile={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const compileBtn = screen.getByRole("button", {
      name: /compile \(0\)/i,
    }) as HTMLButtonElement;
    expect(compileBtn.disabled).toBe(true);
  });

  it("renders the format select, headers checkbox, and name input identically in entity mode", () => {
    const onConfirmCompile = vi.fn();

    render(
      <CompilePreviewModal
        isOpen={true}
        resources={sampleResources}
        entityMode={entityMode}
        onConfirmCompile={onConfirmCompile}
        onClose={vi.fn()}
      />,
    );

    const formatSelect = screen.getByLabelText(
      /compile as/i,
    ) as HTMLSelectElement;
    const headersCheckbox = screen.getByRole("checkbox", {
      name: /include section headers/i,
    }) as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText(
      /enter a name for your compiled output/i,
    ) as HTMLInputElement;

    expect(formatSelect).toBeInTheDocument();
    expect(headersCheckbox.checked).toBe(true);
    expect(nameInput).toBeInTheDocument();

    fireEvent.change(formatSelect, { target: { value: "pdf" } });
    fireEvent.click(headersCheckbox);
    fireEvent.change(nameInput, { target: { value: "My Compile" } });

    fireEvent.click(screen.getByRole("button", { name: /compile \(2\)/i }));

    expect(onConfirmCompile).toHaveBeenCalledTimes(1);
    expect(onConfirmCompile.mock.calls[0][0]).toEqual(["r2", "r1"]);
    expect(onConfirmCompile.mock.calls[0][1]).toEqual({
      includeHeaders: false,
      format: "pdf",
      compilationName: "My Compile",
    });
  });
});
