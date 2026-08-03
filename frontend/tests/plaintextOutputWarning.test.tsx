// Last Updated: 2026-08-03

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExportPreviewModal from "../components/common/ExportPreviewModal";
import CompilePreviewModal from "../components/common/CompilePreviewModal";

const WARNING = /readable by anyone who can open it/i;

describe("plaintext-output warning — export", () => {
  it("warns when the source project is encrypted", () => {
    render(
      <ExportPreviewModal
        isOpen
        resourceNames={["Chapter One"]}
        isSourceEncrypted
      />,
    );
    // FR27: the user learns the output leaves the project's protection behind
    // before it is written, not after.
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it("stays quiet for an unencrypted project", () => {
    render(<ExportPreviewModal isOpen resourceNames={["Chapter One"]} />);
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });
});

describe("plaintext-output warning — compile", () => {
  it("warns when the source project is encrypted", () => {
    render(<CompilePreviewModal isOpen resources={[]} isSourceEncrypted />);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it("stays quiet for an unencrypted project", () => {
    render(<CompilePreviewModal isOpen resources={[]} />);
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });
});
