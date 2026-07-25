import type { RootState } from "./store";
import { resolveSearchTransport } from "./transport/search-transport";

export interface SearchResult {
  resourceId: string;
  title: string;
  snippet: string;
  status?: string;
  folderId?: string | null;
  tags?: string[];
}

export interface SearchRequestContext {
  projectId: string;
}

export function resolveSearchRequestContext(
  state: RootState,
  expectedProjectId: string,
): SearchRequestContext | { error: string } {
  const { selectedProjectId } = state.projects;

  if (!selectedProjectId) {
    return { error: "No project selected." };
  }

  if (selectedProjectId !== expectedProjectId) {
    return { error: "Project changed before search completed." };
  }

  return { projectId: selectedProjectId };
}

export interface SearchFilters {
  folder?: string;
  status?: string;
  tags?: string[];
}

/**
 * Executes a search for the resolved project. The actual carriage — HTTP to
 * `/api/*` (hosted/desktop) versus an in-process call to the shared search core
 * (native Capacitor build) — is chosen by the transport seam, so this service
 * is identical on both platforms. See {@link resolveSearchTransport} and
 * ADR-021.
 */
export async function executeSearchRequest(
  context: SearchRequestContext,
  query: string,
  filters?: SearchFilters,
): Promise<SearchResult[]> {
  const transport = await resolveSearchTransport();
  return transport.search(context.projectId, query, filters);
}
