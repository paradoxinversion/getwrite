/**
 * @module Start/StartPage
 *
 * Landing page section that lists projects and provides quick actions:
 * - Create project via modal
 * - Open project
 * - Manage project (rename/delete/package placeholder)
 *
 * The component supports both externally supplied project lists (via props)
 * and local optimistic updates for create/rename/delete interactions.
 */
import { useEffect, useMemo, useState } from "react";
import { FolderPlus, Plus, FolderOpen } from "lucide-react";
import Card from "../common/UI/Card/Card";
import type {
  Project as CanonicalProject,
  AnyResource,
  Folder,
} from "../../src/lib/models/types";
import CreateProjectModal, {
  type CreateProjectPayload,
} from "./CreateProjectModal";
import ManageProjectMenu from "./ManageProjectMenu";
import CompilePreviewModal from "../common/CompilePreviewModal";
import { toastService } from "../../src/lib/toast-service";
import {
  compilePdf,
  compileDocx,
  compileText,
  compileMarkdown,
} from "../../src/lib/api/compile";
import { getProjectDirectoryId } from "../../src/store/projectsSlice";
import { formatRelativeTimestamp } from "../../src/lib/timestamp-utils";
import Button from "../common/UI/Button";
import UnlockModal from "../common/UnlockModal";

/**
 * Project card data shape displayed on the start page.
 */
export interface StartPageProjectEntry {
  /** Canonical project record (id, name, root path, config, etc.). */
  project: CanonicalProject;
  /** All resources known for the project. */
  resources: AnyResource[];
  /** Folder tree entries for the project. */
  folders: Folder[];
  /**
   * True for an encrypted project, locked or not.
   *
   * Its `resources` and `folders` are empty because they were never read, not
   * because they are empty — so the card shows no counts.
   */
  isEncrypted?: boolean;
  /**
   * True when the project is encrypted and the workspace is locked.
   *
   * Such an entry carries no name, resources, or folders — nothing inside it
   * could be read — so its card shows that the project exists and is closed,
   * and offers no actions that would need its contents (FR20).
   */
  isLocked?: boolean;
}

/**
 * Payload emitted when a project is created via the modal.
 */
export interface StartPageCreateResult {
  /** Newly created canonical project record. */
  project: CanonicalProject;
  /** Created folder entries for the project scaffold. */
  folders: Folder[];
  /** Created/scaffolded resources for the project scaffold. */
  resources: AnyResource[];
}

/** Non-folder resources summarized on start-page cards and package actions. */
type StartPageRenderableResource = Exclude<AnyResource, Folder>;

/**
 * Returns the freshest available timestamp for a project card.
 *
 * Considers the project record, all folders, and all resources so the card
 * reflects the most recent activity anywhere in that project.
 *
 * @param projectEntry - Project card data.
 * @returns Latest timestamp string when available.
 */
function getProjectLastEditedTimestamp(
  projectEntry: StartPageProjectEntry,
): string | undefined {
  const candidateTimestamps = [
    projectEntry.project.updatedAt,
    projectEntry.project.createdAt,
    ...projectEntry.resources.flatMap((resource) => [
      resource.updatedAt,
      resource.createdAt,
    ]),
    ...projectEntry.folders.flatMap((folder) => [
      folder.updatedAt,
      folder.createdAt,
    ]),
  ].filter((timestamp): timestamp is string => Boolean(timestamp));

  let latestTimestamp: string | undefined;
  let latestValue = 0;

  for (const timestamp of candidateTimestamps) {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
      continue;
    }

    if (!latestTimestamp || parsed > latestValue) {
      latestTimestamp = timestamp;
      latestValue = parsed;
    }
  }

  return latestTimestamp;
}

/**
 * Narrows a canonical resource to a renderable, non-folder resource.
 *
 * @param resource - Candidate project resource.
 * @returns `true` when the resource should appear in start-page summaries.
 */
function isRenderableResource(
  resource: AnyResource,
): resource is StartPageRenderableResource {
  return resource.type !== "folder";
}

/** Triggers a file download from a Blob by briefly appending an anchor to the DOM. */
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

/**
 * Props for {@link StartPage}.
 */
export interface StartPageProps {
  /** Optional externally controlled list of projects to render. */
  projects?: StartPageProjectEntry[];
  /** Callback fired after project creation succeeds. */
  onCreate?: (projectFiles: StartPageCreateResult) => void;
  /**
   * Callback fired when user chooses to open a project.
   *
   * `projectId` is the project's on-disk directory basename (see
   * `selectActiveProjectDirectoryId`'s doc comment in `projectsSlice.ts`),
   * not `project.id` — `/api/project` resolves it via
   * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
   */
  onOpen?: (projectId: string) => void;
  /**
   * Whether the workspace holds encrypted projects, and whether it is open.
   *
   * `"locked"` is the only value that produces a prompt: a workspace that never
   * had encryption set up must never be asked for a passphrase (FR4).
   */
  lockStatus?: "absent" | "locked" | "unlocked";
  /** How many projects the workspace passphrase would open. */
  encryptedProjectCount?: number;
  /** Whether an unlock attempt is in flight. */
  isUnlocking?: boolean;
  /** Failure text from a previous unlock attempt. */
  unlockErrorMessage?: string;
  /** Called with the entered passphrase. Absent means no gate is shown. */
  onUnlock?: (passphrase: string) => void;
}

/**
 * Renders the project start page list with create/open/manage actions.
 *
 * State behavior:
 * - Initializes local list from incoming `projects` prop.
 * - Re-syncs local list whenever `projects` prop changes.
 * - Applies local optimistic updates for create/rename/delete interactions.
 *
 * @param props - {@link StartPageProps}.
 * @returns Start page section containing project cards and action controls.
 *
 * @example
 * <StartPage
 *   projects={projects}
 *   onCreate={(created) => console.log(created.project.id)}
 *   onOpen={(projectId) => openProject(projectId)}
 * />
 */
export default function StartPage({
  projects = [],
  onCreate,
  onOpen,
  lockStatus = "absent",
  encryptedProjectCount = 0,
  isUnlocking = false,
  unlockErrorMessage,
  onUnlock,
}: StartPageProps): JSX.Element {
  /**
   * Whether the user chose to carry on without unlocking this session.
   *
   * Declining must not be sticky across a real unlock, but it must survive
   * re-renders, or the prompt would reappear the moment anything changed.
   */
  const [hasDeclinedUnlock, setHasDeclinedUnlock] = useState<boolean>(false);
  /** Locally synchronized project list used for optimistic UI updates. */
  const [localProjects, setLocalProjects] =
    useState<StartPageProjectEntry[]>(projects);
  /** Controls the create-project modal visibility. */
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  /** ID of the project currently open in the compile modal, or null when closed. */
  const [compileTargetProjectId, setCompileTargetProjectId] = useState<
    string | null
  >(null);

  /**
   * Resources reconstructed for the compile modal.
   *
   * `buildProjectViewAdapter` converts API resources to `UIResource[]` (title not
   * name, no folderId). We rebuild a proper `AnyResource[]` from the folder entries
   * which retain the original data and group resources by folder.
   */
  const compileResources = useMemo((): AnyResource[] => {
    const entry = localProjects.find(
      (p) => p.project.id === compileTargetProjectId,
    );
    if (!entry) return [];
    const result: AnyResource[] = [];
    for (const folder of entry.folders as any[]) {
      result.push({
        id: folder.id,
        name: folder.name ?? "",
        slug: folder.slug ?? folder.id,
        type: "folder" as const,
        // buildResourceTree uses folderId for parent lookup; folders store parent in parentId
        folderId: folder.parentId ?? null,
        parentId: folder.parentId ?? null,
        orderIndex: folder.orderIndex ?? 0,
        createdAt: folder.createdAt ?? "",
        updatedAt: folder.updatedAt ?? "",
        userMetadata: folder.userMetadata ?? {},
      } as AnyResource);
      for (const r of (folder.resources as any[]) ?? []) {
        result.push({
          id: r.id,
          // UIResource has title instead of name
          name: r.title ?? r.name ?? "",
          slug: r.slug ?? r.id,
          type: r.type ?? "text",
          folderId: folder.id,
          orderIndex: r._orderIndex ?? r.orderIndex ?? 0,
          createdAt: r.createdAt ?? "",
          updatedAt: r.updatedAt ?? "",
          userMetadata: r.userMetadata ?? {},
          plainText: r.content ?? "",
        } as AnyResource);
      }
    }
    return result;
  }, [localProjects, compileTargetProjectId]);
  /** Tick used to keep relative timestamps fresh while the page is open. */
  const [timestampTick, setTimestampTick] = useState<number>(Date.now());

  /** Projects sorted by most recent activity (newest first). */
  const sortedProjects = useMemo<StartPageProjectEntry[]>(() => {
    return [...localProjects].sort((left, right) => {
      const leftTimestamp = Date.parse(
        getProjectLastEditedTimestamp(left) ?? "",
      );
      const rightTimestamp = Date.parse(
        getProjectLastEditedTimestamp(right) ?? "",
      );
      const leftSafe = Number.isNaN(leftTimestamp) ? 0 : leftTimestamp;
      const rightSafe = Number.isNaN(rightTimestamp) ? 0 : rightTimestamp;
      return rightSafe - leftSafe;
    });
  }, [localProjects]);

  /** Total non-folder resources across all visible projects. */
  const totalRenderableResources = useMemo<number>(() => {
    return localProjects.reduce((total, projectEntry) => {
      return total + projectEntry.resources.filter(isRenderableResource).length;
    }, 0);
  }, [localProjects]);

  /** Total folder count across all visible projects. */
  const totalFolders = useMemo<number>(() => {
    return localProjects.reduce((total, projectEntry) => {
      return total + projectEntry.folders.length;
    }, 0);
  }, [localProjects]);

  /** Lead project name referenced in the hero copy. */
  const featuredProjectName = useMemo<string>(() => {
    return localProjects[0]?.project.name ?? "your next manuscript";
  }, [localProjects]);

  /**
   * Handles successful project creation from modal and updates local list.
   *
   * @param payload - Raw create form payload from modal (not used directly).
   * @param projectFiles - Created project data and scaffolded entities.
   */
  const handleModalCreate = (
    payload: CreateProjectPayload,
    projectFiles?: StartPageCreateResult,
  ): void => {
    void payload;

    if (!projectFiles) {
      setIsModalOpen(false);
      return;
    }
    setLocalProjects((prev) => [projectFiles, ...prev]);
    if (onCreate) {
      onCreate(projectFiles);
    }
    setIsModalOpen(false);
  };

  /** Synchronizes local project list when external `projects` prop changes. */
  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimestampTick(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section
      aria-labelledby="start-projects"
      className="min-h-full text-gw-primary bg-gw-chrome px-6 py-8"
    >
      <UnlockModal
        isOpen={
          Boolean(onUnlock) && lockStatus === "locked" && !hasDeclinedUnlock
        }
        encryptedProjectCount={encryptedProjectCount}
        isBusy={isUnlocking}
        errorMessage={unlockErrorMessage}
        onUnlock={(passphrase) => onUnlock?.(passphrase)}
        onDecline={() => setHasDeclinedUnlock(true)}
      />

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleModalCreate}
      />

      <CompilePreviewModal
        isOpen={compileTargetProjectId !== null}
        projectId={compileTargetProjectId ?? undefined}
        resources={compileResources}
        onClose={() => setCompileTargetProjectId(null)}
        onConfirmCompile={(selectedIds, options) => {
          const entry = localProjects.find(
            (p) => p.project.id === compileTargetProjectId,
          );
          if (!entry?.project.rootPath) {
            toastService.error("Cannot compile", "Project path not found");
            setCompileTargetProjectId(null);
            return;
          }

          const compileBody = {
            // Directory basename, not `entry.project.id` (project.json's
            // independently generated internal id) — see
            // `selectActiveProjectDirectoryId`'s doc comment in
            // `projectsSlice.ts`.
            projectId: getProjectDirectoryId(entry.project.rootPath),
            resourceIds: selectedIds,
            resources: compileResources.map((r) => ({
              id: r.id,
              name: r.name,
              type: r.type,
            })),
            includeHeaders: options.includeHeaders,
            projectName: entry.project.name ?? "project",
          };
          const rawName = options.compilationName.trim();

          /** Appends the expected extension to `rawName` when it is missing. */
          const resolveFilename = (ext: string, serverFilename: string) =>
            rawName
              ? rawName.endsWith(`.${ext}`)
                ? rawName
                : `${rawName}.${ext}`
              : serverFilename;

          setCompileTargetProjectId(null);

          if (options.format === "pdf") {
            void compilePdf(compileBody)
              .then((result) => {
                if (result.warning === "font-fallback") {
                  toastService.info(
                    "PDF compiled with fallback fonts — IBM Plex fonts were unreachable",
                  );
                }
                triggerDownload(
                  new Blob([result.arrayBuffer], { type: "application/pdf" }),
                  resolveFilename("pdf", result.filename),
                );
              })
              .catch(() =>
                toastService.error("Compile failed", "Could not generate PDF"),
              );
            return;
          }
          if (options.format === "docx") {
            void compileDocx(compileBody)
              .then((result) => {
                triggerDownload(
                  new Blob([result.arrayBuffer], {
                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  }),
                  resolveFilename("docx", result.filename),
                );
              })
              .catch(() =>
                toastService.error("Compile failed", "Could not generate DOCX"),
              );
            return;
          }
          if (options.format === "md") {
            void compileMarkdown(compileBody)
              .then((result) => {
                triggerDownload(
                  new Blob([result.markdown], {
                    type: "text/markdown;charset=utf-8",
                  }),
                  resolveFilename("md", result.filename),
                );
                if (result.warnings.length > 0) {
                  toastService.info(
                    `Some formatting couldn't be represented in Markdown: ${result.warnings
                      .map((w) => w.label)
                      .join(", ")}`,
                  );
                }
              })
              .catch(() =>
                toastService.error(
                  "Compile failed",
                  "Could not generate Markdown",
                ),
              );
            return;
          }

          void compileText(compileBody)
            .then((result) => {
              triggerDownload(
                new Blob([result.text], { type: "text/plain;charset=utf-8" }),
                resolveFilename("txt", result.filename),
              );
            })
            .catch(() =>
              toastService.error(
                "Compile failed",
                "Could not generate output file",
              ),
            );
        }}
      />

      <div className=" mx-auto">
        <div className="bg-gw-chrome start-page-fade-in px-6 py-8 lg:px-10 lg:py-10">
          <div className="start-page-hero-grid">
            <div className="flex flex-col">
              <div className="inline-flex items-center gap-2 font-mono text-gw-micro tracking-label uppercase text-gw-secondary border border-gw-border px-2 py-1 w-fit">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gw-secondary" />
                Local-first writing studio
              </div>

              <h1 className="mt-6 start-page-wordmark">
                <span className="start-page-wordmark-accent">
                  <span className="font-display font-normal tracking-heading text-gw-secondary">
                    Get
                  </span>
                  <span className="font-display font-bold tracking-wordmark text-gw-primary">
                    Write
                  </span>
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-gw-body text-gw-secondary">
                Shape books, series, and scene libraries with a calm editorial
                workspace. Pick up where you left off in {featuredProjectName}{" "}
                or open a clean slate for your next draft.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center text-gw-micro font-mono tracking-label uppercase border-gw-border border-hairline px-2 py-0.5 text-gw-secondary">
                  {localProjects.length} active project
                  {localProjects.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center text-gw-micro font-mono tracking-label uppercase border-gw-border border-hairline px-2 py-0.5 text-gw-secondary">
                  {totalRenderableResources} writing assets
                </span>
                <span className="inline-flex items-center text-gw-micro font-mono tracking-label uppercase border-gw-border border-hairline px-2 py-0.5 text-gw-secondary">
                  {totalFolders} folders organized
                </span>
              </div>
            </div>

            <aside className="bg-gw-chrome start-page-fade-in-delayed border-gw-border border-hairline p-6 lg:p-7">
              <p className="text-gw-small uppercase tracking-label-xl text-gw-secondary">
                Writing at a glance
              </p>
              <div className="mt-5 grid gap-4">
                <div>
                  <div className="text-gw-h1 font-semibold text-gw-primary">
                    {localProjects.length}
                  </div>
                  <p className="mt-2 text-gw-body leading-6 text-gw-secondary">
                    Project
                    {localProjects.length === 1 ? "" : "s"} ready to open and
                    continue.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card variant="chrome2" padding="none" className="px-4 py-4">
                    <div className="text-gw-micro uppercase tracking-[0.2em] text-gw-secondary">
                      Resources
                    </div>
                    <div className="mt-2 text-gw-h2 font-semibold text-gw-primary">
                      {totalRenderableResources}
                    </div>
                  </Card>
                  <Card variant="chrome2" padding="none" className="px-4 py-4">
                    <div className="text-gw-micro uppercase tracking-[0.2em] text-gw-secondary">
                      Folders
                    </div>
                    <div className="mt-2 text-gw-h2 font-semibold text-gw-primary">
                      {totalFolders}
                    </div>
                  </Card>
                </div>

                <Button
                  variant="default"
                  onClick={() => setIsModalOpen(true)}
                  title="Start a New Projct"
                  aria-label="Start a new project"
                >
                  <FolderPlus size={16} aria-hidden="true" />
                  Start a New Project
                </Button>
              </div>
            </aside>
          </div>
        </div>

        <div className="mt-2 px-6 lg:px-10 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-gw-label uppercase tracking-label-xl text-gw-secondary">
              Library
            </p>
            <h2
              id="start-projects"
              className="mt-3 text-gw-h1 font-semibold text-gw-primary"
            >
              Projects
            </h2>
          </div>
          <div className="max-w-xl text-left sm:text-right text-gw-small leading-6 text-gw-secondary">
            {localProjects.length === 0
              ? "Create your first project to begin writing."
              : "Open a project or manage its packaging and metadata."}
          </div>
        </div>

        <div className="px-6 lg:px-10 mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {localProjects.length === 0 ? (
            <article className="border-hairline border-gw-border start-page-fade-in p-6 md:col-span-2 xl:col-span-3">
              <p className="text-gw-label uppercase tracking-label-xl text-gw-secondary">
                Empty shelf
              </p>
              <h3 className="mt-3 text-gw-h2 font-semibold text-gw-primary">
                No projects yet
              </h3>
              <p className="mt-3 max-w-2xl text-gw-small leading-7 text-gw-secondary">
                Create a project to scaffold your workspace, organize folders,
                and start drafting in GetWrite.
              </p>
              <Button
                variant="default"
                onClick={() => setIsModalOpen(true)}
                title="Start a New Projct"
                aria-label="Start a new project"
                className=" mt-6 inline-flex items-center"
              >
                <Plus size={15} aria-hidden="true" />
                Create the first project
              </Button>
            </article>
          ) : null}

          {sortedProjects.map((projectEntry) => {
            if (projectEntry.isLocked) {
              return (
                <article
                  key={projectEntry.project.id}
                  className="border-hairline border-gw-border start-page-fade-in flex flex-col justify-between p-5"
                  aria-labelledby={`proj-${projectEntry.project.id}-title`}
                >
                  <div>
                    <p className="font-mono text-gw-label uppercase tracking-label text-gw-secondary">
                      Project · Locked
                    </p>
                    <h3
                      id={`proj-${projectEntry.project.id}-title`}
                      className="mt-3 text-gw-h1 font-semibold text-gw-secondary"
                    >
                      Encrypted project
                    </h3>
                    <p className="mt-3 text-gw-body text-gw-secondary">
                      Unlock this workspace to see this project&rsquo;s name and
                      open it.
                    </p>
                  </div>
                </article>
              );
            }

            /** Non-folder resources shown in summaries and package flow. */
            const resourceList =
              projectEntry.resources.filter(isRenderableResource);
            /** Resolved project name for the current card. */
            const projectName = projectEntry.project.name || "Untitled Project";
            /** Most recent project-wide activity timestamp. */
            const lastEditedTimestamp =
              getProjectLastEditedTimestamp(projectEntry);

            return (
              <article
                key={projectEntry.project.id}
                className="border-hairline border-gw-border start-page-fade-in flex flex-col justify-between p-5"
                aria-labelledby={`proj-${projectEntry.project.id}-title`}
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-gw-label uppercase tracking-label text-gw-secondary">
                        Project
                      </p>
                      <h3
                        id={`proj-${projectEntry.project.id}-title`}
                        className="mt-3 text-gw-h1 font-semibold text-gw-primary"
                      >
                        {projectName}
                      </h3>
                    </div>

                    <ManageProjectMenu
                      projectId={projectEntry.project.id}
                      projectName={projectName}
                      onRename={(id, newName) => {
                        setLocalProjects((prev) =>
                          prev.map((projectItem) =>
                            projectItem.project.id === id
                              ? {
                                  ...projectItem,
                                  project: {
                                    ...projectItem.project,
                                    name: newName,
                                  },
                                }
                              : projectItem,
                          ),
                        );
                      }}
                      onDelete={(id) => {
                        setLocalProjects((prev) =>
                          prev.filter(
                            (projectItem) => projectItem.project.id !== id,
                          ),
                        );
                      }}
                      onRequestCompile={() =>
                        setCompileTargetProjectId(projectEntry.project.id)
                      }
                    />
                  </div>

                  <p className="mt-0 text-gw-label tracking-label leading-7 text-gw-secondary">
                    {projectEntry.isEncrypted ? (
                      // Encrypted projects are listed lazily, so no counts were
                      // read. Showing "0 resources" would be a lie, not a fact.
                      "Encrypted"
                    ) : (
                      <>
                        {resourceList.length} resource
                        {resourceList.length === 1 ? "" : "s"}
                        {" · "}
                        {projectEntry.folders.length} folder
                        {projectEntry.folders.length === 1 ? "" : "s"}
                      </>
                    )}
                  </p>

                  <p className="mt-2 text-gw-label uppercase tracking-label-wide text-gw-secondary">
                    Last edited{" "}
                    {formatRelativeTimestamp(
                      lastEditedTimestamp,
                      timestampTick,
                    )}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-gw-secondary">
                    <span className="bg-gw-chrome2 border-hairline border-gw-border px-3 py-1">
                      {projectEntry.project.projectType ?? "Custom template"}
                    </span>
                    <span className="truncate bg-gw-chrome border-hairline border-gw-border px-3 py-1 max-w-full">
                      {projectEntry.project.rootPath ?? "Local project"}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // Directory basename, not `project.id` (project.json's
                      // independently generated internal id) — see
                      // `selectActiveProjectDirectoryId`'s doc comment in
                      // `projectsSlice.ts`.
                      if (!projectEntry.project.rootPath) {
                        toastService.error(
                          "Cannot open project",
                          "Project path not found",
                        );
                        return;
                      }
                      onOpen?.(
                        getProjectDirectoryId(projectEntry.project.rootPath),
                      );
                    }}
                    title="Open Project"
                    aria-label={`Open ${projectName}`}
                  >
                    <FolderOpen size={15} aria-hidden="true" />
                    Open Project
                  </Button>

                  <span className="text-xs uppercase tracking-[0.2em] text-gw-secondary">
                    Ready to write
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
