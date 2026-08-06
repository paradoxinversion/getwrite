// Last Updated: 2026-03-11

/**
 * @module Page
 *
 * Root Next.js App Router page. Owns the top-level application state:
 * the list of known projects, the currently open project, and the selected
 * resource ID.
 *
 * Responsibilities:
 * - Fetches all existing projects from `GET /api/projects` on mount.
 * - Delegates project creation to {@link StartPage} / `handleCreate`.
 * - Opens a project from disk via `POST /api/project` in `handleOpen`.
 * - Mirrors relevant state into the Redux store so downstream components
 *   (ResourceTree, AppShell, Sidebar) can react without prop-drilling.
 * - Bridges resource-level CRUD actions (create / copy / delete / export)
 *   between the UI and the REST API and Redux store.
 *
 * Renders {@link StartPage} when no project is selected, and
 * {@link AppShell} with the open project's data otherwise.
 */
"use client";
import { useCallback, useEffect, useState } from "react";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import {
  setProject,
  setSelectedProjectId,
  addResource,
  removeResource,
  setProjects as setProjectsInStore,
  buildStoredProject,
  selectActiveProjectDirectoryId,
} from "../../src/store/projectsSlice";
import AppShell from "../../components/Layout/AppShell";
import StartPage, {
  type StartPageProjectEntry,
  type StartPageCreateResult,
} from "../../components/Start/StartPage";
import type { Folder, AnyResource, TextResource } from "../../src/lib/models";
import type { MetadataValue, ResourceRef } from "../../src/lib/models/types";
import { buildProjectView } from "../../src/lib/models/project-view";
import { listProjects, openProject } from "../../src/lib/api/projects";
import {
  checkWorkspaceLock,
  resumeConversions,
  unlockWorkspace,
} from "../../src/store/cryptoSlice";
import {
  createResource,
  copyResource,
  deleteResource,
  updateSidecar,
  uploadMediaResource,
} from "../../src/lib/api/resources";
import {
  setResources,
  setSelectedResourceId as setResourceId,
  updateResource as updateResourceInStore,
  addResource as addResourceInStore,
  removeResource as removeResourceFromStore,
  setFolders,
  selectResource,
} from "../../src/store/resourcesSlice";
import { shallowEqual } from "react-redux";
import { toastService } from "../../src/lib/toast-service";
import { setEditorConfig } from "../../src/store/editorConfigSlice";
import { exportMarkdown, exportText } from "../../src/lib/api/export";

/**
 * Flat representation of a project that has been opened in the current session.
 *
 * Distinct from {@link StartPageProjectEntry} — this is populated directly
 * from the `POST /api/project` response and contains only the fields needed
 * for in-session resource mutations (sidecar updates, CRUD actions, etc.).
 */
interface SelectedProjectState {
  /** Stable unique identifier for the project. */
  id: string;
  /** Human-readable project name shown in the editor header. */
  name: string;
  /** Absolute path to the project root directory on disk. */
  rootPath: string;
  /** All folder entries belonging to the project. */
  folders: Folder[];
  /** All resource files (text documents, etc.) belonging to the project. */
  resources: AnyResource[];
  /** Optional project-level metadata from `project.json`. */
  metadata?: Record<string, MetadataValue>;
  /** Subset of project config needed by the editor shell (e.g. word count goal). */
  config?: { wordCountGoal?: number };
}

/**
 * Root application page.
 *
 * Manages the top-level project and resource state, coordinates API calls for
 * project/resource lifecycle, and mirrors changes into the Redux store.
 * Renders {@link StartPage} when no project is open, and {@link AppShell}
 * once the user has opened a project.
 *
 * @returns The root application page element.
 */
export default function Home(): JSX.Element {
  /** Triggers a browser file-save for the given blob at the given filename. */
  const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** All projects known to the app, fetched from `GET /api/projects` on mount. */
  const [projects, setProjects] = useState<StartPageProjectEntry[]>([]);

  /**
   * The project currently open in the editor, or `null` when the user is
   * on the project-selection / start screen.
   */
  const [selectedProject, setSelectedProject] =
    useState<SelectedProjectState | null>(null);

  const selectedResource = useAppSelector(
    (state) => selectResource(state.resources),
    shallowEqual,
  );

  /**
   * The active project's on-disk directory basename — the `projectId` every
   * tenant-scoped resource route (ADR-017/018) expects. Not the same as
   * `selectedProject.id` (`project.json`'s internal `id`), which is a
   * separately generated UUID; see `selectActiveProjectDirectoryId`'s doc
   * comment in `projectsSlice.ts` for the FR12 distinction.
   */
  const activeProjectDirectoryId = useAppSelector(
    selectActiveProjectDirectoryId,
  );

  const dispatch = useAppDispatch();

  // ── Encryption lock state ───────────────────────────────────────────────
  // The keyring lives server-side on web and desktop, so this mirrors what
  // `/api/encryption` reports. No key material is ever held here.
  const lockStatus = useAppSelector((state) => state.crypto.status);
  const encryptedProjectCount = useAppSelector(
    (state) => state.crypto.encryptedProjectIds.length,
  );
  const isUnlocking = useAppSelector((state) => state.crypto.isUnlocking);
  const unlockErrorMessage = useAppSelector(
    (state) => state.crypto.errorMessage,
  );

  /**
   * Asks the server to open the workspace.
   *
   * Failures are surfaced through the slice's `errorMessage`, so the prompt
   * stays open with the reason rather than closing on a wrong passphrase.
   *
   * @param passphrase - The passphrase the user entered.
   */

  /**
   * Loads all projects from the API and maps them into
   * {@link StartPageProjectEntry}-compatible view objects.
   */
  const refreshProjects = useCallback(async (): Promise<void> => {
    try {
      const entries = await listProjects();
      // buildProjectView expects TextResource[] and returns UIResource[]; the original
      // code cast through `any` (p: any) to bypass both constraints. We preserve that
      // runtime behaviour with a targeted cast rather than a blanket any.
      const data = entries.map((p) => ({
        ...buildProjectView({
          project: p.project,
          folders: p.folders,
          resources: p.resources as unknown as TextResource[],
        }),
        // Carried through deliberately: `buildProjectView` returns only
        // project/folders/resources, so without this the Start screen cannot
        // tell an encrypted project from an ordinary one and renders a locked
        // entry as "Untitled Project · 0 resources · 0 folders".
        isEncrypted: (p as { isEncrypted?: boolean }).isEncrypted,
        isLocked: (p as { isLocked?: boolean }).isLocked,
      })) as unknown as StartPageProjectEntry[];
      if (Array.isArray(data)) {
        dispatch(setProjectsInStore(data));
        setProjects(data);
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
    }
  }, [dispatch]);

  const handleUnlock = useCallback(
    (passphrase: string) => {
      void dispatch(unlockWorkspace(passphrase))
        .unwrap()
        // Finish anything a crash left half-done, now that keys are available.
        .then(() => dispatch(resumeConversions()))
        // Re-list: the entries currently on screen were fetched while locked,
        // so they carry no name by design (FR18). Without this the project
        // stays "Untitled Project" until something else refreshes the list.
        .then(() => refreshProjects())
        .catch(() => undefined);
    },
    [dispatch, refreshProjects],
  );

  // Fetch existing projects on mount
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  // Establish whether this workspace is encrypted at all. Until this resolves
  // the gate stays closed, so a user with no encryption is never prompted (FR4).
  useEffect(() => {
    void dispatch(checkWorkspaceLock());
  }, [dispatch]);

  /**
   * Called by {@link StartPage} after a new project has been successfully
   * created on disk.
   *
   * Adds the new project to the local project list, upserts it in the Redux
   * `projects` slice, sets it as the selected project, and hydrates the
   * `resources` slice with the scaffold's initial folders and resources.
   *
   * @param projectFiles - Creation result containing the project record,
   *   initial folder list, and any scaffolded resources.
   */
  const handleCreate = (projectFiles: StartPageCreateResult) => {
    setProjects((prev) => [
      {
        project: projectFiles.project,
        folders: projectFiles.folders,
        resources: projectFiles.resources,
      },
      ...prev,
    ]);
    // persist project in redux store and mark selected
    dispatch(
      setProject(
        buildStoredProject(
          projectFiles.project,
          (projectFiles as any).folders ?? [],
          (projectFiles as any).resources ?? [],
        ),
      ),
    );
    dispatch(setSelectedProjectId(projectFiles.project.id));
    dispatch(setResources(projectFiles.resources));
    dispatch(setFolders(projectFiles.folders));
    setSelectedProject({
      id: projectFiles.project.id,
      name: projectFiles.project.name,
      rootPath: projectFiles.project.rootPath ?? "",
      folders: (projectFiles as any).folders ?? [],
      resources: (projectFiles as any).resources ?? [],
      metadata: projectFiles.project.metadata,
      config: { wordCountGoal: projectFiles.project.config?.wordCountGoal },
    });
    toastService.success("Project created", projectFiles.project.name);
  };

  /**
   * Opens an existing project by its on-disk directory id.
   *
   * Calls `POST /api/project` with the project's directory id, hydrates the
   * Redux `projects` and `resources` slices with the response, and stores
   * the opened project in local `selectedProject` state so the editor shell
   * becomes visible.
   *
   * @param id - The project's on-disk directory basename (see
   *   `selectActiveProjectDirectoryId`'s doc comment in `projectsSlice.ts`),
   *   sent as the `projectId` request body field.
   * @throws {Error} When the HTTP response is not OK.
   */
  const handleOpen = async (id: string) => {
    const p = await openProject(id);
    dispatch(setProject(buildStoredProject(p.project, p.folders, p.resources)));
    dispatch(
      setEditorConfig({
        headings: p.project.config?.editorConfig?.headings ?? {},
        body: p.project.config?.editorConfig?.body,
      }),
    );
    dispatch(setSelectedProjectId(p.project.id));
    dispatch(setResources(p.resources));
    dispatch(setFolders(p.folders));
    setSelectedProject({
      id: p.project.id,
      name: p.project.name,
      rootPath: p.project.rootPath ?? "",
      folders: p.folders,
      resources: p.resources,
      metadata: p.project.metadata,
      config: { wordCountGoal: p.project.config?.wordCountGoal },
    });
  };

  /**
   * Marks a resource as selected in both the Redux store and local state.
   *
   * Dispatches `setResourceId` so that the sidebar, editor, and other
   * resource-aware components can display the chosen resource.
   *
   * @param id - The ID of the resource to select.
   */
  const handleResourceSelect = (id: string) => {
    dispatch(setResourceId(id));
  };

  /**
   * Applies an immutable update to a single resource within the selected
   * project.
   *
   * The updated resource is:
   * 1. Persisted to the sidecar file via `POST /api/resource/:id/sidecar`.
   * 2. Dispatched to the Redux store via `updateResourceInStore`.
   * 3. Applied to both the `projects` list and `selectedProject` local state
   *    so the UI reflects the change immediately while the network call is
   *    in flight.
   *
   * @param resourceId - ID of the resource to update.
   * @param updater    - Pure function that receives the current resource and
   *   returns the updated version.
   */
  const updateResource = (
    resourceId: string,
    updater: (r: AnyResource) => AnyResource,
  ): void => {
    if (!selectedProject) return;
    const resource = selectedProject.resources.find((r) => r.id === resourceId);
    if (!resource) {
      console.warn(
        `updateResource: resource ${resourceId} not found in selectedProject`,
      );
      return;
    }

    if (activeProjectDirectoryId) {
      updateSidecar(
        resourceId,
        activeProjectDirectoryId,
        updater(resource),
      ).catch((err) => {
        console.error("Error updating resource metadata:", err);
      });
    } else {
      console.error(
        "updateResource: no active project directory id; sidecar not persisted",
      );
    }

    dispatch(updateResourceInStore(updater(resource)));

    setProjects((prev) =>
      prev.map((p) => {
        if (p.project.id !== selectedProject.id) return p;

        const resources = p.resources.map((r) =>
          r.id === resourceId ? updater(r) : r,
        );
        return { ...p, resources };
      }),
    );

    // Also update the local selectedProject reference so UI reflects changes immediately
    setSelectedProject((prev) => {
      if (!prev || prev.id !== selectedProject.id) return prev;
      const resources = prev.resources.map((r) =>
        r.id === resourceId ? updater(r) : r,
      );
      return { ...prev, resources, updatedAt: new Date().toISOString() };
    });
  };

  /**
   * Updates the free-text notes field in a resource's metadata.
   *
   * @param text       - New notes content.
   * @param resourceId - ID of the target resource.
   */
  const handleChangeSynopsis = (text: string, resourceId: string) => {
    updateResource(resourceId, (r) => ({
      ...r,
      userMetadata: { ...r.userMetadata, synopsis: text },
    }));
  };

  const handleChangeNotes = (text: string, resourceId: string) => {
    updateResource(resourceId, (r) => ({
      ...r,
      userMetadata: { ...r.userMetadata, notes: text },
    }));
  };

  /**
   * Updates the publication status in a resource's metadata.
   *
   * @param status     - The new status value (`"draft"`, `"in-review"`, or
   *   `"published"`).
   * @param resourceId - ID of the target resource.
   */
  const handleChangeStatus = (
    status: "draft" | "in-review" | "published",
    resourceId: string,
  ) => {
    updateResource(resourceId, (r) => ({
      ...r,
      userMetadata: { ...r.userMetadata, status },
    }));
  };

  const handleChangeDynamicMetadata = (
    metadata: Record<string, string[]>,
    resourceId: string,
  ) => {
    updateResource(resourceId, (r) => ({
      ...r,
      userMetadata: { ...r.userMetadata, ...metadata },
    }));
  };

  /**
   * Updates the point-of-view (POV) character field in a resource's metadata.
   *
   * @param pov        - Name of the POV character, or `null` to clear it.
   * @param resourceId - ID of the target resource.
   */
  const handleChangePOV = (pov: ResourceRef, resourceId: string) => {
    updateResource(resourceId, (r) => ({
      ...r,
      userMetadata: { ...r.userMetadata, pov },
    }));
  };

  const handleChangeStoryDate = (date: string, resourceId: string) => {
    updateResource(resourceId, (r) => ({
      ...r,
      userMetadata: { ...r.userMetadata, storyDate: date },
    }));
  };

  const handleChangeStoryDuration = (
    duration: number | null,
    resourceId: string,
  ) => {
    updateResource(resourceId, (r) => ({
      ...r,
      userMetadata: { ...r.userMetadata, storyDuration: duration },
    }));
  };

  const handleChangeStoryEndDate = (
    endDate: string | null,
    resourceId: string,
  ) => {
    updateResource(resourceId, (r) => ({
      ...r,
      userMetadata: { ...r.userMetadata, storyEndDate: endDate },
    }));
  };

  /**
   * Dispatches a CRUD or utility action on a resource.
   *
   * Supported actions:
   * - `"create"` — POSTs a new resource to `POST /api/resource`, adds it to
   *   the Redux store, and marks it as selected.
   * - `"copy"` / `"duplicate"` — Clones the resource on disk via
   *   `POST /api/resource/:id` and appends the copy to local state.
   * - `"delete"` — Removes the resource from disk and from local + Redux state.
   * - `"export"` — Shows a placeholder export alert (not yet implemented).
   *
   * @param action     - The action to perform.
   * @param resourceId - ID of the target resource (required for all actions
   *   except `"create"`).
   * @param opts       - Additional options for the `"create"` action:
   *   - `type`     — Resource type (e.g. `"text"`, `"folder"`).
   *   - `title`    — Initial display name for the new resource.
   *   - `folderId` — ID of the parent folder, if any.
   */
  const handleResourceAction = async (
    action:
      | "create"
      | "rename"
      | "copy"
      | "duplicate"
      | "delete"
      | "export"
      | "smart-folder",
    resourceId?: string,
    opts?: {
      /** Resource type to create (e.g. `"text"` or `"folder"`). */
      type?: string;
      /** Initial display name for the new resource. */
      title?: string;
      /** Parent folder ID for the new resource. */
      folderId?: string;
      /** Resolved leaf resource IDs to export (used by the export action). */
      resourceIds?: string[];
      /** Output format for the export action; defaults to plain text. */
      format?: "txt" | "md";
    },
  ) => {
    if (!selectedProject) return;
    // `activeProjectDirectoryId` is the on-disk directory basename required
    // by every tenant-scoped resource route (ADR-017/018) — see its doc
    // comment above for the FR12 distinction from `selectedProject.id`.
    if (!activeProjectDirectoryId) return;
    const projectId = activeProjectDirectoryId;

    if (action === "create") {
      const title = opts?.title ?? "New Resource";
      const targetFolderId = opts?.folderId ?? null;
      const allItems = [
        ...selectedProject.resources,
        ...selectedProject.folders,
      ] as AnyResource[];
      const siblings = allItems.filter((r) => {
        const effectiveParentId =
          r.type === "folder"
            ? ((r as Folder).parentId ?? r.folderId ?? null)
            : (r.folderId ?? null);
        return effectiveParentId === targetFolderId;
      });
      const maxSiblingOrder = siblings.reduce(
        (max, s) => Math.max(max, s.orderIndex ?? 0),
        -1,
      );
      const payload = {
        name: title,
        folderId: targetFolderId,
        type: opts?.type ?? "text",
        orderIndex: maxSiblingOrder + 1,
      };

      if (opts?.type === "text" || !opts?.type) {
        // `text` is not declared on the minimal payload type; cast to
        // pass the extended shape through to the API.
        (payload as any).text = { plainText: "", tiptap: undefined };
      }

      const resBody = await createResource(projectId, payload);
      const res: AnyResource = resBody.resource;
      dispatch(addResourceInStore(res));
      if (opts?.type === "folder") {
        setSelectedProject((prev) =>
          prev ? { ...prev, folders: [...prev.folders, res as Folder] } : prev,
        );
      } else {
        // update redux store
        dispatch(
          // This addResource is deprecated
          addResource({
            projectId: selectedProject.id,
            resource: {
              id: res.id,
              userMetadata: res.userMetadata,
              name: res.name,
              folderId: res.folderId ?? null,
            } as any,
          }),
        );
        setSelectedProject((prev) =>
          prev
            ? { ...prev, resources: [...prev.resources, res] as AnyResource[] }
            : prev,
        );
        dispatch(setResourceId(res.id));
      }

      toastService.success(
        "Resource created",
        `${opts?.title ?? "New Resource"} created`,
      );
      return;
    }

    if (action === "copy" || action === "duplicate") {
      if (!resourceId) return;
      const src = selectedProject.resources.find((r) => r.id === resourceId);
      if (!src) return;
      const newName = opts?.title ?? `${src.name} (Copy)`;

      const { resource: newResource } = await copyResource(
        resourceId,
        newName,
        projectId,
      );

      dispatch(addResourceInStore(newResource as AnyResource));
      setProjects((prev) =>
        prev.map((p) =>
          p.project.id === selectedProject.id
            ? {
                ...p,
                resources: [...p.resources, newResource] as AnyResource[],
              }
            : p,
        ),
      );
      setSelectedProject((prev) =>
        prev
          ? {
              ...prev,
              resources: [...prev.resources, newResource] as AnyResource[],
            }
          : prev,
      );
      toastService.success("Resource copied", newResource.name as string);
      return;
    }

    if (action === "delete") {
      if (!resourceId) return;
      await deleteResource(resourceId, projectId);
      setProjects((prev) =>
        prev.map((p) =>
          p.project.id === selectedProject.id
            ? {
                ...p,
                resources: p.resources.filter((r) => r.id !== resourceId),
              }
            : p,
        ),
      );
      setSelectedProject((prev) =>
        prev
          ? {
              ...prev,
              resources: prev.resources.filter((r) => r.id !== resourceId),
              updatedAt: new Date().toISOString(),
            }
          : prev,
      );
      // update redux store
      dispatch(removeResource({ projectId: selectedProject.id, resourceId }));
      dispatch(removeResourceFromStore(resourceId));
      const resourceName =
        selectedProject.resources.find((r) => r.id === resourceId)?.name ??
        "Resource";
      toastService.success("Resource deleted", resourceName);
      return;
    }

    if (action === "export") {
      const resolvedIds: string[] =
        opts?.resourceIds ?? (resourceId ? [resourceId] : []);
      if (resolvedIds.length === 0) return;

      const exportNode =
        selectedProject.resources.find((x) => x.id === resourceId) ??
        selectedProject.folders.find((x) => x.id === resourceId);
      const exportName = exportNode?.name ?? "export";

      const resourcesMeta = resolvedIds.map((id) => {
        const r = selectedProject.resources.find((x) => x.id === id);
        return {
          id,
          name: r?.name ?? id,
          type: (r as { type?: string } | undefined)?.type ?? "text",
        };
      });

      // Markdown export needs each resource's TipTap document (not the cached
      // plaintext), so it goes through the server route which loads the doc and
      // serializes it, returning the file plus any loss warnings.
      if (opts?.format === "md") {
        const { markdown, filename, warnings } = await exportMarkdown({
          projectId,
          resourceIds: resolvedIds,
          resources: resourcesMeta,
          exportName,
        });

        downloadBlob(
          new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
          filename,
        );
        toastService.success("Exported", filename);
        if (warnings.length > 0) {
          toastService.info(
            `Some formatting couldn't be represented in Markdown: ${warnings
              .map((w) => w.label)
              .join(", ")}`,
          );
        }
        return;
      }

      // Plain-text export goes through the server route so it reads each
      // resource's current saved content from disk, matching the Markdown path.
      // Using the client-side `plaintext` snapshot here would miss text typed
      // after the project was opened (it is only refreshed on project reload).
      const { text, filename } = await exportText({
        projectId,
        resourceIds: resolvedIds,
        resources: resourcesMeta,
        exportName,
      });

      downloadBlob(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
        filename,
      );
      toastService.success("Exported", filename);
      return;
    }
  };

  const handleMediaCreate = async (
    file: File,
    opts: { title: string; folderId?: string },
  ): Promise<void> => {
    if (!selectedProject || !activeProjectDirectoryId) return;
    const { resource } = await uploadMediaResource(
      activeProjectDirectoryId,
      file,
      opts,
    );
    dispatch(addResourceInStore(resource));
    dispatch(
      addResource({
        projectId: selectedProject.id,
        resource: {
          id: resource.id,
          userMetadata: resource.userMetadata,
          name: resource.name,
          folderId: resource.folderId ?? null,
        } as any,
      }),
    );
    setSelectedProject((prev) =>
      prev
        ? { ...prev, resources: [...prev.resources, resource] as AnyResource[] }
        : prev,
    );
    dispatch(setResourceId(resource.id));
    toastService.success("Resource created", resource.name);
  };

  const handleCloseProject = (): void => {
    setSelectedProject(null);
    dispatch(setSelectedProjectId(null));
    dispatch(setResourceId(null));
    dispatch(setResources([]));
    dispatch(setFolders([]));
    void refreshProjects();
  };

  return (
    <AppShell
      showSidebars={Boolean(selectedProject)}
      resources={selectedProject?.resources}
      folders={selectedProject?.folders}
      project={selectedProject as any}
      onResourceSelect={handleResourceSelect}
      onResourceAction={handleResourceAction}
      onCloseProject={handleCloseProject}
      onMediaCreateConfirmed={handleMediaCreate}
      selectedResourceId={selectedResource?.id ?? null}
      onChangeSynopsis={handleChangeSynopsis}
      onChangeNotes={handleChangeNotes}
      onChangeStatus={handleChangeStatus}
      onChangeDynamicMetadata={handleChangeDynamicMetadata}
      onChangePOV={handleChangePOV}
      onChangeStoryDate={handleChangeStoryDate}
      onChangeStoryDuration={handleChangeStoryDuration}
      onChangeStoryEndDate={handleChangeStoryEndDate}
    >
      {!selectedProject ? (
        <StartPage
          projects={projects}
          onCreate={handleCreate}
          onOpen={handleOpen}
          lockStatus={
            lockStatus === "locked" || lockStatus === "unlocked"
              ? lockStatus
              : "absent"
          }
          encryptedProjectCount={encryptedProjectCount}
          isUnlocking={isUnlocking}
          unlockErrorMessage={unlockErrorMessage}
          onUnlock={handleUnlock}
        />
      ) : (
        <section className="p-6">
          <h1 className="text-2xl font-semibold">{selectedProject.name}</h1>
          <p className="mt-4 text-gw-secondary">
            Open a resource from the left-hand contents list, or create a new
            resource to get started.
          </p>
        </section>
      )}
    </AppShell>
  );
}
