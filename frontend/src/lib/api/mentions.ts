/**
 * @module api/mentions
 *
 * Client transport for the entity-mentions reads (FR-9/FR-10 of
 * `specs/features/entity-layer.md`, Task 10): which entities a resource
 * mentions, and which resources mention a given entity. Degrades
 * gracefully: any failure yields an empty array, matching how
 * `resource-excerpts.ts`/`tags.ts` degrade on read failure.
 */
import { createTransport } from "../../store/transport/create-transport";
import type {
  ResourceMention,
  EntityMentionedIn,
} from "../models/mentions-core";

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 11)
//
// One MentionsTransport contract with two implementations selected by the
// build-time runtime, mirroring lib/api/resource-excerpts.ts:
//
// - Web/hosted/desktop -> httpMentionsTransport, which carries the original
//   `fetch(...)` calls against the Task 10 HTTP routes.
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-mentions-backend`), dynamically imported
//   only when `runtime === "native"`, reusing the shared mentions core
//   (`../models/mentions-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The mentions-route-backed operations both platforms implement. Shared
 * with `../../store/transport/native-mentions-backend`, which imports this
 * type rather than duplicating it.
 */
export interface MentionsTransport {
  /**
   * Fetches every entity detected as mentioned within `resourceId`.
   * Degrades gracefully: any failure yields `[]` rather than throwing.
   */
  getResourceMentions(
    projectId: string,
    resourceId: string,
  ): Promise<ResourceMention[]>;

  /**
   * Fetches every resource mentioning `entityId`, one snippet per
   * occurrence. Degrades gracefully: any failure yields `[]` rather than
   * throwing.
   */
  getEntityMentionedIn(
    projectId: string,
    entityId: string,
  ): Promise<EntityMentionedIn[]>;
}

/**
 * HTTP transport — the hosted/desktop path. The method bodies below are the
 * original `fetch` calls against the Task 10 routes, including a
 * degrade-gracefully try/catch on each.
 */
export const httpMentionsTransport: MentionsTransport = {
  async getResourceMentions(projectId, resourceId) {
    try {
      const response = await fetch(
        `/api/resource/${encodeURIComponent(resourceId)}/mentions?projectId=${encodeURIComponent(projectId)}`,
      );
      if (!response.ok) return [];
      const data = (await response.json()) as { mentions?: ResourceMention[] };
      return data.mentions ?? [];
    } catch {
      return [];
    }
  },

  async getEntityMentionedIn(projectId, entityId) {
    try {
      const response = await fetch(
        `/api/resource/${encodeURIComponent(entityId)}/mentioned-in?projectId=${encodeURIComponent(projectId)}`,
      );
      if (!response.ok) return [];
      const data = (await response.json()) as {
        mentionedIn?: EntityMentionedIn[];
      };
      return data.mentionedIn ?? [];
    } catch {
      return [];
    }
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-mentions-backend")` specifier so
 * Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveMentionsTransport: () => Promise<MentionsTransport> =
  createTransport(httpMentionsTransport, () =>
    import("../../store/transport/native-mentions-backend").then(
      ({ createNativeMentionsTransport }) => createNativeMentionsTransport(),
    ),
  );

/**
 * Fetches every entity detected as mentioned within `resourceId` (FR-9).
 *
 * @param projectId - The project's on-disk directory basename.
 * @param resourceId - The resource whose mentions are being looked up.
 * @returns The mentioned entities, or `[]` on any failure.
 */
export async function getResourceMentions(
  projectId: string,
  resourceId: string,
): Promise<ResourceMention[]> {
  const transport = await resolveMentionsTransport();
  return transport.getResourceMentions(projectId, resourceId);
}

/**
 * Fetches every resource mentioning `entityId`, one snippet per occurrence
 * (FR-10).
 *
 * @param projectId - The project's on-disk directory basename.
 * @param entityId - The entity whose mentions are being looked up.
 * @returns The mentioning resources, or `[]` on any failure.
 */
export async function getEntityMentionedIn(
  projectId: string,
  entityId: string,
): Promise<EntityMentionedIn[]> {
  const transport = await resolveMentionsTransport();
  return transport.getEntityMentionedIn(projectId, entityId);
}
