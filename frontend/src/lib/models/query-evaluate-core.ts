// Last Updated: 2026-07-25

/**
 * @module query-evaluate-core
 *
 * **ADR-021 Phase 1 (Task 3) — transport-agnostic query-evaluate core.** The
 * business logic behind `app/api/project/query/evaluate/route.ts`, lifted so
 * it can be reused by both the HTTP route (web/desktop) and the native
 * in-process transport (`store/transport/native-query-backend.ts`) with
 * byte-for-byte identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. {@link executeEvaluate} throws the same
 * `EvaluatorNotImplementedError`/`QueryCycleError`/plain `Error`s the route
 * previously threw inline; the route's existing catch blocks continue to map
 * them to the same HTTP status codes unmodified.
 */
import path from "node:path";
import { readFile } from "./io";
import type { QueryAST } from "./query-ast";
import { evaluate } from "./query-evaluator";
import type { EvaluationInput } from "./query-evaluator";
import { listResourceIds, loadBacklinks } from "./backlinks";
import { readQuery } from "./saved-queries";
import { readSidecar } from "./sidecar";
import { countWords } from "../word-count";
import { PROJECT_FILENAME } from "./project-config";
import type {
  ResourceBase,
  ResourceType,
  MetadataValue,
  ProjectConfig,
  Project,
  TextResource,
} from "./types";

// ─── Private helpers (lifted verbatim from the route) ─────────────────────────

function str(v: MetadataValue): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: MetadataValue): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function stringArray(v: MetadataValue): string[] | undefined {
  return Array.isArray(v) &&
    (v as unknown[]).every((s) => typeof s === "string")
    ? (v as string[])
    : undefined;
}

/**
 * Build a ResourceBase from raw sidecar data, extracting typed system fields.
 * Fields not present in sidecar fall back to safe defaults.
 */
function sidecarToResourceBase(
  id: string,
  sidecar: Record<string, MetadataValue>,
): ResourceBase {
  const base: ResourceBase = {
    id,
    slug: str(sidecar.slug) ?? id,
    name: str(sidecar.name) ?? "",
    type: (str(sidecar.type) ?? "text") as ResourceType,
    folderId: str(sidecar.folderId) ?? null,
    orderIndex: num(sidecar.orderIndex) ?? 0,
    createdAt: str(sidecar.createdAt) ?? new Date(0).toISOString(),
    updatedAt: str(sidecar.updatedAt),
    statuses: stringArray(sidecar.statuses),
  };

  if (base.type === "text" && num(sidecar.wordCount) !== undefined) {
    (base as TextResource).wordCount = num(sidecar.wordCount)!;
  }

  return base;
}

async function loadProjectConfig(projectRoot: string): Promise<ProjectConfig> {
  try {
    const raw = await readFile(
      path.join(projectRoot, PROJECT_FILENAME),
      "utf8",
    );
    const project = JSON.parse(raw) as Project;
    return project.config ?? { editorConfig: {} };
  } catch {
    // proceed with empty config
    return { editorConfig: {} };
  }
}

function flattenUserMetadata(
  rawSidecar: Record<string, MetadataValue>,
): Record<string, MetadataValue> {
  // User metadata fields are nested under userMetadata in the JSON.
  // Flatten them into the top level so the evaluator can look them up by key.
  const userMeta = rawSidecar.userMetadata;
  return userMeta !== null &&
    typeof userMeta === "object" &&
    !Array.isArray(userMeta)
    ? { ...rawSidecar, ...(userMeta as Record<string, MetadataValue>) }
    : rawSidecar;
}

async function deriveTextCounts(
  projectRoot: string,
  id: string,
  resource: ResourceBase,
): Promise<void> {
  // content.txt is the source of truth for word/char counts. The sidecar's
  // cached wordCount can be missing or stale — a content-only save via
  // POST /resource/<id>/content rewrites content.txt without touching the
  // sidecar — so derive the counts here rather than trusting the sidecar.
  // Otherwise wordCount / charCount predicates silently match nothing.
  try {
    const plain = await readFile(
      path.join(projectRoot, "resources", id, "content.txt"),
      "utf8",
    );
    (resource as TextResource).wordCount = countWords(plain);
    (resource as TextResource).charCount = plain.length;
  } catch {
    // No readable content.txt (e.g. a brand-new stub) — fall back to the
    // sidecar-derived value from sidecarToResourceBase.
  }
}

/**
 * Load the full EvaluationInput for a project by reading all sidecars,
 * project config, and the persisted backlink index from disk.
 */
async function loadEvaluationInput(
  projectRoot: string,
): Promise<EvaluationInput> {
  const [config, backlinks, resourceIds] = await Promise.all([
    loadProjectConfig(projectRoot),
    loadBacklinks(projectRoot),
    listResourceIds(projectRoot),
  ]);

  const resources: ResourceBase[] = [];
  const sidecars: Record<string, Record<string, MetadataValue>> = {};

  for (const id of resourceIds) {
    const rawSidecar = await readSidecar(projectRoot, id);
    if (!rawSidecar) continue;

    sidecars[id] = flattenUserMetadata(rawSidecar);

    const resource = sidecarToResourceBase(id, rawSidecar);
    if (resource.type === "text") {
      await deriveTextCounts(projectRoot, id, resource);
    }
    resources.push(resource);
  }

  const resolveRef = async (id: string): Promise<QueryAST | null> => {
    const saved = await readQuery(projectRoot, id);
    return saved !== null ? (saved.definition as QueryAST) : null;
  };

  return { resources, sidecars, context: { config, backlinks }, resolveRef };
}

// ─── Public operation ──────────────────────────────────────────────────────

/**
 * Evaluate a query AST against all resources in `projectRoot` and return the
 * UUIDs of matching resources.
 */
export async function executeEvaluate(
  projectRoot: string,
  ast: QueryAST,
): Promise<string[]> {
  const input = await loadEvaluationInput(projectRoot);
  return evaluate(ast, input);
}
