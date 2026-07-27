/**
 * @module api/resource-excerpts
 *
 * Client transport for fetching short text excerpts for a bounded set of
 * resources (the cards visible in one Organizer folder). Degrades gracefully:
 * any failure yields an empty map, so cards simply show no excerpt body.
 */
import { createTransport } from "../../store/transport/create-transport";

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 3)
//
// One ResourceExcerptsTransport contract with two implementations selected
// by the build-time runtime, mirroring lib/api/resources.ts:
//
// - Web/hosted/desktop -> httpResourceExcerptsTransport, which carries the
//   original `fetch(...)` call verbatim.
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-resource-excerpts-backend`), dynamically
//   imported only when `runtime === "native"`, reusing the shared excerpts
//   core (`../models/resource-excerpts-core.ts`) instead of HTTP.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The excerpts-route-backed operation both platforms implement. Shared with
 * `../../store/transport/native-resource-excerpts-backend`, which imports
 * this type rather than duplicating it.
 */
export interface ResourceExcerptsTransport {
  /**
   * Fetches text excerpts for the given resources. Degrades gracefully: any
   * failure yields `{}` rather than throwing.
   */
  fetch(
    projectId: string,
    resourceIds: string[],
    maxChars?: number,
  ): Promise<Record<string, string>>;
}

/**
 * HTTP transport — the hosted/desktop path. The method body below is the
 * original `fetchResourceExcerpts`'s `fetch` call verbatim, including its
 * degrade-gracefully try/catch; preserving it exactly is what keeps the
 * server build unchanged.
 */
export const httpResourceExcerptsTransport: ResourceExcerptsTransport = {
  async fetch(projectId, resourceIds, maxChars) {
    try {
      const response = await fetch("/api/project-resources/excerpts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, resourceIds, maxChars }),
      });
      if (!response.ok) return {};
      const data = (await response.json()) as {
        excerpts?: Record<string, string>;
      };
      return data.excerpts ?? {};
    } catch {
      return {};
    }
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-resource-excerpts-backend")`
 * specifier so Turbopack's `resolveAlias` (`next.config.mjs`) can substitute
 * a `node:*`-free web-stub for it at build time.
 */
export const resolveResourceExcerptsTransport: () => Promise<ResourceExcerptsTransport> =
  createTransport(httpResourceExcerptsTransport, () =>
    import("../../store/transport/native-resource-excerpts-backend").then(
      ({ createNativeResourceExcerptsTransport }) =>
        createNativeResourceExcerptsTransport(),
    ),
  );

/**
 * Fetches text excerpts for the given resources.
 *
 * `projectId` must be the project's on-disk directory basename (see
 * `selectActiveProjectDirectoryId` in `projectsSlice.ts`), not
 * `StoredProject.id` — `/api/project-resources/excerpts` resolves it via
 * `resolveProjectsDir()/<projectId>` (ADR-017/018 tenant-route migration).
 *
 * @param projectId - The project's on-disk directory basename.
 * @param resourceIds - Resource ids to fetch excerpts for.
 * @param maxChars - Maximum excerpt length to request.
 * @returns A map of resource id → excerpt (only resources that had content).
 */
export async function fetchResourceExcerpts(
  projectId: string,
  resourceIds: string[],
  maxChars?: number,
): Promise<Record<string, string>> {
  const transport = await resolveResourceExcerptsTransport();
  return transport.fetch(projectId, resourceIds, maxChars);
}
