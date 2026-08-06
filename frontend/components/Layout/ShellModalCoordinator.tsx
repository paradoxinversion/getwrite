"use client";

import type {
  AnyResource,
  Folder,
  Project as CanonicalProject,
  ResourceType,
} from "../../src/lib/models/types";
import type { ProjectTypeTemplateFile } from "../../src/types/project-types";
import RenameResourceModal from "../ResourceTree/RenameResourceModal";
import ConfirmDialog from "../common/ConfirmDialog";
import ResourceCommandPalette from "../common/ResourceCommandPalette";
import CreateResourceModal from "../ResourceTree/CreateResourceModal";
import ExportPreviewModal, {
  type ExportFormat,
} from "../common/ExportPreviewModal";
import CompilePreviewModal from "../common/CompilePreviewModal";
import UserPreferencesPage from "../preferences/UserPreferencesPage";
import ProjectTypesManagerPage from "../project-types/ProjectTypesManagerPage";
import HelpPage from "../help/HelpPage";
import ProjectSettingsDialog from "./ProjectSettingsDialog";
import { Dialog, DialogContent, DialogTitle } from "../common/UI/Dialog";
import type { ResourceContextAction } from "../ResourceTree/ResourceContextMenu";
import type { EditorHeadingMap } from "../../src/lib/editor-heading-settings";
import type { EditorBodyConfig } from "../../src/lib/editor-body-settings";
import type { CompileOptions } from "../common/CompilePreviewModal";

export interface SyncBlocker {
  id: string;
  label: string;
  isError?: boolean;
}

export interface ShellContextActionState {
  open: boolean;
  action?: ResourceContextAction;
  resourceId?: string;
  resourceTitle?: string;
}

export interface ShellCreateModalState {
  open: boolean;
  parentId?: string;
  initialTitle?: string;
  sourceResourceId?: string;
}

export interface ShellExportModalState {
  open: boolean;
  resourceId?: string;
  resourceTitle?: string;
  resourceIds?: string[];
  resourceNames?: string[];
}

export interface ShellCompileModalState {
  open: boolean;
  resourceId?: string;
  preview?: string;
}

export interface ShellRenameModalState {
  open: boolean;
  resourceId?: string;
  resourceTitle?: string;
}

export interface ShellModalCoordinatorProps {
  contextAction: ShellContextActionState;
  setContextAction: (state: ShellContextActionState) => void;
  isCloseProjectConfirmOpen: boolean;
  setIsCloseProjectConfirmOpen: (open: boolean) => void;
  createModal: ShellCreateModalState;
  setCreateModal: (state: ShellCreateModalState) => void;
  exportModal: ShellExportModalState;
  setExportModal: (state: ShellExportModalState) => void;
  compileModal: ShellCompileModalState;
  setCompileModal: (state: ShellCompileModalState) => void;
  renameModal: ShellRenameModalState;
  setRenameModal: (state: ShellRenameModalState) => void;
  onRenameConfirm: (newName: string) => Promise<void>;
  isProjectSettingsOpen: boolean;
  setIsProjectSettingsOpen: (open: boolean) => void;
  initialHeadings?: EditorHeadingMap;
  onSaveHeadingSettings: (headings: EditorHeadingMap) => Promise<void>;
  initialBodySettings?: EditorBodyConfig;
  onSaveBodySettings: (body: EditorBodyConfig) => Promise<void>;
  initialDefaultRevisionName: string;
  onSaveDefaultRevisionName: (name: string) => Promise<void>;
  /** Root path of the active project — required to render the Tags section of ProjectSettingsDialog (FR11). */
  projectPath?: string;
  isPreferencesModalOpen: boolean;
  setIsPreferencesModalOpen: (open: boolean) => void;
  isHelpModalOpen: boolean;
  setIsHelpModalOpen: (open: boolean) => void;
  isProjectTypesModalOpen: boolean;
  setIsProjectTypesModalOpen: (open: boolean) => void;
  isResourcePaletteOpen: boolean;
  setIsResourcePaletteOpen: (open: boolean) => void;
  isProjectTypesLoading: boolean;
  projectTypesLoadError: string | null;
  projectTypeTemplates: ProjectTypeTemplateFile[];
  resources?: AnyResource[];
  folders?: Folder[];
  project?: CanonicalProject | null;
  /**
   * Whether this project's files are encrypted at rest.
   *
   * Compiled and exported output is plaintext wherever it lands, so FR27 wants
   * the user warned before it leaves the project.
   */
  isProjectEncrypted?: boolean;
  hasUnsavedEditorChanges: boolean;
  syncBlockers?: SyncBlocker[];
  onDeleteConfirm: (resourceId: string) => Promise<void>;
  onCloseProjectConfirm: () => void;
  onCreateConfirmed: (
    payload: { title: string; type: ResourceType | string; folderId?: string },
    parentId?: string,
  ) => Promise<void>;
  onMediaCreateConfirmed?: (
    file: File,
    opts: { title: string; folderId?: string },
  ) => Promise<void>;
  onExportConfirmed: (
    resourceIds: string[],
    resourceId?: string,
    format?: ExportFormat,
  ) => Promise<void>;
  onSelectResource?: (resourceId: string) => void;
  onBuildCompilePreview: (resourceId?: string) => string;
  onConfirmCompile: (
    selectedIds: string[],
    options: CompileOptions,
  ) => Promise<void>;
}

/** Returns an onOpenChange handler that calls setter(false) when the dialog closes. */
function onDialogClose(setter: (open: boolean) => void) {
  return (open: boolean) => {
    if (!open) setter(false);
  };
}

export default function ShellModalCoordinator({
  contextAction,
  setContextAction,
  isCloseProjectConfirmOpen,
  setIsCloseProjectConfirmOpen,
  createModal,
  setCreateModal,
  exportModal,
  setExportModal,
  compileModal,
  setCompileModal,
  renameModal,
  setRenameModal,
  onRenameConfirm,
  isProjectSettingsOpen,
  setIsProjectSettingsOpen,
  initialHeadings,
  onSaveHeadingSettings,
  initialBodySettings,
  onSaveBodySettings,
  initialDefaultRevisionName,
  onSaveDefaultRevisionName,
  projectPath,
  isPreferencesModalOpen,
  setIsPreferencesModalOpen,
  isHelpModalOpen,
  setIsHelpModalOpen,
  isProjectTypesModalOpen,
  setIsProjectTypesModalOpen,
  isResourcePaletteOpen,
  setIsResourcePaletteOpen,
  isProjectTypesLoading,
  projectTypesLoadError,
  projectTypeTemplates,
  resources,
  folders,
  project,
  isProjectEncrypted = false,
  syncBlockers,
  onDeleteConfirm,
  onCloseProjectConfirm,
  onCreateConfirmed,
  onMediaCreateConfirmed,
  onExportConfirmed,
  onSelectResource,
  onBuildCompilePreview,
  onConfirmCompile,
}: ShellModalCoordinatorProps): JSX.Element {
  return (
    <>
      <ConfirmDialog
        isOpen={contextAction.open && contextAction.action === "delete"}
        title={
          contextAction.resourceTitle
            ? `Delete ${contextAction.resourceTitle}`
            : "Delete resource"
        }
        description={"This will remove the resource. Proceed?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => {
          if (contextAction.resourceId) {
            await onDeleteConfirm(contextAction.resourceId);
          }
          setContextAction({ open: false });
        }}
        onCancel={() => setContextAction({ open: false })}
      />

      <RenameResourceModal
        isOpen={renameModal.open}
        initialName={renameModal.resourceTitle ?? ""}
        onClose={() => setRenameModal({ open: false })}
        onConfirm={onRenameConfirm}
      />

      <ConfirmDialog
        isOpen={isCloseProjectConfirmOpen}
        title="Close project?"
        description="You have unsaved changes that may still be syncing. Close the project anyway and return to Start Page?"
        confirmLabel="Close Project"
        cancelLabel="Keep Editing"
        details={
          syncBlockers && syncBlockers.length > 0 ? (
            <ul className="sync-blockers-list">
              {syncBlockers.map((blocker) => (
                <li
                  key={blocker.id}
                  className={`sync-blocker${blocker.isError ? " sync-blocker--error" : ""}`}
                >
                  <span className="sync-blocker-label">{blocker.label}</span>
                  {blocker.isError ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="sync-blocker-error-icon"
                      >
                        ⚠
                      </span>
                      <span className="sr-only">error</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : undefined
        }
        onConfirm={onCloseProjectConfirm}
        onCancel={() => setIsCloseProjectConfirmOpen(false)}
      />

      <CreateResourceModal
        isOpen={createModal.open}
        initialTitle={createModal.initialTitle}
        parentId={createModal.parentId}
        onClose={() => setCreateModal({ open: false })}
        onCreate={(payload, parentId) => onCreateConfirmed(payload, parentId)}
        onUpload={onMediaCreateConfirmed}
        parents={folders ?? []}
      />

      <ResourceCommandPalette
        isOpen={isResourcePaletteOpen}
        resources={resources ?? []}
        onClose={() => setIsResourcePaletteOpen(false)}
        onSelectResource={(resourceId) => {
          onSelectResource?.(resourceId);
        }}
      />

      <ExportPreviewModal
        isOpen={exportModal.open}
        isSourceEncrypted={isProjectEncrypted}
        resourceTitle={exportModal.resourceTitle}
        resourceNames={exportModal.resourceNames}
        onClose={() => setExportModal({ open: false })}
        onConfirmExport={(format) =>
          onExportConfirmed(
            exportModal.resourceIds ??
              (exportModal.resourceId ? [exportModal.resourceId] : []),
            exportModal.resourceId,
            format,
          )
        }
        onShowCompile={() => {
          const preview = onBuildCompilePreview(exportModal.resourceId);
          setCompileModal({
            open: true,
            resourceId: exportModal.resourceId,
            preview,
          });
        }}
      />

      <CompilePreviewModal
        isOpen={compileModal.open}
        isSourceEncrypted={isProjectEncrypted}
        resource={
          compileModal.resourceId
            ? resources?.find((r) => r.id === compileModal.resourceId)
            : undefined
        }
        resources={[...(resources ?? []), ...(folders ?? [])]}
        projectId={project?.id}
        preview={compileModal.preview}
        onClose={() => setCompileModal({ open: false })}
        onConfirmCompile={(selectedIds, options) => {
          void onConfirmCompile(selectedIds, options);
          setCompileModal({ open: false });
        }}
      />

      <ProjectSettingsDialog
        open={isProjectSettingsOpen}
        onOpenChange={setIsProjectSettingsOpen}
        initialHeadings={initialHeadings}
        onSaveHeadingSettings={onSaveHeadingSettings}
        initialBodySettings={initialBodySettings}
        onSaveBodySettings={onSaveBodySettings}
        initialDefaultRevisionName={initialDefaultRevisionName}
        onSaveDefaultRevisionName={onSaveDefaultRevisionName}
        projectPath={projectPath}
      />

      <Dialog
        open={isPreferencesModalOpen}
        onOpenChange={onDialogClose(setIsPreferencesModalOpen)}
      >
        <DialogContent maxWidth="max-w-[820px]" aria-describedby={undefined}>
          <UserPreferencesPage
            renderInModal
            onClose={() => setIsPreferencesModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isHelpModalOpen}
        onOpenChange={onDialogClose(setIsHelpModalOpen)}
      >
        <DialogContent maxWidth="max-w-[860px]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Help</DialogTitle>
          <HelpPage renderInModal onClose={() => setIsHelpModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isProjectTypesModalOpen}
        onOpenChange={onDialogClose(setIsProjectTypesModalOpen)}
      >
        <DialogContent maxWidth="max-w-[1200px]" aria-describedby={undefined}>
          {isProjectTypesLoading ? (
            <>
              <DialogTitle className="sr-only">Project Types</DialogTitle>
              <div className="appshell-modal-message">
                Loading project types...
              </div>
            </>
          ) : projectTypesLoadError ? (
            <>
              <DialogTitle className="sr-only">Project Types</DialogTitle>
              <div className="appshell-modal-message appshell-modal-message--error">
                {projectTypesLoadError}
              </div>
            </>
          ) : (
            <ProjectTypesManagerPage
              initialTemplates={projectTypeTemplates}
              renderInModal
              onClose={() => setIsProjectTypesModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
