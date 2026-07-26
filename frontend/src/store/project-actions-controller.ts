/**
 * @module project-actions-controller
 *
 * Centralized controller for project mutation orchestration used by start-page
 * project management surfaces.
 *
 * `/api/project/rename` and `/api/project/delete` are hard-cutover,
 * tenant-scoped routes (ADR-017/018): they only accept `projectId` — the
 * target project's on-disk directory basename (`path.basename(rootPath)`,
 * per `resolveProjectsDir()`) — and reject the legacy `projectPath`/
 * `projectRoot` fields. Per FR12, that directory basename is a distinct,
 * independently generated UUID from `project.json`'s internal `id` field,
 * so callers must source it via `selectActiveProjectDirectoryId` or
 * `getProjectDirectoryId` (see `projectsSlice.ts`) rather than `project.id`
 * or an inline `path.basename(...)`.
 *
 * `storeProjectId` below is a distinct concept: it's the Redux-store key for
 * the project (mirrors `project.json`'s internal `id`), used only to
 * identify the project for local UI callbacks (`onRename`/`onDelete`) and
 * dispatch. It is never sent over the wire — only `projectId` is.
 */
import { createTransport } from "./transport/create-transport";

interface BaseProjectAction {
  storeProjectId: string;
  projectId?: string;
}

interface RenameProjectAction extends BaseProjectAction {
  newName: string;
  onRename?: (projectId: string, newName: string) => void;
}

interface DeleteProjectAction extends BaseProjectAction {
  onDelete?: (projectId: string) => void;
}

function getApiErrorMessage(errorBody: unknown, fallback: string): string {
  const error = (errorBody as Record<string, unknown>)?.error;
  return typeof error === "string" && error.trim().length > 0
    ? error
    : fallback;
}

function requireProjectId(
  projectId: string | undefined,
  fallback: string,
): string {
  if (typeof projectId === "string" && projectId.trim().length > 0) {
    return projectId;
  }

  throw new Error(fallback);
}

async function parseErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 2)
//
// One ProjectActionsTransport contract with two implementations selected by
// the build-time runtime, mirroring revision-transport-service.ts:
//
// - Web/hosted/desktop -> httpProjectActionsTransport, which carries the
//   original `fetch(...)` calls byte-for-byte.
// - Native (Capacitor) -> an in-process backend
//   (`./transport/native-project-actions-backend`), dynamically imported
//   only when `runtime === "native"`, reusing the shared project CRUD core
//   (`../lib/models/project-crud-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `./transport/create-transport`). Only the internal `fetch(...)` call is
// replaced by the transport swap — the surrounding orchestration below
// (callback firing order, error wrapping) is unchanged.
// ---------------------------------------------------------------------------

/**
 * The two wire operations `renameProject`/`deleteProject` delegate to.
 * Shared with `./transport/native-project-actions-backend`, which imports
 * this type rather than duplicating it.
 */
export interface ProjectActionsTransport {
  /** Renames a project by its on-disk directory id. */
  rename(projectId: string, newName: string): Promise<void>;
  /** Deletes a project by its on-disk directory id. */
  delete(projectId: string): Promise<void>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original inline `fetch` call verbatim; preserving it exactly is what keeps
 * the server build unchanged.
 */
export const httpProjectActionsTransport: ProjectActionsTransport = {
  async rename(projectId, newName) {
    const response = await fetch("/api/project/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, newName }),
    });

    if (!response.ok) {
      const errorBody = await parseErrorBody(response);
      throw new Error(
        getApiErrorMessage(errorBody, "Failed to rename project."),
      );
    }
  },

  async delete(projectId) {
    const response = await fetch("/api/project/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });

    if (!response.ok) {
      const errorBody = await parseErrorBody(response);
      throw new Error(
        getApiErrorMessage(errorBody, "Failed to delete project."),
      );
    }
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("./transport/native-project-actions-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveProjectActionsTransport: () => Promise<ProjectActionsTransport> =
  createTransport(httpProjectActionsTransport, () =>
    import("./transport/native-project-actions-backend").then(
      ({ createNativeProjectActionsTransport }) =>
        createNativeProjectActionsTransport(),
    ),
  );

export const projectActionsController = {
  async renameProject({
    storeProjectId,
    projectId,
    newName,
    onRename,
  }: RenameProjectAction): Promise<void> {
    const resolvedProjectId = requireProjectId(
      projectId,
      "Project ID is required to rename project.",
    );

    onRename?.(storeProjectId, newName);

    const transport = await resolveProjectActionsTransport();
    await transport.rename(resolvedProjectId, newName);
  },

  async deleteProject({
    storeProjectId,
    projectId,
    onDelete,
  }: DeleteProjectAction): Promise<void> {
    const resolvedProjectId = requireProjectId(
      projectId,
      "Project ID is required to delete project.",
    );

    onDelete?.(storeProjectId);

    const transport = await resolveProjectActionsTransport();
    await transport.delete(resolvedProjectId);
  },
};
