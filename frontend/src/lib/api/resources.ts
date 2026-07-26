import type { AnyResource, TipTapDocument } from "../models/types";
import { createTransport } from "../../store/transport/create-transport";

export interface ResourceContentResponse {
  resourceContent?: {
    tipTapContent?: TipTapDocument | null;
    plaintextContent?: string | null;
  };
  revisions?: Array<{ id: string; isCanonical: boolean }>;
}

export interface ReorderPayload {
  folderOrder: Array<{
    id: string;
    orderIndex?: number;
    folderId?: string | null;
  }>;
  resourceOrder: Array<{
    id: string;
    orderIndex?: number;
    folderId?: string | null;
  }>;
}

/** Plain-argument input for the transport's `uploadMedia` method. */
export interface UploadMediaResourceOpts {
  title?: string;
  folderId?: string;
}

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 3)
//
// One ResourcesTransport contract with two implementations selected by the
// build-time runtime, mirroring lib/api/projects.ts:
//
// - Web/hosted/desktop -> httpResourcesTransport, which carries the original
//   `fetch(...)` calls byte-for-byte (including `uploadMedia`'s multipart
//   `FormData` construction — only the native path skips multipart).
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-resource-backend`), dynamically imported
//   only when `runtime === "native"`, reusing the shared resource CRUD core
//   (`../models/resource-crud-core.ts`) plus the already-lifted revision
//   core (`../models/revision-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The resource-route-backed operations both platforms implement. Shared with
 * `../../store/transport/native-resource-backend`, which imports this type
 * rather than duplicating it.
 */
export interface ResourcesTransport {
  /** Creates a new resource in a project. */
  create(
    projectId: string,
    resourceData: Record<string, unknown>,
  ): Promise<{ resource: AnyResource }>;
  /**
   * Uploads a media (image/audio) resource from already-extracted bytes and
   * fields — never a `File`/`FormData`, since native has no multipart
   * request to build.
   */
  uploadMedia(
    projectId: string,
    input: {
      fileBytes: Uint8Array;
      fileName: string;
      mimeType?: string;
      fileSize: number;
      title?: string;
      folderId?: string;
    },
  ): Promise<{ resource: AnyResource }>;
  /** Copies a resource under a new name within the same project. */
  copy(
    resourceId: string,
    newName: string,
    projectId: string,
  ): Promise<{ resource: AnyResource }>;
  /** Deletes (soft-deletes) a resource. */
  remove(resourceId: string, projectId: string): Promise<void>;
  /** Persists an updated sidecar (metadata) file for a resource. */
  updateSidecar(
    resourceId: string,
    projectId: string,
    updatedResource: AnyResource,
  ): Promise<void>;
  /** Renames a resource or folder. */
  rename(
    resourceId: string,
    projectId: string,
    newName: string,
    resourceType: "folder" | "resource",
  ): Promise<boolean>;
  /** Fetches a resource's content plus its revision list. */
  fetchContent(
    projectId: string,
    resourceId: string,
  ): Promise<ResourceContentResponse | null>;
  /** Fetches a single revision's preview content. */
  fetchRevisionContent(
    resourceId: string,
    projectId: string,
    revisionId: string,
  ): Promise<string | null>;
  /** Persists new content for an existing revision. */
  patchRevisionContent(
    resourceId: string,
    projectId: string,
    revisionId: string,
    content: string,
  ): Promise<{ updatedAt: string }>;
  /** Persists a folder/resource reorder for a project. */
  reorder(
    projectId: string,
    payload: ReorderPayload,
    projectRoot?: string,
  ): Promise<void>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `fetch` call verbatim; preserving it exactly is
 * what keeps the server build unchanged.
 */
export const httpResourcesTransport: ResourcesTransport = {
  async create(projectId, resourceData) {
    const response = await fetch("/api/resource", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceData, projectId }),
    });
    return (await response.json()) as { resource: AnyResource };
  },

  async uploadMedia(projectId, input) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.fileBytes)], { type: input.mimeType }),
      input.fileName,
    );
    form.append("projectId", projectId);
    if (input.title) form.append("title", input.title);
    if (input.folderId) form.append("folderId", input.folderId);

    const response = await fetch("/api/resource/upload", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(payload.error ?? `Upload failed (${response.status})`);
    }
    return (await response.json()) as { resource: AnyResource };
  },

  async copy(resourceId, newName, projectId) {
    const response = await fetch(`/api/resource/${resourceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copy", newName, projectId }),
    });
    return (await response.json()) as { resource: AnyResource };
  },

  async remove(resourceId, projectId) {
    await fetch(`/api/resource/${resourceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", projectId }),
    });
  },

  async updateSidecar(resourceId, projectId, updatedResource) {
    await fetch(`/api/resource/${resourceId}/sidecar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, updatedResource }),
    });
  },

  async rename(resourceId, projectId, newName, resourceType) {
    const response = await fetch(`/api/resource/${resourceId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, newName, resourceType }),
    });
    return response.ok;
  },

  async fetchContent(projectId, resourceId) {
    const response = await fetch("/api/project-resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, resourceId }),
    });
    if (!response.ok) return null;
    return (await response.json()) as ResourceContentResponse;
  },

  async fetchRevisionContent(resourceId, projectId, revisionId) {
    const params = new URLSearchParams({ projectId, revisionId });
    const response = await fetch(
      `/api/resource/revision/${resourceId}?${params.toString()}`,
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { content?: unknown };
    return typeof payload.content === "string" ? payload.content : null;
  },

  async patchRevisionContent(resourceId, projectId, revisionId, content) {
    const response = await fetch(`/api/resource/revision/${resourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, revisionId, content }),
    });
    if (!response.ok) {
      throw new Error(`Failed to persist revision (${response.status})`);
    }
    const data = (await response.json()) as { updatedAt?: string };
    return { updatedAt: data.updatedAt ?? new Date().toISOString() };
  },

  async reorder(projectId, payload, projectRoot) {
    await fetch(`/api/projects/${projectId}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectRoot ? { ...payload, projectRoot } : payload),
    });
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-resource-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveResourcesTransport: () => Promise<ResourcesTransport> =
  createTransport(httpResourcesTransport, () =>
    import("../../store/transport/native-resource-backend").then(
      ({ createNativeResourcesTransport }) => createNativeResourcesTransport(),
    ),
  );

/**
 * Creates a new resource in a project.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/resource` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function createResource(
  projectId: string,
  resourceData: Record<string, unknown>,
): Promise<{ resource: AnyResource }> {
  const transport = await resolveResourcesTransport();
  return transport.create(projectId, resourceData);
}

/**
 * Uploads a media file (image/audio) as a new resource.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/resource/upload` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function uploadMediaResource(
  projectId: string,
  file: File,
  opts?: UploadMediaResourceOpts,
): Promise<{ resource: AnyResource }> {
  const transport = await resolveResourcesTransport();
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  return transport.uploadMedia(projectId, {
    fileBytes,
    fileName: file.name,
    mimeType: file.type || undefined,
    fileSize: file.size,
    title: opts?.title,
    folderId: opts?.folderId,
  });
}

/**
 * Copies a resource under a new name within the same project.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/resource/[resource-id]` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function copyResource(
  resourceId: string,
  newName: string,
  projectId: string,
): Promise<{ resource: AnyResource }> {
  const transport = await resolveResourcesTransport();
  return transport.copy(resourceId, newName, projectId);
}

/**
 * Deletes (soft-deletes) a resource.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/resource/[resource-id]` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function deleteResource(
  resourceId: string,
  projectId: string,
): Promise<void> {
  const transport = await resolveResourcesTransport();
  await transport.remove(resourceId, projectId);
}

/**
 * Persists an updated sidecar (metadata) file for a resource.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/resource/[resource-id]/sidecar` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function updateSidecar(
  resourceId: string,
  projectId: string,
  updatedResource: AnyResource,
): Promise<void> {
  const transport = await resolveResourcesTransport();
  await transport.updateSidecar(resourceId, projectId, updatedResource);
}

/**
 * Renames a resource or folder.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/resource/[resource-id]/rename` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function renameResource(
  resourceId: string,
  projectId: string,
  newName: string,
  resourceType: "folder" | "resource",
): Promise<boolean> {
  const transport = await resolveResourcesTransport();
  return transport.rename(resourceId, projectId, newName, resourceType);
}

/**
 * Fetches a resource's content plus its revision list.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project-resources` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 *
 * The original `!response.ok -> null` degrade-gracefully contract is
 * preserved by `httpResourcesTransport.fetchContent` verbatim; the try/catch
 * here additionally covers a `fetch()` call that throws outright (e.g. a
 * network error), which — like a non-ok response — should surface as `null`
 * to callers rather than an unhandled rejection.
 */
export async function fetchResourceContent(
  projectId: string,
  resourceId: string,
): Promise<ResourceContentResponse | null> {
  try {
    const transport = await resolveResourcesTransport();
    return await transport.fetchContent(projectId, resourceId);
  } catch {
    return null;
  }
}

/**
 * Fetches a single revision's preview content.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`) — the
 * `/api/resource/revision/[resource-id]` GET handler resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 *
 * See {@link fetchResourceContent}'s doc comment for why a thrown `fetch()`
 * error is also treated as a `null` result here.
 */
export async function fetchRevisionContent(
  resourceId: string,
  projectId: string,
  revisionId: string,
): Promise<string | null> {
  try {
    const transport = await resolveResourcesTransport();
    return await transport.fetchRevisionContent(
      resourceId,
      projectId,
      revisionId,
    );
  } catch {
    return null;
  }
}

/**
 * Persists new content for an existing revision.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`) — the
 * `/api/resource/revision/[resource-id]` PATCH handler resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function patchRevisionContent(
  resourceId: string,
  projectId: string,
  revisionId: string,
  content: string,
): Promise<{ updatedAt: string }> {
  const transport = await resolveResourcesTransport();
  return transport.patchRevisionContent(
    resourceId,
    projectId,
    revisionId,
    content,
  );
}

/**
 * Persists a folder/resource reorder for a project.
 *
 * `projectId` (the URL segment) must be the project's on-disk directory
 * basename — see `selectActiveProjectDirectoryId` in `projectsSlice.ts`.
 * `projectRoot`, when provided, is also sent in the body: the
 * `/api/projects/[projectId]/reorder` route predates the ADR-017/018
 * tenant-route migration and still resolves the project via
 * `body.projectRoot ?? findProjectRoot(...)` (a legacy fallback that scans
 * every project directory and matches on project.json's *internal* `id`,
 * not the directory basename). Sending `projectRoot` directly makes
 * resolution exact regardless of that legacy fallback's matching semantics.
 */
export async function reorderResources(
  projectId: string,
  payload: ReorderPayload,
  projectRoot?: string,
): Promise<void> {
  const transport = await resolveResourcesTransport();
  await transport.reorder(projectId, payload, projectRoot);
}
