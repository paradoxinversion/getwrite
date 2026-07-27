// Last Updated: 2026-07-26

/**
 * @module resource-excerpts-core
 *
 * **ADR-021 Phase 2 (Task 3) — transport-agnostic resource-excerpts core.**
 * The business logic behind `app/api/project-resources/excerpts/route.ts`,
 * lifted so it can be reused by both the HTTP route (web/desktop) and the
 * native in-process transport
 * (`store/transport/native-resource-excerpts-backend.ts`) with byte-for-byte
 * identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. It throws the shared `InvalidProjectIdCoreError`
 * (imported from `project-crud-core.ts` rather than re-declared here) when
 * `projectId` is not a well-formed UUID; the route maps that to
 * `respondInvalidProjectId()`, the native backend lets it propagate.
 */
import { readResourceExcerpts } from "./resource-persistence";
import { resolveResourceProjectRootOrThrow } from "./resource-crud-core";

/**
 * Fetches short text excerpts for a bounded set of resources.
 *
 * Lifted verbatim from `POST /api/project-resources/excerpts`'s
 * `handlePost` body (minus request-JSON parsing and the `resourceIds`
 * array/length validation, which stay in the route as pure request-shape
 * checks).
 */
export async function fetchResourceExcerptsCore(
  projectId: string,
  resourceIds: readonly string[],
  maxChars?: number,
): Promise<Record<string, string>> {
  const projectPath = resolveResourceProjectRootOrThrow(projectId);
  return readResourceExcerpts(projectPath, resourceIds, maxChars);
}
