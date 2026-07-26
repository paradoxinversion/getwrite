// Last Updated: 2026-07-25

/**
 * @module saved-query-dispatch-core
 *
 * **ADR-021 Phase 1 (Task 3) — transport-agnostic saved-query dispatch
 * core.** The action-discriminated dispatch logic behind
 * `app/api/project/query/saved/route.ts`, lifted so it can be reused by both
 * the HTTP route (web/desktop) and the native in-process transport
 * (`store/transport/native-query-backend.ts`) with byte-for-byte identical
 * filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. It throws {@link InvalidSavedQueryError} and
 * {@link UnknownSavedQueryActionError} for the two request-shaped failure
 * modes the route previously mapped inline to 400 responses; every other
 * thrown error is a plain filesystem/model error the route's existing
 * generic catch already maps to a 500. `dispatchSavedQueryAction`'s return
 * shapes are exactly the route's existing success response bodies, so the
 * route's `NextResponse.json(...)` calls keep working unmodified.
 */
import {
  listQueries,
  readQuery,
  writeQuery,
  deleteQuery,
  SavedQuerySchema,
  type SavedQuery,
} from "./saved-queries";

/**
 * Thrown when a `"write"` action's `query` payload fails
 * {@link SavedQuerySchema} validation. `message` is the Zod error message,
 * matching the route's pre-refactor `parseResult.error.message`.
 */
export class InvalidSavedQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSavedQueryError";
  }
}

/**
 * Thrown when `action` is not one of `list` / `read` / `write` / `delete`.
 */
export class UnknownSavedQueryActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownSavedQueryActionError";
  }
}

/** The action-discriminated request shape, mirroring the route's body. */
export interface SavedQueryDispatchRequest {
  action: string;
  id?: string;
  query?: unknown;
}

export type SavedQueryDispatchResult =
  | { queries: SavedQuery[] }
  | { query: SavedQuery | null }
  | { query: SavedQuery }
  | { deleted: boolean };

/**
 * Dispatches a single saved-query CRUD action against `projectRoot`.
 *
 * @throws {InvalidSavedQueryError} When `action === "write"` and `query`
 *   fails schema validation.
 * @throws {UnknownSavedQueryActionError} When `action` is not one of
 *   `list` / `read` / `write` / `delete`.
 */
export async function dispatchSavedQueryAction(
  projectRoot: string,
  request: SavedQueryDispatchRequest,
): Promise<SavedQueryDispatchResult> {
  switch (request.action) {
    case "list": {
      const queries = await listQueries(projectRoot);
      return { queries };
    }

    case "read": {
      const query = await readQuery(projectRoot, request.id ?? "");
      return { query };
    }

    case "write": {
      const parseResult = SavedQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        throw new InvalidSavedQueryError(parseResult.error.message);
      }
      await writeQuery(projectRoot, parseResult.data);
      return { query: parseResult.data };
    }

    case "delete": {
      const didDelete = await deleteQuery(projectRoot, request.id ?? "");
      return { deleted: didDelete };
    }

    default:
      throw new UnknownSavedQueryActionError(
        "Expected one of: list, read, write, delete",
      );
  }
}
