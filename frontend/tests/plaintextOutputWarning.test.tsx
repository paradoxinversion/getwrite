// Last Updated: 2026-08-03

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExportPreviewModal from "../components/common/ExportPreviewModal";
import CompilePreviewModal from "../components/common/CompilePreviewModal";
import ShellModalCoordinator from "../components/Layout/ShellModalCoordinator";
import { Provider } from "react-redux";
import { makeStore } from "../src/store/store";

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

describe("plaintext-output warning — reachable from a real caller", () => {
  /**
   * The tests above render the modals directly and hand them
   * `isSourceEncrypted`, which is why they passed while the warning was
   * unreachable: no component in the app ever set that prop. This renders the
   * coordinator that actually owns both modals, so the wiring is what is under
   * test rather than the modals' own rendering.
   *
   * @param isProjectEncrypted - Whether the active project is encrypted.
   */
  function renderCoordinator(isProjectEncrypted: boolean) {
    render(
      <Provider store={makeStore()}>
        <ShellModalCoordinator
          contextAction={{ open: false }}
          setContextAction={() => {}}
          isCloseProjectConfirmOpen={false}
          setIsCloseProjectConfirmOpen={() => {}}
          createModal={{ open: false }}
          setCreateModal={() => {}}
          exportModal={{ open: true, resourceNames: ["Chapter One"] }}
          setExportModal={() => {}}
          compileModal={{ open: false }}
          setCompileModal={() => {}}
          renameModal={{ open: false }}
          setRenameModal={() => {}}
          onRenameConfirm={async () => {}}
          isProjectSettingsOpen={false}
          setIsProjectSettingsOpen={() => {}}
          onSaveHeadingSettings={async () => {}}
          onSaveBodySettings={async () => {}}
          initialDefaultRevisionName="Draft"
          onSaveDefaultRevisionName={async () => {}}
          isPreferencesModalOpen={false}
          setIsPreferencesModalOpen={() => {}}
          isHelpModalOpen={false}
          setIsHelpModalOpen={() => {}}
          isProjectTypesModalOpen={false}
          setIsProjectTypesModalOpen={() => {}}
          isResourcePaletteOpen={false}
          setIsResourcePaletteOpen={() => {}}
          isProjectTypesLoading={false}
          projectTypesLoadError={null}
          projectTypeTemplates={[]}
          isProjectEncrypted={isProjectEncrypted}
          hasUnsavedEditorChanges={false}
          onDeleteConfirm={async () => {}}
          onCloseProjectConfirm={() => {}}
          onCreateConfirmed={async () => {}}
          onExportConfirmed={async () => {}}
          onBuildCompilePreview={() => ""}
          onConfirmCompile={async () => {}}
        />
      </Provider>,
    );
  }

  it("passes the flag through to the export modal", () => {
    renderCoordinator(true);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it("stays quiet for an unencrypted project", () => {
    renderCoordinator(false);
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });
});
