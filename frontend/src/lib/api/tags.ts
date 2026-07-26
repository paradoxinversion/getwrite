import type { Tag } from "../models/types";
import { createTransport } from "../../store/transport/create-transport";

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 4)
//
// One TagsTransport contract with two implementations selected by the
// build-time runtime, mirroring lib/api/projects.ts:
//
// - Web/hosted/desktop -> httpTagsTransport, which carries the original
//   `fetch(...)` calls byte-for-byte, including `listTags`/
//   `listTagAssignments`'s degrade-to-`[]`-on-`!response.ok` behavior and
//   `createTag`/`deleteTag`/`assignTag`'s fire-and-forget (no response
//   check, no return value) behavior.
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-tags-backend`), dynamically imported
//   only when `runtime === "native"`, reusing the shared tags CRUD core
//   (`../models/tags-crud-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The tags-route-backed operations both platforms implement. Shared with
 * `../../store/transport/native-tags-backend`, which imports this type
 * rather than duplicating it.
 */
export interface TagsTransport {
  /** Lists every project-level tag. Degrades to `[]` on failure. */
  list(projectId: string): Promise<Tag[]>;
  /** Lists the tag ids assigned to a resource. Degrades to `[]` on failure. */
  listAssignments(projectId: string, resourceId: string): Promise<string[]>;
  /** Creates a new project-level tag. Fire-and-forget — no return value. */
  create(projectId: string, name: string, color?: string): Promise<void>;
  /** Deletes a project-level tag. Fire-and-forget — no return value. */
  remove(projectId: string, tagId: string): Promise<void>;
  /** Assigns or unassigns a tag to/from a resource. Fire-and-forget. */
  assign(
    projectId: string,
    resourceId: string,
    tagId: string,
    assign: boolean,
  ): Promise<void>;
}

/**
 * HTTP transport — the hosted/desktop path. Every method body below is the
 * original public function's `fetch` call verbatim; preserving it exactly is
 * what keeps the server build unchanged.
 */
export const httpTagsTransport: TagsTransport = {
  async list(projectId) {
    const response = await fetch("/api/project/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", projectId }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { tags?: Tag[] };
    return data.tags ?? [];
  },

  async listAssignments(projectId, resourceId) {
    const response = await fetch("/api/project/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assignments", projectId, resourceId }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { tagIds?: string[] };
    return data.tagIds ?? [];
  },

  async create(projectId, name, color) {
    await fetch("/api/project/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", projectId, name, color }),
    });
  },

  async remove(projectId, tagId) {
    await fetch("/api/project/tags/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, tagId }),
    });
  },

  async assign(projectId, resourceId, tagId, assign) {
    await fetch("/api/project/tags/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, resourceId, tagId, assign }),
    });
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-tags-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveTagsTransport: () => Promise<TagsTransport> =
  createTransport(httpTagsTransport, () =>
    import("../../store/transport/native-tags-backend").then(
      ({ createNativeTagsTransport }) => createNativeTagsTransport(),
    ),
  );

/**
 * Fetches all project-level tags.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/tags` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function listTags(projectId: string): Promise<Tag[]> {
  const transport = await resolveTagsTransport();
  return transport.list(projectId);
}

/**
 * Fetches the tag ids assigned to a given resource.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/tags` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function listTagAssignments(
  projectId: string,
  resourceId: string,
): Promise<string[]> {
  const transport = await resolveTagsTransport();
  return transport.listAssignments(projectId, resourceId);
}

/**
 * Creates a new project-level tag.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/tags` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function createTag(
  projectId: string,
  name: string,
  color?: string,
): Promise<void> {
  const transport = await resolveTagsTransport();
  await transport.create(projectId, name, color);
}

/**
 * Deletes a project-level tag.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/tags/delete` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function deleteTag(
  projectId: string,
  tagId: string,
): Promise<void> {
  const transport = await resolveTagsTransport();
  await transport.remove(projectId, tagId);
}

/**
 * Assigns or unassigns a tag to/from a resource.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project/tags/assign` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 */
export async function assignTag(
  projectId: string,
  resourceId: string,
  tagId: string,
  assign: boolean,
): Promise<void> {
  const transport = await resolveTagsTransport();
  await transport.assign(projectId, resourceId, tagId, assign);
}
