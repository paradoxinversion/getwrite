import type { Revision } from "../lib/models/types";
import { selectActiveProjectDirectoryId } from "./projectsSlice";
import type { RootState } from "./store";
import { createTransport } from "./transport/create-transport";
import { fetchResourceContent } from "../lib/api/resources";

/**
 * Response shape for `/api/project-resources` used by revision list loading.
 */
interface ProjectResourcesResponse {
  revisions?: unknown;
}

/**
 * Response shape for fetching a single revision preview.
 */
export interface RevisionContentResponse {
  revision: Revision;
  content: string;
}

export interface RevisionRequestContext {
  projectId: string;
  resourceId: string;
}

/**
 * Resolves selected resource/project context needed for revision requests.
 *
 * `projectId` is the active project's on-disk directory basename (via
 * {@link selectActiveProjectDirectoryId}), never `project.id`. A project's
 * on-disk directory name and its `project.json`'s internal `id` field are
 * two independently generated UUIDs and are not guaranteed to match — every
 * tenant-scoped revision route (ADR-017/018) requires the directory
 * basename.
 */
export function resolveRevisionRequestContext(
  state: RootState,
  expectedResourceId: string,
): RevisionRequestContext | { error: string } {
  const selectedResourceId = state.resources.selectedResourceId;

  if (!selectedResourceId || selectedResourceId !== expectedResourceId) {
    return { error: "Selected resource changed before revisions updated." };
  }

  const projectId = selectActiveProjectDirectoryId(state);

  if (!projectId) {
    return { error: "Selected project is missing a root path." };
  }

  return { projectId, resourceId: selectedResourceId };
}

function getApiErrorMessage(errorBody: unknown, fallback: string): string {
  const msg = (errorBody as Record<string, unknown>)?.error;
  return typeof msg === "string" ? msg : fallback;
}

async function throwApiError(
  response: Response,
  fallback: string,
): Promise<never> {
  const errorBody = await response.json().catch(() => ({}));
  throw new Error(getApiErrorMessage(errorBody, fallback));
}

/**
 * Fetch persisted revisions for a selected resource.
 *
 * This was the ONE revision path left un-collapsed in Phase 1 (it hits
 * `/api/project-resources`, not the revision route). On native the raw `fetch`
 * received the app's static `index.html` and failed with
 * `Unexpected token '<', "<!DOCTYPE "…`. Collapsed here via `createTransport`,
 * mirroring the rest of the effort:
 * - web/desktop → the original `fetch('/api/project-resources')` call verbatim.
 * - native → `fetchResourceContent` (`lib/api/resources.ts`), the Phase 2
 *   in-process resources backend hitting the same operation. It returns `null`
 *   only on failure (a real resource yields a non-null response even with no
 *   revisions), so a `null` is surfaced as an error — matching the web path's
 *   throw — rather than silently reporting an empty revision history for a
 *   resource that actually has one.
 */
const resolveRevisionListTransport = createTransport<
  (context: RevisionRequestContext) => Promise<ProjectResourcesResponse>
>(
  async (context) => {
    const response = await fetch("/api/project-resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: context.projectId,
        resourceId: context.resourceId,
      }),
    });
    if (!response.ok)
      await throwApiError(response, "Unable to load revisions.");
    return (await response.json()) as ProjectResourcesResponse;
  },
  () =>
    Promise.resolve(async (context: RevisionRequestContext) => {
      const result = await fetchResourceContent(
        context.projectId,
        context.resourceId,
      );
      if (result === null) {
        throw new Error("Unable to load revisions.");
      }
      return result as unknown as ProjectResourcesResponse;
    }),
);

export async function fetchRevisionList(
  context: RevisionRequestContext,
): Promise<ProjectResourcesResponse> {
  const transport = await resolveRevisionListTransport();
  return transport(context);
}

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 1, Task 2)
//
// One RevisionTransport contract with two implementations selected by the
// build-time runtime, mirroring search-transport.ts:
//
// - Web/hosted/desktop -> httpRevisionTransport, which carries the original
//   `fetch('/api/resource/revision/:resourceId')` calls byte-for-byte.
// - Native (Capacitor) -> an in-process backend
//   (`./transport/native-revision-backend`), dynamically imported only when
//   `runtime === "native"`, reusing the shared revision core
//   (`lib/models/revision-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `./transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The revision-route-backed operations both platforms implement. Shared with
 * `./transport/native-revision-backend`, which imports this type rather than
 * duplicating it.
 */
export interface RevisionTransport {
  /** Creates a new explicit revision for a resource. */
  create(
    context: RevisionRequestContext,
    revisionName: string,
  ): Promise<Revision>;
  /** Reads a specific revision's metadata and content. */
  read(
    context: RevisionRequestContext,
    revisionId: string,
  ): Promise<RevisionContentResponse>;
  /** Updates the canonical revision's content in place. */
  updateInPlace(
    context: RevisionRequestContext,
    revisionId: string,
    content: string,
  ): Promise<Revision & { updatedAt: string }>;
  /** Marks the given revision as canonical. */
  setCanonical(
    context: RevisionRequestContext,
    revisionId: string,
  ): Promise<void>;
  /** Deletes a non-canonical revision. */
  delete(context: RevisionRequestContext, revisionId: string): Promise<void>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `fetch` call verbatim; preserving it exactly is
 * what keeps the server build unchanged.
 */
export const httpRevisionTransport: RevisionTransport = {
  async create(context, revisionName) {
    const response = await fetch(
      `/api/resource/revision/${context.resourceId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: context.projectId,
          isCanonical: false,
          metadata: { name: revisionName },
        }),
      },
    );

    if (!response.ok) await throwApiError(response, "Failed to save revision.");

    return (await response.json()) as Revision;
  },

  async read(context, revisionId) {
    const params = new URLSearchParams({
      projectId: context.projectId,
      revisionId,
    });

    const response = await fetch(
      `/api/resource/revision/${context.resourceId}?${params}`,
    );

    if (!response.ok)
      await throwApiError(response, "Failed to fetch revision.");

    return (await response.json()) as RevisionContentResponse;
  },

  async updateInPlace(context, revisionId, content) {
    const response = await fetch(
      `/api/resource/revision/${context.resourceId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: context.projectId,
          revisionId,
          content,
        }),
      },
    );

    if (!response.ok)
      await throwApiError(response, "Failed to update revision.");

    return (await response.json()) as Revision & { updatedAt: string };
  },

  async setCanonical(context, revisionId) {
    const response = await fetch(
      `/api/resource/revision/${context.resourceId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: context.projectId, revisionId }),
      },
    );

    if (!response.ok)
      await throwApiError(response, "Failed to set canonical revision.");
  },

  async delete(context, revisionId) {
    const response = await fetch(
      `/api/resource/revision/${context.resourceId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: context.projectId, revisionId }),
      },
    );

    if (!response.ok)
      await throwApiError(response, "Failed to delete revision.");
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("./transport/native-revision-backend")` specifier so Turbopack's
 * `resolveAlias` (`next.config.mjs`) can substitute a `node:*`-free web-stub
 * for it at build time.
 */
export const resolveRevisionTransport: () => Promise<RevisionTransport> =
  createTransport(httpRevisionTransport, () =>
    import("./transport/native-revision-backend").then(
      ({ createNativeRevisionTransport }) => createNativeRevisionTransport(),
    ),
  );

/**
 * Create a new explicit revision for a selected resource.
 */
export async function createRevision(
  context: RevisionRequestContext,
  revisionName: string,
): Promise<Revision> {
  const transport = await resolveRevisionTransport();
  return transport.create(context, revisionName);
}

/**
 * Delete a revision for a selected resource.
 */
export async function removeRevision(
  context: RevisionRequestContext,
  revisionId: string,
): Promise<void> {
  const transport = await resolveRevisionTransport();
  await transport.delete(context, revisionId);
}

/**
 * Fetch revision preview content.
 */
export async function fetchRevisionContent(
  context: RevisionRequestContext,
  revisionId: string,
): Promise<RevisionContentResponse> {
  const transport = await resolveRevisionTransport();
  return transport.read(context, revisionId);
}

/**
 * Persist canonical revision selection.
 */
export async function persistCanonicalRevision(
  context: RevisionRequestContext,
  revisionId: string,
): Promise<void> {
  const transport = await resolveRevisionTransport();
  await transport.setCanonical(context, revisionId);
}
