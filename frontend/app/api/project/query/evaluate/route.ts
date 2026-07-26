/**
 * @module app/api/project/query/evaluate
 *
 * Evaluates an inline query AST against all resources in a project.
 *
 * Route:
 * - `POST /api/project/query/evaluate`
 *
 * Expected body:
 * - `{ projectId: string, definition: QueryAST }`
 *
 * Success payload:
 * - `{ ids: string[] }` — UUIDs of resources that satisfy the predicate
 *
 * Failure payloads:
 * - `{ error: string, details: string }` with HTTP 400 for invalid input
 * - `{ error: string, details: string }` with HTTP 500 for filesystem errors
 *
 * The evaluation logic itself lives in the transport-agnostic
 * `lib/models/query-evaluate-core.ts` (ADR-021 Phase 1, Task 3), reused
 * unmodified by both this route and the native in-process transport
 * (`store/transport/native-query-backend.ts`). `executeEvaluate` is
 * re-exported here so existing imports of it from this route path keep
 * working.
 */
import { NextRequest, NextResponse } from "next/server";
import { QueryASTSchema } from "../../../../../src/lib/models/query-ast";
import type { QueryAST } from "../../../../../src/lib/models/query-ast";
import {
  EvaluatorNotImplementedError,
  QueryCycleError,
} from "../../../../../src/lib/models/query-evaluator";
import { executeEvaluate } from "../../../../../src/lib/models/query-evaluate-core";
import { resolveProjectPath } from "../../../../../src/lib/models/project-path";
import { withStorageContext } from "../../../_tenant/with-storage-context";

export { executeEvaluate };

// ─── Request / response shapes ────────────────────────────────────────────────

interface EvaluateRequestBody {
  projectId: string;
  definition: unknown;
}

// ─── Route handler ────────────────────────────────────────────────────────────

async function handlePost(req: NextRequest): Promise<Response> {
  let body: EvaluateRequestBody;
  try {
    body = (await req.json()) as EvaluateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request", details: "Request body is not valid JSON" },
      { status: 400 },
    );
  }

  if (!body.definition) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: "Body must include projectId and definition",
      },
      { status: 400 },
    );
  }

  const resolved = resolveProjectPath(body.projectId);
  if (resolved instanceof Response) return resolved;
  const { projectPath } = resolved;

  const parseResult = QueryASTSchema.safeParse(body.definition);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid query AST", details: parseResult.error.message },
      { status: 400 },
    );
  }

  try {
    const ids = await executeEvaluate(
      projectPath,
      parseResult.data as QueryAST,
    );
    return NextResponse.json({ ids });
  } catch (err: unknown) {
    if (err instanceof EvaluatorNotImplementedError) {
      return NextResponse.json(
        { error: "Query feature not implemented", details: err.message },
        { status: 400 },
      );
    }
    if (err instanceof QueryCycleError) {
      return NextResponse.json(
        { error: "Cycle detected in saved-query refs", details: err.message },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Evaluation failed";
    return NextResponse.json(
      { error: "Query evaluation failed", details: message },
      { status: 500 },
    );
  }
}

export const POST = withStorageContext(handlePost);

export const dynamic = "force-dynamic";
