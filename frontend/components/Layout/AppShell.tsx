"use client";
/**
 * @module Layout/AppShell
 *
 * Main three-pane application shell coordinating:
 * - Left pane: resource tree navigation and context actions (resizable, collapsible).
 * - Center pane: active work-area view (edit/diff/organizer/data/timeline).
 * - Right pane: metadata editing controls for the selected resource (resizable, collapsible).
 *
 * Responsibilities include view switching, modal orchestration for
 * create/export/compile flows, resizable/collapsible split panes, and debounced persistence
 * of editor content.
 */
import React, { useState, useEffect } from "react";
import type {
  AnyResource,
  EditorBodyConfig,
  ViewName,
  Project as CanonicalProject,
  ResourceType,
  Folder,
  ResourceRef,
} from "../../src/lib/models/types";
import { shallowEqual } from "react-redux";
import {
  getProjectDirectoryId,
  removeResource,
  selectActiveProjectDirectoryId,
  selectActiveProjectMetadataSchema,
  selectActiveProjectStatuses,
  selectTimelineViewEnabled,
} from "../../src/store/projectsSlice";
import { setEditorConfig } from "../../src/store/editorConfigSlice";
import ResourceTree from "../ResourceTree/ResourceTree";
import SmartFolders from "../ResourceTree/SmartFolders";
import QueryBuilder from "../QueryBuilder/QueryBuilder";
import SaveQueryDialog from "../QueryBuilder/SaveQueryDialog";
import { buildFieldPickerFields } from "../QueryBuilder/FieldPicker";
import { filterResourceOptionsByScope } from "../Sidebar/folderScope";
import { astToGroups } from "../QueryBuilder/ast-chip-bridge";
import { useQueryBuilderState } from "../QueryBuilder/useQueryBuilderState";
import ShellLayoutController, {
  ShellLayoutProvider,
} from "./ShellLayoutController";
import ShellDrawer from "./ShellDrawer";
import ShellSidebarToggle from "./ShellSidebarToggle";
import ShellSettingsMenu, {
  type SettingsMenuAction,
} from "./ShellSettingsMenu";
import ShellModalCoordinator from "./ShellModalCoordinator";
import ShellProjectTypeLoader from "./ShellProjectTypeLoader";
import type { ResourceContextAction } from "../ResourceTree/ResourceContextMenu";
import SidebarContextMenu from "../ResourceTree/SidebarContextMenu";
import ViewSwitcher from "../WorkArea/ViewSwitcher";
import EditView from "../WorkArea/EditView";
import MediaView from "../WorkArea/Media/MediaView";
import DiffViewController from "../WorkArea/DiffViewController";
import OrganizerView from "../WorkArea/Views/OrganizerView/OrganizerView";
import DataView from "../WorkArea/DataView";
import TimelineView from "../WorkArea/Views/TimelineView";
import MetadataSidebar from "../Sidebar/MetadataSidebar";
import SearchBar from "../SearchBar/SearchBar";
import {
  saveHeadingSettings,
  saveBodySettings,
} from "../../src/lib/api/editor-config";
import {
  saveProjectPreferences,
  saveRevisionSettings,
} from "../../src/lib/api/preferences";
import { renameResource } from "../../src/lib/api/resources";
import {
  compilePdf,
  compileDocx,
  compileText,
  compileMarkdown,
} from "../../src/lib/api/compile";
import { formatRelativeTimestamp as _formatRelativeTimestamp } from "../../src/lib/timestamp-utils";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  Image as ImageIcon,
  Music2,
  Plus,
} from "lucide-react";
import Button from "../common/UI/Button/Button";
import { type ExportFormat } from "../common/ExportPreviewModal";
import UpdateNotice from "./UpdateNotice";
import { APP_VERSION } from "../../src/lib/app-version";
import { useAuthSession } from "../../src/lib/auth/use-auth-session";
import {
  signOut as authSignOut,
  revokeSessions as authRevokeSessions,
} from "../../src/lib/auth/auth-client";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import {
  selectResource,
  selectResources,
  selectFolders,
  setSelectedResourceId,
  updateResource,
  updateFolder,
} from "../../src/store/resourcesSlice";
import {
  loadSavedQueries,
  evaluateQuery,
  deleteQuery,
  selectActiveQueryIds,
  selectIsEvaluating,
  selectSavedQueriesList,
  type SavedQuery,
} from "../../src/store/querySlice";
import type { QueryAST } from "../../src/lib/models/query-ast";
import {
  selectIsSavingRevision,
  selectDeletingRevisionId,
  selectFetchingRevisionId,
} from "../../src/store/revisionsSlice";
import type {
  SyncBlocker,
  ShellContextActionState as ContextActionState,
  ShellCreateModalState as CreateModalState,
  ShellExportModalState as ExportModalState,
  ShellCompileModalState as CompileModalState,
  ShellRenameModalState as RenameModalState,
} from "./ShellModalCoordinator";
import {
  buildCompileTree,
  getDescendantLeafIds,
} from "../common/compileSelection";
import {
  getStoredGlobalAppearancePreferences,
  type ColorMode,
  resolvePreferredColorMode,
  saveGlobalAppearancePreferences,
  saveGlobalColorMode,
} from "../../src/lib/user-preferences";
import type { MetadataValue } from "../../src/lib/models/types";
import type { EditorHeadingMap } from "../../src/lib/editor-heading-settings";
import {
  selectEditorConfig,
  selectResolvedEditorConfig,
} from "../../src/store/editorConfigSlice";
import { toastService } from "../../src/lib/toast-service";

/**
 * Optional payload bag forwarded to `onResourceAction` callbacks.
 */
export interface AppShellResourceActionOptions {
  [key: string]: unknown;
}

/**
 * Props accepted by {@link AppShell}.
 */
export interface AppShellProps {
  /** Optional fallback content rendered when no resource is selected. */
  children?: React.ReactNode;
  /** Toggles left/right sidebars and drag handles. */
  showSidebars?: boolean;
  /** Full resource list for the currently opened project. */
  resources?: AnyResource[];
  /** Folder list used by resource tree and create modal parent selector. */
  folders?: Folder[];
  /** Active project record backing current shell state. */
  project?: CanonicalProject | null;
  /** Called when a resource is selected from search/tree interactions. */
  onResourceSelect?: (id: string) => void;
  /** ID of currently selected resource (if any). */
  selectedResourceId?: string | null;
  /** Metadata callback for synopsis field updates. */
  onChangeSynopsis?: (text: string, resourceId: string) => void;
  /** Metadata callback for notes field updates. */
  onChangeNotes?: (text: string, resourceId: string) => void;
  /** Metadata callback for status updates. */
  onChangeStatus?: (
    status: "draft" | "in-review" | "published",
    resourceId: string,
  ) => void;
  /** Metadata callback for point-of-view updates. */
  onChangePOV?: (pov: ResourceRef, resourceId: string) => void;
  /** Metadata callback for dynamic metadata updates. */
  onChangeDynamicMetadata?: (
    metadata: Record<string, string[]>,
    resourceId: string,
  ) => void;
  /** Metadata callback for story date/time updates. */
  onChangeStoryDate?: (date: string, resourceId: string) => void;
  /** Metadata callback for story duration updates. */
  onChangeStoryDuration?: (duration: number | null, resourceId: string) => void;
  /** Metadata callback for story end date override updates. */
  onChangeStoryEndDate?: (endDate: string | null, resourceId: string) => void;
  /**
   * General resource action handler used by tree and modal flows.
   *
   * Examples: create, duplicate, delete, export.
   */
  onResourceAction?: (
    action: ResourceContextAction,
    resourceId?: string,
    opts?: AppShellResourceActionOptions,
  ) => Promise<void>;
  /** Closes the active project and returns to the start page. */
  onCloseProject?: () => void;
  /** Called when the user creates an image or audio resource via the modal. */
  onMediaCreateConfirmed?: (
    file: File,
    opts: { title: string; folderId?: string },
  ) => Promise<void>;
}

/**
 * Three-column app shell used in the main app and Storybook.
 *
 * Layout:
 * - Left pane: `ResourceTree` and tree actions (resizable, collapsible).
 * - Center pane: `ViewSwitcher`, search, and active work view (constant width).
 * - Right pane: `MetadataSidebar` bound to selected resource (resizable, collapsible).
 *
 * @param props - {@link AppShellProps}.
 * @returns Top-level app shell layout.
 */
export default function AppShell({
  children,
  showSidebars = true,
  resources,
  folders,
  onResourceSelect,
  selectedResourceId,
  onChangeSynopsis,
  onChangeNotes,
  onChangeStatus,
  onChangePOV,
  onChangeDynamicMetadata,
  onChangeStoryDate,
  onChangeStoryDuration,
  onChangeStoryEndDate,
  onResourceAction,
  onCloseProject,
  onMediaCreateConfirmed,
  project,
}: AppShellProps): JSX.Element {
  const { isAuthenticated } = useAuthSession();
  const [view, setView] = useState<ViewName>("edit");
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState<boolean>(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState<boolean>(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] =
    useState<boolean>(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] =
    useState<boolean>(false);
  const [isProjectTypesModalOpen, setIsProjectTypesModalOpen] =
    useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isResourcePaletteOpen, setIsResourcePaletteOpen] =
    useState<boolean>(false);
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const [hasUnsavedEditorChanges, setHasUnsavedEditorChanges] =
    useState<boolean>(false);
  const [isCloseProjectConfirmOpen, setIsCloseProjectConfirmOpen] =
    useState<boolean>(false);
  const [activeSmartFolderId, setActiveSmartFolderId] = useState<string | null>(
    null,
  );
  const [isQueryBuilderOpen, setIsQueryBuilderOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
  const combined = React.useMemo(() => {
    return [...(resources ?? []), ...(folders ?? [])];
  }, [resources, folders]);
  const selectedResource = useAppSelector(
    (state) => selectResource(state.resources),
    shallowEqual,
  );
  const liveResources = useAppSelector((s) => selectResources(s.resources));
  const liveFolders = useAppSelector((s) => selectFolders(s.resources));
  const activeQueryIds = useAppSelector(selectActiveQueryIds);
  const isQueryEvaluating = useAppSelector(selectIsEvaluating);
  const metadataSchema = useAppSelector(selectActiveProjectMetadataSchema);
  const isTimelineViewEnabled = useAppSelector(selectTimelineViewEnabled);

  // Compile and export write plaintext wherever they land, so the preview
  // modals warn first when the source is encrypted (FR27).
  const activeProjectDirectoryId = useAppSelector(
    selectActiveProjectDirectoryId,
  );
  const isActiveProjectEncrypted = useAppSelector((state) =>
    activeProjectDirectoryId
      ? (state.crypto?.encryptedProjectIds ?? []).includes(
          activeProjectDirectoryId,
        )
      : false,
  );
  const savedQueriesList = useAppSelector(selectSavedQueriesList);
  const liveEditorConfig = useAppSelector(selectEditorConfig);
  const resolvedEditorConfig = useAppSelector(selectResolvedEditorConfig);
  const qb = useQueryBuilderState();
  const projectStatuses = useAppSelector(
    selectActiveProjectStatuses,
    shallowEqual,
  );
  const availableFields = React.useMemo(
    () => buildFieldPickerFields(metadataSchema, projectStatuses),
    [metadataSchema, projectStatuses],
  );
  const resolveResourceOptions = React.useCallback(
    (refFolder: string | undefined, includeSubfolders?: boolean) => {
      return filterResourceOptionsByScope(
        (liveResources ?? []).map((r) => ({
          id: r.id,
          name: r.name ?? "",
          folderId: r.folderId,
        })),
        liveFolders ?? [],
        refFolder,
        includeSubfolders,
      );
    },
    [liveResources, liveFolders],
  );

  const resolveFolderOptions = React.useCallback(() => {
    return (liveFolders ?? [])
      .filter((f) => f.name)
      .map((f) => ({ id: f.id, name: f.name }));
  }, [liveFolders]);
  const currentAst = React.useMemo(
    () =>
      qb.isAdvanced && qb.rawAst
        ? qb.rawAst
        : (qb.buildAst() ?? { op: "and" as const, children: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qb.isAdvanced, qb.rawAst, qb.groups, qb.globalCombinator],
  );

  useEffect(() => {
    if (selectedResource?.type === "text") {
      setView((current) => (current === "organizer" ? "edit" : current));
      setActiveSmartFolderId(null);
      setIsQueryBuilderOpen(false);
    } else if (selectedResource?.type === "folder") {
      setView((current) =>
        current === "edit" || current === "diff" ? "organizer" : current,
      );
      setActiveSmartFolderId(null);
      setIsQueryBuilderOpen(false);
    } else if (
      selectedResource?.type === "image" ||
      selectedResource?.type === "audio"
    ) {
      // Surface media in the (reused) edit view when the current view can't
      // display it. Leave "edit" and the project-wide "data" view untouched.
      setView((current) =>
        current === "organizer" || current === "diff" || current === "timeline"
          ? "edit"
          : current,
      );
      setActiveSmartFolderId(null);
      setIsQueryBuilderOpen(false);
    }
  }, [selectedResource?.id, selectedResource?.type]);

  // When the Timeline view is turned off, never strand the user on the (now
  // hidden) Timeline view — fall back to a sensible default for the selection.
  useEffect(() => {
    if (isTimelineViewEnabled) return;
    setView((current) => {
      if (current !== "timeline") return current;
      return selectedResource?.type === "folder" ? "organizer" : "edit";
    });
  }, [isTimelineViewEnabled, selectedResource?.type]);

  const isSavingRevision = useAppSelector(selectIsSavingRevision);
  const deletingRevisionId = useAppSelector(selectDeletingRevisionId);
  const fetchingRevisionId = useAppSelector(selectFetchingRevisionId);
  const [recentTimestampTick, setRecentTimestampTick] = useState<number>(
    Date.now(),
  );

  const recentResources = React.useMemo(() => {
    return [...liveResources]
      .filter((resource) => resource.type !== "folder")
      .sort((left, right) => {
        const leftTimestamp = Date.parse(
          left.updatedAt ?? left.createdAt ?? "",
        );
        const rightTimestamp = Date.parse(
          right.updatedAt ?? right.createdAt ?? "",
        );
        const leftSafe = Number.isNaN(leftTimestamp) ? 0 : leftTimestamp;
        const rightSafe = Number.isNaN(rightTimestamp) ? 0 : rightTimestamp;
        return rightSafe - leftSafe;
      })
      .slice(0, 6);
  }, [liveResources]);

  const syncBlockers = React.useMemo<SyncBlocker[]>(() => {
    const blockers: SyncBlocker[] = [];
    if (hasUnsavedEditorChanges)
      blockers.push({ id: "editor-content", label: "Editor content" });
    if (isSavingRevision)
      blockers.push({ id: "revision-save", label: "Saving revision" });
    if (deletingRevisionId)
      blockers.push({ id: "revision-delete", label: "Deleting revision" });
    if (fetchingRevisionId)
      blockers.push({
        id: "revision-fetch",
        label: "Loading revision preview",
      });
    return blockers;
  }, [
    hasUnsavedEditorChanges,
    isSavingRevision,
    deletingRevisionId,
    fetchingRevisionId,
  ]);

  const formatRelativeTimestamp = React.useCallback(
    (timestamp: string | undefined): string =>
      _formatRelativeTimestamp(timestamp, recentTimestampTick),
    [recentTimestampTick],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRecentTimestampTick(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  /**
   * Extracts a best-effort display name from resource-like objects.
   *
   * @param r - Resource-like object that may expose `name` or `title`.
   * @returns Resolved display name, or empty string when unavailable.
   */
  const getResourceName = (
    r: { name?: string; title?: string } | null | undefined,
  ): string => (r && (r.name ?? r.title ?? "")) || "";

  /**
   * Returns plain-text content used by edit/diff views.
   *
   * @param r - Resource-like object containing persisted plain-text content.
   * @returns Plain-text content for view rendering.
   */
  const getResourceContent = (r: unknown): string | undefined =>
    (r as { plaintext?: string } | null | undefined)?.plaintext;

  const [contextAction, setContextAction] = useState<ContextActionState>({
    open: false,
  });

  /**
   * Handles context-menu actions from `ResourceTree` and routes them to
   * confirmation/modals or forwards directly to `onResourceAction`.
   *
   * @param action - Requested context action.
   * @param resourceId - Target resource id for the action (when applicable).
   * @param resourceTitle - Optional resource title used by modal labels.
   */
  const handleResourceAction = async (
    action: ResourceContextAction,
    resourceId?: string,
    resourceTitle?: string,
  ) => {
    // For destructive actions show a confirmation dialog.
    if (action === "delete") {
      setContextAction({ open: true, action, resourceId, resourceTitle });
      return;
    }

    // For create/copy/duplicate/show modals locally and confirm before forwarding
    if (action === "create") {
      const clickedItem = combined.find((r) => r.id === resourceId);
      const isFolder = clickedItem?.type === "folder";
      const effectiveParentId = isFolder
        ? resourceId
        : ((clickedItem as AnyResource & { folderId?: string })?.folderId ??
          undefined);
      setCreateModal({
        open: true,
        parentId: effectiveParentId,
        initialTitle: "",
      });
      return;
    }

    if (action === "copy" || action === "duplicate") {
      setCreateModal({
        open: true,
        sourceResourceId: resourceId,
        initialTitle: `${resourceTitle ?? "Resource"} (Copy)`,
      });
      return;
    }

    if (action === "rename") {
      setRenameModal({ open: true, resourceId, resourceTitle });
      return;
    }

    if (action === "smart-folder") {
      handleNewQuery();
      return;
    }

    if (action === "export") {
      const allItems = [...(resources ?? []), ...(folders ?? [])];
      const nameById = new Map(allItems.map((r) => [r.id, r.name]));
      const isFolder = (folders ?? []).some((f) => f.id === resourceId);
      let resolvedIds: string[] = [];
      if (resourceId) {
        if (isFolder) {
          const tree = buildCompileTree(allItems);
          resolvedIds = getDescendantLeafIds(resourceId, tree);
        } else {
          resolvedIds = [resourceId];
        }
      }
      const resolvedTitle = nameById.get(resourceId ?? "") ?? resourceTitle;
      const resolvedNames = resolvedIds.map((id) => nameById.get(id) ?? id);
      setExportModal({
        open: true,
        resourceId,
        resourceTitle: resolvedTitle,
        resourceIds: resolvedIds,
        resourceNames: resolvedNames,
      });
      return;
    }

    // Fallback forward
    await onResourceAction?.(action, resourceId);
  };

  const [createModal, setCreateModal] = useState<CreateModalState>({
    open: false,
  });
  const [exportModal, setExportModal] = useState<ExportModalState>({
    open: false,
  });
  const [compileModal, setCompileModal] = useState<CompileModalState>({
    open: false,
  });
  const [renameModal, setRenameModal] = useState<RenameModalState>({
    open: false,
  });

  const handleRenameConfirm = async (newName: string): Promise<void> => {
    if (!renameModal.resourceId || !project?.rootPath) return;
    const resourceId = renameModal.resourceId;
    const isFolder = (folders ?? []).some((f) => f.id === resourceId);
    try {
      // `project.rootPath`'s directory basename is the `projectId` every
      // tenant-scoped resource route (ADR-017/018) expects — see
      // `selectActiveProjectDirectoryId`'s doc comment in `projectsSlice.ts`
      // for the FR12 distinction from `project.id`.
      const isOk = await renameResource(
        resourceId,
        getProjectDirectoryId(project.rootPath),
        newName,
        isFolder ? "folder" : "resource",
      );
      if (!isOk) return;
      if (isFolder) {
        dispatch(updateFolder({ id: resourceId, name: newName }));
      } else {
        dispatch(updateResource({ id: resourceId, name: newName }));
      }
    } finally {
      setRenameModal({ open: false });
    }
  };

  /**
   * Handles create-modal confirmation and forwards creation payload upstream.
   *
   * @param payload - Creation payload from `CreateResourceModal`.
   * @param parentId - Optional parent resource/folder id for nesting.
   * @param _opts - Optional callback options from modal (currently unused).
   */
  const handleCreateConfirmed = async (
    payload: { title: string; type: ResourceType | string; folderId?: string },
    parentId?: string,
  ) => {
    if (createModal.sourceResourceId) {
      await onResourceAction?.("copy", createModal.sourceResourceId, {
        title: payload.title,
      });
    } else {
      await onResourceAction?.("create", parentId, payload);
    }
    setCreateModal({ open: false });
  };

  /**
   * Handles export preview confirmation and forwards export action upstream.
   *
   * @param resourceIds - Resolved leaf resource IDs to export.
   * @param resourceId - The original right-clicked node (folder or leaf).
   */
  const handleExportConfirmed = async (
    resourceIds: string[],
    resourceId?: string,
    format?: ExportFormat,
  ) => {
    await onResourceAction?.("export", resourceId, { resourceIds, format });
    setExportModal({ open: false });
  };

  const _prevProjectId = React.useRef<string | undefined | null>(undefined);
  useEffect(() => {
    if (_prevProjectId.current !== project?.id) {
      _prevProjectId.current = project?.id;
    }
  }, [project?.id]);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (project?.id) {
      dispatch(loadSavedQueries({ projectId: project.id }));
    }
  }, [project?.id, dispatch]);

  const handleSmartFolderSelect = (query: SavedQuery): void => {
    if (!project?.id) return;
    setActiveSmartFolderId(query.id);
    setView("data");
    dispatch(
      evaluateQuery({
        projectId: project.id,
        definition: query.definition as QueryAST,
      }),
    );
    // Pre-populate QueryBuilder with the query so the user can refine it
    const restored = astToGroups(
      query.definition as QueryAST,
      availableFields,
      savedQueriesList,
    );
    if (restored) {
      qb.reset({
        groups: restored.groups,
        combinator: restored.globalCombinator,
      });
    } else {
      qb.reset({ rawAst: query.definition as QueryAST });
    }
    setEditingQuery(query);
    setIsQueryBuilderOpen(true);
  };

  const handleNewQuery = (): void => {
    qb.reset();
    setEditingQuery(null);
    setActiveSmartFolderId(null);
    setIsQueryBuilderOpen(true);
    setView("data");
  };

  const handleEditQuery = (query: SavedQuery): void => {
    const restored = astToGroups(
      query.definition as QueryAST,
      availableFields,
      savedQueriesList,
    );
    if (restored) {
      qb.reset({
        groups: restored.groups,
        combinator: restored.globalCombinator,
      });
    } else {
      qb.reset({ rawAst: query.definition as QueryAST });
    }
    setEditingQuery(query);
    setIsQueryBuilderOpen(true);
    setActiveSmartFolderId(query.id);
    setView("data");
    if (project?.id) {
      dispatch(
        evaluateQuery({
          projectId: project.id,
          definition: query.definition as QueryAST,
        }),
      );
    }
  };

  const handleDeleteQuery = (queryId: string): void => {
    if (!project?.id) return;
    dispatch(deleteQuery({ projectId: project.id, queryId }));
    if (activeSmartFolderId === queryId) {
      setActiveSmartFolderId(null);
      setIsQueryBuilderOpen(false);
      setEditingQuery(null);
    }
  };

  const handleSaveRequest = (): void => {
    setIsSaveDialogOpen(true);
  };

  const handleQuerySaved = (savedId: string): void => {
    setIsSaveDialogOpen(false);
    setEditingQuery(null);
    if (!project?.id) return;
    setActiveSmartFolderId(savedId);
    dispatch(evaluateQuery({ projectId: project.id, definition: currentAst }));
  };

  useEffect(() => {
    setHasUnsavedEditorChanges(false);
  }, [project?.id, selectedResourceId]);

  useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      const isCommandPaletteShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isCommandPaletteShortcut) {
        event.preventDefault();
        setIsSettingsMenuOpen(false);
        setIsResourcePaletteOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setIsPreferencesModalOpen(false);
        setIsProjectTypesModalOpen(false);
        setIsHelpModalOpen(false);
        setIsResourcePaletteOpen(false);
      }
    };

    document.addEventListener("keydown", onDocumentKeyDown);

    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, []);

  useEffect(() => {
    const metadata = project?.metadata as
      | Record<string, MetadataValue>
      | undefined;
    setColorMode(resolvePreferredColorMode(metadata));
  }, [project?.id, project?.metadata]);

  const isDarkMode = colorMode === "dark";
  const persistColorModePreference = async (
    nextMode: ColorMode,
  ): Promise<void> => {
    const appearance = getStoredGlobalAppearancePreferences();
    saveGlobalAppearancePreferences({
      ...appearance,
      colorModePreference: nextMode,
    });
    saveGlobalColorMode(nextMode);

    if (!project?.rootPath) {
      return;
    }

    try {
      // Directory basename, not `project.id` (project.json's independently
      // generated internal id) — see `selectActiveProjectDirectoryId`'s doc
      // comment in `projectsSlice.ts`.
      await saveProjectPreferences(getProjectDirectoryId(project.rootPath), {
        colorMode: nextMode,
      });
    } catch (error) {
      console.error("Failed to persist project user preferences", error);
    }
  };

  const handleToggleColorMode = () => {
    setColorMode((previous) => {
      const nextMode: ColorMode = previous === "dark" ? "light" : "dark";
      void persistColorModePreference(nextMode);
      return nextMode;
    });
  };

  const handleSettingsMenuAction = (action: SettingsMenuAction): void => {
    switch (action) {
      case "preferences":
        setIsSettingsMenuOpen(false);
        setIsPreferencesModalOpen(true);
        break;
      case "project-settings":
        setIsSettingsMenuOpen(false);
        setIsProjectSettingsOpen(true);
        break;
      case "project-type-manager":
        setIsSettingsMenuOpen(false);
        setIsProjectTypesModalOpen(true);
        break;
      case "toggle-color-mode":
        handleToggleColorMode();
        break;
      case "help":
        setIsSettingsMenuOpen(false);
        setIsHelpModalOpen(true);
        break;
      case "close-project":
        handleCloseProject();
        break;
      case "compile":
        setIsProjectMenuOpen(false);
        setCompileModal({ open: true });
        break;
      case "logout":
        setIsSettingsMenuOpen(false);
        void handleLogout();
        break;
      case "logout-everywhere":
        setIsSettingsMenuOpen(false);
        void handleLogoutEverywhere();
        break;
    }
  };

  /**
   * Single-session logout (FR17/FR22). Invalidates the server-side session
   * via better-auth's `signOut()` (not just the client-side cookie — see
   * `auth-client.ts`'s module doc), then redirects to `/login`. `/login` is
   * always the right destination here: this menu item is only reachable
   * when `isAuthenticated` is already `true` (hosted auth active + a real
   * session), so hosted auth cannot have "become inactive" between the
   * click and the redirect in practice.
   */
  const handleLogout = async (): Promise<void> => {
    await authSignOut();
    window.location.assign("/login");
  };

  /**
   * "Log out everywhere" (FR17/FR22) — revokes every session for the
   * current user via better-auth's `revokeSessions()`, then redirects to
   * `/login`. See {@link handleLogout} for why `/login` is always the
   * correct redirect target from this authenticated-only menu item.
   */
  const handleLogoutEverywhere = async (): Promise<void> => {
    await authRevokeSessions();
    window.location.assign("/login");
  };

  const handleCloseProject = (): void => {
    setIsSettingsMenuOpen(false);
    setIsProjectSettingsOpen(false);
    setIsPreferencesModalOpen(false);
    setIsProjectTypesModalOpen(false);
    setIsHelpModalOpen(false);

    if (syncBlockers.length > 0) {
      setIsCloseProjectConfirmOpen(true);
      return;
    }

    onCloseProject?.();
  };

  const handleConfirmCloseProject = (): void => {
    setIsCloseProjectConfirmOpen(false);
    setHasUnsavedEditorChanges(false);
    onCloseProject?.();
  };

  const handleSaveHeadingSettings = async (
    headings: EditorHeadingMap,
  ): Promise<void> => {
    if (!project?.rootPath) {
      throw new Error("Project path unavailable for heading settings.");
    }

    // Directory basename, not `project.id` (project.json's independently
    // generated internal id) — see `selectActiveProjectDirectoryId`'s doc
    // comment in `projectsSlice.ts`.
    const body = await saveHeadingSettings(
      getProjectDirectoryId(project.rootPath),
      headings,
    );
    dispatch(
      setEditorConfig({
        headings: body.editorConfig?.headings ?? {},
        body: body.editorConfig?.body,
      }),
    );
  };

  const handleSaveBodySettings = async (
    bodyConfig: EditorBodyConfig,
  ): Promise<void> => {
    if (!project?.rootPath) {
      throw new Error("Project path unavailable for body settings.");
    }

    // Directory basename, not `project.id` (project.json's independently
    // generated internal id) — see `selectActiveProjectDirectoryId`'s doc
    // comment in `projectsSlice.ts`.
    const responseBody = await saveBodySettings(
      getProjectDirectoryId(project.rootPath),
      bodyConfig,
    );
    dispatch(
      setEditorConfig({
        headings: responseBody.editorConfig?.headings ?? {},
        body: responseBody.editorConfig?.body,
      }),
    );
  };

  const handleSaveDefaultRevisionName = async (name: string): Promise<void> => {
    if (!project?.rootPath) {
      throw new Error("Project path unavailable.");
    }
    // Directory basename, not `project.id` (project.json's independently
    // generated internal id) — see `selectActiveProjectDirectoryId`'s doc
    // comment in `projectsSlice.ts`.
    await saveRevisionSettings(getProjectDirectoryId(project.rootPath), name);
  };

  function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Left-sidebar body, shared by the docked pane (tablet/desktop) and the
  // phone overlay drawer so the tree is only ever mounted once per render.
  const leftSidebarBody = project ? (
    <SidebarContextMenu
      className="appshell-sidebar-content"
      onCreateResource={() => handleResourceAction("create")}
      onCreateSmartFolder={handleNewQuery}
    >
      <ResourceTree debug={false} onResourceAction={handleResourceAction} />
      <SmartFolders
        selectedQueryId={activeSmartFolderId ?? undefined}
        onSelect={handleSmartFolderSelect}
        onNewQuery={handleNewQuery}
        onEditQuery={handleEditQuery}
        onDeleteQuery={handleDeleteQuery}
      />
    </SidebarContextMenu>
  ) : (
    <div className="appshell-sidebar-content space-y-2">
      <p>Loading Resource Tree</p>
    </div>
  );

  // Right-sidebar (metadata) body, shared by the docked pane (desktop) and the
  // phone/tablet overlay drawer.
  const rightSidebarBody = (
    <div className="appshell-sidebar-content">
      <MetadataSidebar
        onChangeField={(key, value) => {
          if (!selectedResource) return;
          const id = selectedResource.id;
          switch (key) {
            case "synopsis":
              onChangeSynopsis?.(value as string, id);
              break;
            case "notes":
              onChangeNotes?.(value as string, id);
              break;
            case "status":
              onChangeStatus?.(
                value as "draft" | "in-review" | "published",
                id,
              );
              break;
            case "pov":
              onChangePOV?.(value as ResourceRef, id);
              break;
            case "storyDate":
              onChangeStoryDate?.(value as string, id);
              break;
            case "storyDuration":
              onChangeStoryDuration?.(value as number | null, id);
              break;
            case "storyEndDate":
              onChangeStoryEndDate?.(value as string | null, id);
              break;
            default:
              onChangeDynamicMetadata?.({ [key]: value as string[] }, id);
              break;
          }
        }}
      />
    </div>
  );

  return (
    <div
      className={`appshell-shell ${isDarkMode ? "appshell-theme-dark" : ""}`}
    >
      <ShellLayoutProvider>
        <UpdateNotice />

        <ShellSettingsMenu
          projectName={project?.name}
          isDarkMode={isDarkMode}
          isOpen={isSettingsMenuOpen}
          onClose={() => setIsSettingsMenuOpen(false)}
          onToggleOpen={() => setIsSettingsMenuOpen((prev) => !prev)}
          hasProject={Boolean(project)}
          isProjectMenuOpen={isProjectMenuOpen}
          onCloseProjectMenu={() => setIsProjectMenuOpen(false)}
          onToggleProjectMenuOpen={() => setIsProjectMenuOpen((prev) => !prev)}
          onAction={handleSettingsMenuAction}
          appVersion={APP_VERSION}
          isAuthenticated={isAuthenticated}
          leadingSlot={
            showSidebars ? <ShellSidebarToggle side="left" /> : undefined
          }
          trailingSlot={
            showSidebars ? <ShellSidebarToggle side="right" /> : undefined
          }
        />

        <ShellLayoutController>
          {(layout) => (
            <div className="appshell-body">
              {/* Left Sidebar — docked (tablet/desktop). The `md:flex` CSS gate
                keeps the pre-hydration (tier-"desktop") paint correct at phone
                width; the tier check swaps in the drawer once hydrated. */}
              {showSidebars && layout.tier !== "phone" && layout.leftOpen ? (
                <aside
                  className="hidden md:flex appshell-sidebar border-r"
                  style={{ width: layout.leftWidth }}
                >
                  <div className="appshell-sidebar-header">
                    <span className="font-mono text-gw-nano uppercase tracking-label-wide font-semibold text-gw-secondary">
                      Resources
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => layout.setLeftOpen(false)}
                      title="Close left sidebar"
                      aria-label="Close resource sidebar"
                    >
                      <PanelLeftClose size={16} aria-hidden="true" />
                    </Button>
                  </div>
                  {leftSidebarBody}
                </aside>
              ) : null}

              {/* Left Sidebar Collapsed Toggle — docked (tablet/desktop) */}
              {showSidebars && layout.tier !== "phone" && !layout.leftOpen ? (
                <div className="hidden md:flex flex-col items-center justify-start h-full p-2 bg-gw-chrome border-r border-hairline border-gw-border">
                  <Button
                    variant="icon"
                    className="w-10 h-10"
                    onClick={() => layout.setLeftOpen(true)}
                    title="Open left sidebar"
                    aria-label="Open resource sidebar"
                  >
                    <PanelLeftOpen size={16} aria-hidden="true" />
                  </Button>
                </div>
              ) : null}

              {/* Left Sidebar — phone overlay drawer */}
              {showSidebars && layout.tier === "phone" ? (
                <ShellDrawer
                  side="left"
                  open={layout.leftOpen}
                  onClose={() => layout.setLeftOpen(false)}
                  title="Resources"
                >
                  {leftSidebarBody}
                </ShellDrawer>
              ) : null}

              <ShellProjectTypeLoader isOpen={isProjectTypesModalOpen}>
                {({
                  projectTypeTemplates,
                  isProjectTypesLoading,
                  projectTypesLoadError,
                }) => (
                  <ShellModalCoordinator
                    isProjectEncrypted={isActiveProjectEncrypted}
                    contextAction={contextAction}
                    setContextAction={setContextAction}
                    isCloseProjectConfirmOpen={isCloseProjectConfirmOpen}
                    setIsCloseProjectConfirmOpen={setIsCloseProjectConfirmOpen}
                    createModal={createModal}
                    setCreateModal={setCreateModal}
                    exportModal={exportModal}
                    setExportModal={setExportModal}
                    compileModal={compileModal}
                    setCompileModal={setCompileModal}
                    renameModal={renameModal}
                    setRenameModal={setRenameModal}
                    onRenameConfirm={handleRenameConfirm}
                    isProjectSettingsOpen={isProjectSettingsOpen}
                    setIsProjectSettingsOpen={setIsProjectSettingsOpen}
                    initialHeadings={resolvedEditorConfig.headings}
                    onSaveHeadingSettings={handleSaveHeadingSettings}
                    initialBodySettings={liveEditorConfig.body}
                    onSaveBodySettings={handleSaveBodySettings}
                    initialDefaultRevisionName={
                      project?.config?.defaultRevisionName ?? "Initial Draft"
                    }
                    onSaveDefaultRevisionName={handleSaveDefaultRevisionName}
                    isPreferencesModalOpen={isPreferencesModalOpen}
                    setIsPreferencesModalOpen={setIsPreferencesModalOpen}
                    isHelpModalOpen={isHelpModalOpen}
                    setIsHelpModalOpen={setIsHelpModalOpen}
                    isProjectTypesModalOpen={isProjectTypesModalOpen}
                    setIsProjectTypesModalOpen={setIsProjectTypesModalOpen}
                    projectPath={project?.rootPath}
                    isResourcePaletteOpen={isResourcePaletteOpen}
                    setIsResourcePaletteOpen={setIsResourcePaletteOpen}
                    isProjectTypesLoading={isProjectTypesLoading}
                    projectTypesLoadError={projectTypesLoadError}
                    projectTypeTemplates={projectTypeTemplates}
                    resources={resources}
                    folders={liveFolders}
                    project={project}
                    hasUnsavedEditorChanges={hasUnsavedEditorChanges}
                    syncBlockers={syncBlockers}
                    onDeleteConfirm={async (resourceId) => {
                      if (project) {
                        dispatch(
                          removeResource({ projectId: project.id, resourceId }),
                        );
                      }
                      await onResourceAction?.("delete", resourceId);
                    }}
                    onCloseProjectConfirm={handleConfirmCloseProject}
                    onCreateConfirmed={async (payload, parentId) => {
                      await handleCreateConfirmed(payload, parentId);
                    }}
                    onMediaCreateConfirmed={onMediaCreateConfirmed}
                    onExportConfirmed={async (
                      resourceIds,
                      resourceId,
                      format,
                    ) => {
                      await handleExportConfirmed(
                        resourceIds,
                        resourceId,
                        format,
                      );
                    }}
                    onSelectResource={onResourceSelect}
                    onBuildCompilePreview={(resourceId) => {
                      const resource = resourceId
                        ? resources?.find((x) => x.id === resourceId)
                        : undefined;
                      if (resource) {
                        return (
                          `Compiled package for ${getResourceName(resource)}\n\n` +
                          JSON.stringify(resource, null, 2)
                        );
                      }
                      return (
                        "Compiled project bundle\n\n" +
                        JSON.stringify(resources ?? [], null, 2)
                      );
                    }}
                    onConfirmCompile={async (selectedIds, options) => {
                      if (!project?.rootPath) return;
                      const compileBody = {
                        // Directory basename, not `project.id` (project.json's
                        // independently generated internal id) — see
                        // `selectActiveProjectDirectoryId`'s doc comment in
                        // `projectsSlice.ts`.
                        projectId: getProjectDirectoryId(project.rootPath),
                        resourceIds: selectedIds,
                        resources: (resources ?? []).map((r) => ({
                          id: r.id,
                          name: r.name,
                          type: r.type,
                        })),
                        includeHeaders: options.includeHeaders,
                        projectName: project.name ?? "project",
                      };
                      const rawName = options.compilationName.trim();
                      try {
                        if (options.format === "pdf") {
                          const result = await compilePdf(compileBody);
                          if (result.warning === "font-fallback") {
                            toastService.info(
                              "PDF compiled with fallback fonts — IBM Plex fonts were unreachable",
                            );
                          }
                          triggerDownload(
                            new Blob([result.arrayBuffer], {
                              type: "application/pdf",
                            }),
                            rawName
                              ? rawName.endsWith(".pdf")
                                ? rawName
                                : `${rawName}.pdf`
                              : result.filename,
                          );
                          return;
                        }
                        if (options.format === "docx") {
                          const result = await compileDocx(compileBody);
                          triggerDownload(
                            new Blob([result.arrayBuffer], {
                              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            }),
                            rawName
                              ? rawName.endsWith(".docx")
                                ? rawName
                                : `${rawName}.docx`
                              : result.filename,
                          );
                          return;
                        }
                        if (options.format === "md") {
                          const result = await compileMarkdown(compileBody);
                          triggerDownload(
                            new Blob([result.markdown], {
                              type: "text/markdown;charset=utf-8",
                            }),
                            rawName
                              ? rawName.endsWith(".md")
                                ? rawName
                                : `${rawName}.md`
                              : result.filename,
                          );
                          if (result.warnings.length > 0) {
                            toastService.info(
                              `Some formatting couldn't be represented in Markdown: ${result.warnings
                                .map((w) => w.label)
                                .join(", ")}`,
                            );
                          }
                          return;
                        }
                        const result = await compileText(compileBody);
                        triggerDownload(
                          new Blob([result.text], {
                            type: "text/plain;charset=utf-8",
                          }),
                          rawName
                            ? rawName.endsWith(".txt")
                              ? rawName
                              : `${rawName}.txt`
                            : result.filename,
                        );
                      } catch (err) {
                        toastService.error(
                          "Compile failed",
                          err instanceof Error ? err.message : String(err),
                        );
                      }
                    }}
                  />
                )}
              </ShellProjectTypeLoader>

              {/* Left Resize Handle — docked tiers only */}
              {showSidebars && layout.tier !== "phone" && layout.leftOpen ? (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={layout.startLeftResize}
                  className="hidden md:block appshell-resize-handle"
                />
              ) : null}

              {/* Main Work Area */}
              <main className="appshell-work-area">
                <div className="appshell-work-area-content">
                  {resources ? (
                    <div className="shrink-0 w-full">
                      <div className="workarea-header border-b-hairline border-b-gw-border">
                        <ViewSwitcher
                          view={view}
                          onChange={setView}
                          editLabel={
                            selectedResource?.type === "image" ||
                            selectedResource?.type === "audio"
                              ? "Media"
                              : "Edit"
                          }
                          disabledViews={(() => {
                            const disabled: ViewName[] = [];
                            const type = selectedResource?.type;
                            const isMedia =
                              type === "image" || type === "audio";
                            // Edit/Media tab serves text and media resources.
                            if (type !== "text" && !isMedia) {
                              disabled.push("edit");
                            }
                            // Diff is text-only.
                            if (type !== "text") {
                              disabled.push("diff");
                            }
                            if (type !== "folder") {
                              disabled.push("organizer");
                            }
                            // The Timeline tab is gated behind its own view toggle
                            // (separate from the timeline date fields).
                            if (!isTimelineViewEnabled) {
                              disabled.push("timeline");
                            }
                            return Array.from(new Set(disabled));
                          })()}
                          disabledReasons={{
                            timeline:
                              "The Timeline view is off. Turn it on in User Preferences → Timeline view.",
                          }}
                        />
                        <div className="w-full min-w-0 sm:w-80 sm:flex-none">
                          <SearchBar
                            onSelect={(id) => onResourceSelect?.(id)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex-1 min-h-0 max-w-full mx-auto w-full flex flex-col">
                    <div
                      className={`flex-1 min-h-0 text-gw-primary flex flex-col ${
                        view === "edit" &&
                        Boolean(selectedResource) &&
                        (selectedResource?.type === "text" ||
                          selectedResource?.type === "image" ||
                          selectedResource?.type === "audio")
                          ? ""
                          : "overflow-y-auto"
                      }`}
                    >
                      {/* If a resource is selected, or the data view is active, render the chosen view; otherwise render empty state or children. */}
                      {(selectedResource && combined) || view === "data"
                        ? (() => {
                            if (view === "data") {
                              const queryResources = activeSmartFolderId
                                ? liveResources.filter((r) =>
                                    activeQueryIds.includes(r.id),
                                  )
                                : liveResources;
                              return (
                                <>
                                  {isQueryBuilderOpen && (
                                    <div className="mb-4">
                                      <QueryBuilder
                                        groups={qb.groups}
                                        globalCombinator={qb.globalCombinator}
                                        isAdvanced={qb.isAdvanced}
                                        rawAst={qb.rawAst}
                                        availableFields={availableFields}
                                        savedQueries={savedQueriesList}
                                        resolveResourceOptions={
                                          resolveResourceOptions
                                        }
                                        resolveFolderOptions={
                                          resolveFolderOptions
                                        }
                                        matchCount={
                                          activeSmartFolderId
                                            ? queryResources.length
                                            : undefined
                                        }
                                        onGlobalCombinatorChange={
                                          qb.onGlobalCombinatorChange
                                        }
                                        onGroupCombinatorChange={
                                          qb.onGroupCombinatorChange
                                        }
                                        onGroupAdd={qb.onGroupAdd}
                                        onGroupDelete={qb.onGroupDelete}
                                        onChipUpdate={qb.onChipUpdate}
                                        onChipAdd={qb.onChipAdd}
                                        onChipDelete={qb.onChipDelete}
                                        onChipDuplicate={qb.onChipDuplicate}
                                        onChipReorder={qb.onChipReorder}
                                        onRestoreFromAdvanced={
                                          qb.onRestoreFromAdvanced
                                        }
                                        onSaveRequest={handleSaveRequest}
                                      />
                                      <SaveQueryDialog
                                        isOpen={isSaveDialogOpen}
                                        definition={currentAst}
                                        projectId={project?.id ?? ""}
                                        onClose={() =>
                                          setIsSaveDialogOpen(false)
                                        }
                                        onSaved={handleQuerySaved}
                                        existingQuery={
                                          editingQuery ?? undefined
                                        }
                                      />
                                    </div>
                                  )}
                                  <DataView
                                    resources={queryResources}
                                    project={project ?? undefined}
                                    folders={liveFolders}
                                    isEvaluating={
                                      activeSmartFolderId
                                        ? isQueryEvaluating
                                        : false
                                    }
                                    onResourceClick={(id) => {
                                      dispatch(setSelectedResourceId(id));
                                      const clicked = queryResources.find(
                                        (r) => r.id === id,
                                      );
                                      if (clicked?.type === "text") {
                                        setView("edit");
                                      }
                                      if (activeSmartFolderId) {
                                        setActiveSmartFolderId(null);
                                        setIsQueryBuilderOpen(false);
                                      }
                                    }}
                                    onSelectFolder={(folderId) => {
                                      dispatch(setSelectedResourceId(folderId));
                                      setView("organizer");
                                    }}
                                  />
                                </>
                              );
                            }

                            if (!selectedResource)
                              return (
                                <div>
                                  <h2 className="workarea-section-title">
                                    Work Area
                                  </h2>
                                  <p className="mt-2 text-sm text-gw-secondary">
                                    Resource not found.
                                  </p>
                                </div>
                              );

                            switch (view) {
                              case "edit":
                                if (
                                  selectedResource.type === "image" ||
                                  selectedResource.type === "audio"
                                ) {
                                  return (
                                    <MediaView resource={selectedResource} />
                                  );
                                }
                                if (selectedResource.type !== "text") {
                                  return (
                                    <div>
                                      <h2 className="text-2xl font-semibold">
                                        Work Area
                                      </h2>
                                      <p className="mt-2 text-sm text-gw-secondary">
                                        Selected resource is not a text
                                        resource.
                                      </p>
                                    </div>
                                  );
                                }
                                return (
                                  <EditView
                                    onUnsavedChange={setHasUnsavedEditorChanges}
                                    initialContent={getResourceContent(
                                      selectedResource,
                                    )}
                                  />
                                );
                              case "diff":
                                return <DiffViewController />;
                              case "organizer":
                                return <OrganizerView />;
                              case "timeline":
                                // Defensive guard: the tab is disabled when the
                                // view is off, but never mount TimelineView even
                                // if the view state somehow lands here.
                                return isTimelineViewEnabled ? (
                                  <TimelineView />
                                ) : null;
                              default:
                                return (
                                  <div>
                                    <h2 className="workarea-section-title">
                                      Work Area
                                    </h2>
                                  </div>
                                );
                            }
                          })()
                        : project && showSidebars
                          ? (() => {
                              return (
                                <section className="mx-auto w-full max-w-4xl bg-gw-chrome p-6 md:p-8">
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                      <p className="font-mono text-gw-nano uppercase tracking-label-wide text-gw-secondary">
                                        Work Area
                                      </p>
                                      <h2 className="mt-2 text-3xl font-semibold text-gw-primary">
                                        {project.name}
                                      </h2>
                                      <p className="mt-2 text-sm text-gw-secondary">
                                        Select a file from the resource tree, or
                                        create a new resource to continue.
                                      </p>
                                    </div>

                                    <Button
                                      variant="secondary"
                                      onClick={() =>
                                        setCreateModal({
                                          open: true,
                                          initialTitle: "",
                                          parentId: undefined,
                                        })
                                      }
                                    >
                                      <Plus size={14} aria-hidden="true" />
                                      Create Resource
                                    </Button>
                                  </div>

                                  <div className="mt-8">
                                    <div className="mb-3 flex items-center justify-between">
                                      <h3 className="font-mono text-gw-nano font-semibold uppercase tracking-[0.16em] text-gw-secondary">
                                        Recent Files
                                      </h3>
                                      <span className="text-xs text-gw-secondary">
                                        {recentResources.length} shown
                                      </span>
                                    </div>

                                    {recentResources.length > 0 ? (
                                      <ul className="divide-y divide-gw-border rounded-lg border-hairline border-gw-border bg-gw-chrome">
                                        {recentResources.map((resource) => {
                                          const icon =
                                            resource.type === "image"
                                              ? ImageIcon
                                              : resource.type === "audio"
                                                ? Music2
                                                : FileText;

                                          const Icon = icon;

                                          return (
                                            <li key={resource.id}>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  onResourceSelect?.(
                                                    resource.id,
                                                  )
                                                }
                                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gw-chrome2"
                                              >
                                                <span className="flex min-w-0 items-center gap-3">
                                                  <Icon
                                                    size={16}
                                                    className="shrink-0 text-gw-secondary"
                                                    aria-hidden="true"
                                                  />
                                                  <span className="min-w-0">
                                                    <span className="block truncate text-sm font-medium text-gw-primary">
                                                      {resource.name}
                                                    </span>
                                                    <span className="block text-xs text-gw-secondary">
                                                      {resource.type}
                                                    </span>
                                                  </span>
                                                </span>
                                                <span className="text-xs text-gw-secondary">
                                                  {resource.updatedAt
                                                    ? `Edited ${formatRelativeTimestamp(resource.updatedAt)}`
                                                    : `Created ${formatRelativeTimestamp(resource.createdAt)}`}
                                                </span>
                                              </button>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    ) : (
                                      <div className="rounded-lg border border-dashed border-gw-border bg-gw-chrome px-4 py-6 text-sm text-gw-secondary">
                                        No files yet. Use{" "}
                                        <span className="font-medium text-gw-primary">
                                          Create Resource
                                        </span>{" "}
                                        to add your first text, image, or audio
                                        item.
                                      </div>
                                    )}
                                  </div>
                                </section>
                              );
                            })()
                          : (children ?? (
                              <div>
                                <h2 className="workarea-section-title">
                                  Work Area
                                </h2>
                                <p className="mt-2 text-sm text-gw-secondary">
                                  Placeholder editor and views go here.
                                </p>
                              </div>
                            ))}
                    </div>
                  </div>
                </div>
              </main>

              {/* Right Resize Handle — desktop only */}
              {showSidebars && layout.tier === "desktop" && layout.rightOpen ? (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={layout.startRightResize}
                  className="hidden lg:block appshell-resize-handle"
                />
              ) : null}

              {/* Right Sidebar — docked (desktop). The `lg:flex` gate keeps the
                pre-hydration paint correct below lg; the tier check swaps in
                the drawer once hydrated. */}
              {showSidebars && layout.tier === "desktop" && layout.rightOpen ? (
                <aside
                  className="hidden lg:flex appshell-sidebar border-l"
                  style={{ width: layout.rightWidth }}
                >
                  <div className="appshell-sidebar-header">
                    <span className="font-mono text-gw-nano uppercase tracking-label-wide font-semibold text-gw-secondary">
                      Metadata
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => layout.setRightOpen(false)}
                      title="Close right sidebar"
                      aria-label="Close metadata sidebar"
                    >
                      <PanelRightClose size={16} aria-hidden="true" />
                    </Button>
                  </div>
                  {rightSidebarBody}
                </aside>
              ) : null}

              {/* Right Sidebar Collapsed Toggle — docked (desktop) */}
              {showSidebars &&
              layout.tier === "desktop" &&
              !layout.rightOpen ? (
                <div className="hidden lg:flex flex-col items-center justify-start h-full p-2 bg-gw-chrome border-l border-hairline border-gw-border">
                  <Button
                    variant="icon"
                    className="w-10 h-10"
                    onClick={() => layout.setRightOpen(true)}
                    title="Open right sidebar"
                    aria-label="Open metadata sidebar"
                  >
                    <PanelRightOpen size={16} aria-hidden="true" />
                  </Button>
                </div>
              ) : null}

              {/* Right Sidebar — phone/tablet overlay drawer */}
              {showSidebars && layout.tier !== "desktop" ? (
                <ShellDrawer
                  side="right"
                  open={layout.rightOpen}
                  onClose={() => layout.setRightOpen(false)}
                  title="Metadata"
                >
                  {rightSidebarBody}
                </ShellDrawer>
              ) : null}
            </div>
          )}
        </ShellLayoutController>
      </ShellLayoutProvider>
    </div>
  );
}
