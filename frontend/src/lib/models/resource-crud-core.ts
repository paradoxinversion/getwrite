// Last Updated: 2026-07-26

/**
 * @module resource-crud-core
 *
 * **ADR-021 Phase 2 (Task 3) — transport-agnostic resource CRUD core.** The
 * business logic behind eight routes: `app/api/resource/route.ts` (POST —
 * create), `app/api/resource/upload/route.ts` (POST — media upload),
 * `app/api/resource/[resource-id]/route.ts` (POST — copy/delete),
 * `app/api/resource/[resource-id]/sidecar/route.ts` (POST — sidecar update),
 * `app/api/resource/[resource-id]/rename/route.ts` (POST — folder/resource
 * rename), `app/api/project-resources/route.ts` (POST — content + revisions
 * fetch), and `app/api/projects/[projectId]/reorder/route.ts` (POST —
 * folder/resource reorder), lifted so it can be reused by both the HTTP
 * routes (web/desktop) and the native in-process transport
 * (`store/transport/native-resource-backend.ts`) with byte-for-byte
 * identical filesystem behavior.
 *
 * This module has no `next`/`NextRequest`/`NextResponse` import and never
 * constructs a `Response`. Every function operates on plain arguments and
 * throws plain `Error`s (or the typed errors below). The routes catch those
 * errors and map them to their existing HTTP status codes; the native
 * backend lets them propagate directly to the caller.
 *
 * Every operation except {@link reorderResourcesCore} resolves a project's
 * on-disk root via {@link resolveProjectRoot} (directory-basename convention
 * — ADR-017/018) and throws the shared `InvalidProjectIdCoreError` (imported
 * from `project-crud-core.ts` rather than re-declared here) when the
 * supplied `projectId` is not a well-formed UUID.
 * {@link reorderResourcesCore} is a deliberate divergence, preserved exactly
 * from the pre-lift route: it resolves the project either from a
 * caller-supplied `projectRoot` override or by scanning every directory
 * under `resolveProjectsDir()` for a `project.json` whose *internal* `id`
 * matches `projectId` (`findProjectRootByInternalId`, reused from
 * `project-crud-core.ts` rather than re-implemented) — not the directory
 * basename convention every other operation here uses.
 */
import path from "node:path";
import type { Dirent } from "node:fs";
import { cp, exists, readdir, readFile, writeFile } from "./io";
import { resolveProjectRoot } from "./project-root-resolver";
import {
  InvalidProjectIdCoreError,
  findProjectRootByInternalId,
} from "./project-crud-core";
import { resolveProjectsDir } from "./projects-dir";
import { withMetaLock } from "./meta-locks";
import {
  createResourceOfType,
  writeResourceToFile,
  type CreateResourceOpts,
} from ".";
import { validateMediaFile } from "./media-validation";
import { extractAudioMetadata, extractImageMetadata } from "./media-metadata";
import { loadProjectConfig } from "./project-config";
import { writeRevision, listRevisions } from "./revision";
import { resolveInitialRevisionName } from "./resource-revision";
import { readSidecar, writeSidecar } from "./sidecar";
import { renameFolderById } from "./folder-utils";
import { getSchema } from "./metadata-schema";
import { nullifyResourceRefs, softDeleteResource } from "./trash";
import { generateUUID } from "./uuid";
import type {
  AnyResource,
  MetadataValue,
  TextResource,
  TipTapDocument,
  Revision,
} from "./types";

/**
 * Resolves `projectId` to its on-disk project root, throwing (rather than
 * returning a `Response`, which the HTTP routes do via `resolveProjectPath`)
 * when it is not a well-formed UUID.
 *
 * Shares {@link InvalidProjectIdCoreError} with `project-crud-core.ts`
 * rather than declaring a resource-specific equivalent, so every lifted
 * core's routes can use a single `instanceof` check ->
 * `respondInvalidProjectId()` mapping.
 */
// Re-exported so every route/native backend in this module's scope can
// `import { InvalidProjectIdCoreError } from "./resource-crud-core"` without
// also reaching into `project-crud-core.ts` directly.
export { InvalidProjectIdCoreError };

export function resolveResourceProjectRootOrThrow(projectId: string): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new InvalidProjectIdCoreError(projectId);
  }
  return projectRoot;
}

// ---------------------------------------------------------------------------
// 1. Create resource
// ---------------------------------------------------------------------------

/**
 * Creates a new resource, persists it, and — for text resources — writes its
 * initial canonical revision.
 *
 * Lifted verbatim from `POST /api/resource`'s `handlePost` body (minus the
 * request-JSON parsing and try/catch -> 500 status mapping, which stay in
 * the route).
 */
export async function createResourceCore(
  projectId: string,
  resourceData: CreateResourceOpts,
): Promise<AnyResource> {
  const projectPath = resolveResourceProjectRootOrThrow(projectId);

  const resource = createResourceOfType(resourceData.type, resourceData);
  await writeResourceToFile(projectPath, resource);

  if (resource.type === "text") {
    const config = await loadProjectConfig(projectPath).catch(() => null);
    const revisionName = config
      ? resolveInitialRevisionName(config)
      : "Initial Draft";
    const content = (resource as TextResource).plainText ?? "";
    await writeRevision(projectPath, resource.id, 1, content, {
      isCanonical: true,
      metadata: { name: revisionName },
    });
  }

  return resource;
}

// ---------------------------------------------------------------------------
// 2. Upload media resource
// ---------------------------------------------------------------------------

/** Thrown by {@link uploadMediaResourceCore} when the file fails validation. */
export class MediaUploadValidationError extends Error {
  reason: string;
  constructor(message: string, reason: string) {
    super(message);
    this.name = "MediaUploadValidationError";
    this.reason = reason;
  }
}

/**
 * Plain-argument input for {@link uploadMediaResourceCore}: raw bytes plus
 * already-extracted fields, since native has no multipart request to parse.
 * The HTTP route continues to do `req.formData()` + `file.arrayBuffer()`
 * itself and passes the resulting bytes/fields here.
 */
export interface UploadMediaResourceInput {
  /** The uploaded file's raw bytes. */
  fileBytes: Uint8Array;
  /** The uploaded file's original filename (used for extension + fallback title). */
  fileName: string;
  /** The uploaded file's reported MIME type, if any. */
  mimeType?: string;
  /** The uploaded file's size in bytes. */
  fileSize: number;
  /** Optional display title; falls back to the filename minus its extension. */
  title?: string;
  folderId?: string;
}

/** Strips a trailing file extension to derive a display name. */
function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "");
}

/**
 * Creates an image/audio resource from already-extracted upload bytes and
 * fields.
 *
 * Lifted verbatim from `POST /api/resource/upload`'s `handlePost` body,
 * minus multipart parsing (the `file instanceof File` check, `formData()`
 * extraction, and `file.arrayBuffer()`), which stay in the route — native
 * callers already have `fileBytes` in-process.
 *
 * @throws {MediaUploadValidationError} When `validateMediaFile` rejects the file.
 */
export async function uploadMediaResourceCore(
  projectId: string,
  input: UploadMediaResourceInput,
): Promise<AnyResource> {
  const projectPath = resolveResourceProjectRootOrThrow(projectId);

  const validation = validateMediaFile({
    mime: input.mimeType || undefined,
    ext: input.fileName,
    size: input.fileSize,
  });
  if (!validation.ok) {
    throw new MediaUploadValidationError(validation.message, validation.reason);
  }

  const name =
    typeof input.title === "string" && input.title.trim().length > 0
      ? input.title.trim()
      : stripExtension(input.fileName) || "Untitled";
  const folderId =
    typeof input.folderId === "string" && input.folderId.length > 0
      ? input.folderId
      : undefined;

  const bytes = input.fileBytes;
  const fileName = `original.${validation.extension}`;

  const resource =
    validation.type === "image"
      ? createResourceOfType("image", {
          name,
          type: "image",
          folderId,
          image: { file: fileName, ...(await extractImageMetadata(bytes)) },
        })
      : createResourceOfType("audio", {
          name,
          type: "audio",
          folderId,
          audio: {
            file: fileName,
            ...(await extractAudioMetadata(bytes, validation.extension)),
          },
        });

  // writeResourceToFile serializes its sidecar write via the per-project
  // meta lock internally, so no outer lock is needed here (and adding one
  // would deadlock, since the lock is non-reentrant).
  await writeResourceToFile(projectPath, resource, { binary: bytes });

  return resource;
}

// ---------------------------------------------------------------------------
// 3. Copy resource
// ---------------------------------------------------------------------------

/**
 * Copies a resource's on-disk content directory (if any) and sidecar under a
 * newly generated id.
 *
 * Lifted verbatim from `POST /api/resource/[resource-id]`'s local
 * `copyResource` helper.
 */
export async function copyResourceCore(
  projectId: string,
  sourceId: string,
  newName: string,
): Promise<Record<string, MetadataValue>> {
  const projectRoot = resolveResourceProjectRootOrThrow(projectId);

  const newId = generateUUID();
  const srcDir = path.join(projectRoot, "resources", sourceId);
  const dstDir = path.join(projectRoot, "resources", newId);

  if (await exists(srcDir)) {
    await cp(srcDir, dstDir, { recursive: true });
  }

  const sourceSidecar = await readSidecar(projectRoot, sourceId);
  const newSidecar = {
    ...(sourceSidecar ?? {}),
    id: newId,
    name: newName,
    createdAt: new Date().toISOString(),
  };

  await writeSidecar(projectRoot, newId, newSidecar);
  return newSidecar;
}

// ---------------------------------------------------------------------------
// 4. Delete resource
// ---------------------------------------------------------------------------

/**
 * Soft-deletes a resource, nullifying any resource-ref fields that pointed
 * at it first.
 *
 * Lifted verbatim from `POST /api/resource/[resource-id]`'s `"delete"`
 * action branch.
 */
export async function deleteResourceCore(
  projectId: string,
  resourceId: string,
): Promise<void> {
  const projectRoot = resolveResourceProjectRootOrThrow(projectId);

  // Read the resource name and resource-ref field keys before deletion.
  const sidecar = await readSidecar(projectRoot, resourceId);
  const deletedName = typeof sidecar?.name === "string" ? sidecar.name : "";

  let resourceRefKeys: string[] = [];
  try {
    const schema = await getSchema(projectRoot);
    resourceRefKeys = schema.groups
      .flatMap((g) => g.fields)
      .filter(
        (f) => f.type === "resource-ref" || f.type === "multi-resource-ref",
      )
      .map((f) => f.key);
  } catch {
    // Schema unreadable — proceed without nullification
  }

  await nullifyResourceRefs(
    projectRoot,
    resourceId,
    deletedName,
    resourceRefKeys,
  );

  await softDeleteResource(projectRoot, resourceId);
}

// ---------------------------------------------------------------------------
// 5. Update sidecar
// ---------------------------------------------------------------------------

/**
 * Merges an incoming sidecar update with the existing sidecar, preserving
 * structural fields (`orderIndex`, `folderId`) that only the reorder route
 * may change.
 *
 * Lifted verbatim from `POST /api/resource/[resource-id]/sidecar`'s
 * `handlePost` body.
 */
export async function updateSidecarCore(
  projectId: string,
  resourceId: string,
  updatedResource: Record<string, unknown>,
): Promise<void> {
  const projectRoot = resolveResourceProjectRootOrThrow(projectId);

  const existing = await readSidecar(projectRoot, resourceId).catch(() => null);

  const merged = {
    ...(existing ?? {}),
    ...updatedResource,
    orderIndex:
      existing?.orderIndex ??
      (updatedResource.orderIndex as number | undefined) ??
      0,
    folderId:
      existing?.folderId ??
      (updatedResource.folderId as string | null | undefined) ??
      null,
  };

  await writeSidecar(
    projectRoot,
    resourceId,
    merged as Record<string, MetadataValue>,
  );
}

// ---------------------------------------------------------------------------
// 6. Rename resource/folder
// ---------------------------------------------------------------------------

/**
 * Renames a folder descriptor by id.
 *
 * Lifted verbatim from `POST /api/resource/[resource-id]/rename`'s
 * `resourceType === "folder"` branch's FS call. Returns `null` when no
 * matching folder exists (the route's 404 case).
 */
export async function renameFolderCore(
  projectId: string,
  resourceId: string,
  newName: string,
): Promise<Record<string, unknown> | null> {
  const projectRoot = resolveResourceProjectRootOrThrow(projectId);
  const foldersDir = path.join(projectRoot, "folders");
  return renameFolderById(foldersDir, resourceId, newName);
}

/**
 * Renames a resource by updating its sidecar's `name` field.
 *
 * Lifted verbatim from `POST /api/resource/[resource-id]/rename`'s default
 * (non-folder) branch. Returns `null` when no matching sidecar exists (the
 * route's 404 case).
 */
export async function renameResourceSidecarCore(
  projectId: string,
  resourceId: string,
  newName: string,
): Promise<Record<string, MetadataValue> | null> {
  const projectRoot = resolveResourceProjectRootOrThrow(projectId);

  const existing = await readSidecar(projectRoot, resourceId);
  if (existing === null) return null;

  const updatedData: Record<string, MetadataValue> = {
    ...existing,
    name: newName,
  };

  await writeSidecar(projectRoot, resourceId, updatedData);
  return updatedData;
}

// ---------------------------------------------------------------------------
// 7. Fetch resource content
// ---------------------------------------------------------------------------

/** Result shape of {@link fetchResourceContentCore}. */
export interface ResourceContentCoreResult {
  resourceContent: {
    tipTapContent: TipTapDocument | null;
    plaintextContent: string | null;
  };
  revisions: Revision[];
}

async function readTextResourceContent(
  projectPath: string,
  resourceId: string,
): Promise<{
  tipTapContent: TipTapDocument | null;
  plaintextContent: string | null;
}> {
  const resourceDir = path.join(projectPath, "resources", resourceId);

  const tiptapPath = path.join(resourceDir, "content.tiptap.json");
  let tipTapContent: TipTapDocument | null = null;
  try {
    tipTapContent = JSON.parse(
      await readFile(tiptapPath, "utf-8"),
    ) as TipTapDocument;
  } catch {
    // no tiptap file
  }

  let plaintextContent: string | null = null;
  const plaintextPath = path.join(resourceDir, "content.txt");
  try {
    plaintextContent = await readFile(plaintextPath, "utf-8");
  } catch {
    // no plaintext file
  }

  return { tipTapContent, plaintextContent };
}

/**
 * Fetches a text resource's content (tiptap + plaintext) plus its revision
 * list.
 *
 * Lifted verbatim from `POST /api/project-resources`'s `handlePost` body
 * (assumes `"text"` like the pre-lift route does — see its comment).
 *
 * @throws {Error} `No valid content found for resource ${resourceId} at path
 *   ${resourceDir}` — matches the pre-lift route's `getProjectResource`
 *   throw, mapped by the route to its existing 404 response.
 */
export async function fetchResourceContentCore(
  projectId: string,
  resourceId: string,
): Promise<ResourceContentCoreResult> {
  const projectPath = resolveResourceProjectRootOrThrow(projectId);

  const revisions = await listRevisions(projectPath, resourceId);
  const resourceContent = await readTextResourceContent(
    projectPath,
    resourceId,
  );

  return { resourceContent, revisions };
}

// ---------------------------------------------------------------------------
// 10. Reorder resources
// ---------------------------------------------------------------------------

/** One folder-order entry, as sent by `reorderResources`'s payload. */
export interface ReorderFolderEntry {
  id: string;
  orderIndex: number;
  folderId?: string | null;
}

/** One resource-order entry, as sent by `reorderResources`'s payload. */
export interface ReorderResourceEntry {
  id: string;
  orderIndex: number;
  folderId?: string | null;
}

/** Input for {@link reorderResourcesCore}. */
export interface ReorderResourcesInput {
  folderOrder: ReorderFolderEntry[];
  resourceOrder: ReorderResourceEntry[];
  /**
   * Legacy override: when supplied, used directly instead of scanning for a
   * `project.json` whose internal `id` matches `projectId`. Mirrors the
   * pre-lift route's `body.projectRoot ?? findProjectRoot(...)` fallback.
   */
  projectRootOverride?: string;
}

/**
 * Thrown by {@link reorderResourcesCore} when no project can be resolved —
 * neither `projectRootOverride` was supplied, nor did any project directory
 * under `resolveProjectsDir()` match `projectId` by internal id.
 */
export class ReorderProjectNotFoundError extends Error {
  constructor() {
    super("project not found");
    this.name = "ReorderProjectNotFoundError";
  }
}

/**
 * Persists a folder/resource reorder for a project.
 *
 * A deliberate divergence from every other operation in this module: this
 * route predates the ADR-017/018 tenant-route migration and still resolves
 * the project via `projectRootOverride ?? findProjectRootByInternalId(...)`
 * (a legacy fallback that scans every project directory and matches on
 * `project.json`'s *internal* `id`, not the directory basename) — preserved
 * exactly, reusing `findProjectRootByInternalId` from `project-crud-core.ts`
 * rather than re-implementing the scan.
 *
 * Lifted verbatim from `POST /api/projects/[projectId]/reorder`'s `reorder`
 * handler body (minus request-JSON parsing, which stays in the route).
 *
 * @throws {ReorderProjectNotFoundError} When no project can be resolved.
 */
export async function reorderResourcesCore(
  projectId: string,
  input: ReorderResourcesInput,
): Promise<void> {
  const { folderOrder, resourceOrder, projectRootOverride } = input;

  const projectsDir = resolveProjectsDir();
  const projectRoot =
    projectRootOverride ??
    (await findProjectRootByInternalId(projectsDir, projectId));
  if (!projectRoot) {
    throw new ReorderProjectNotFoundError();
  }

  // Update folder descriptors (guarded by project-level meta lock)
  try {
    await withMetaLock(projectRoot, async () => {
      const foldersDir = path.join(projectRoot, "folders");
      const folderDirs = await readdir(foldersDir, {
        withFileTypes: true,
      }).catch(() => [] as Dirent[]);

      for (const fo of folderOrder) {
        for (const d of folderDirs) {
          if (!d.isDirectory()) continue;
          const folderJson = path.join(foldersDir, d.name, "folder.json");
          try {
            const parsed = JSON.parse(await readFile(folderJson, "utf8")) as {
              id?: string;
              orderIndex?: number;
              parentId?: string | null;
            };
            if (parsed && parsed.id === fo.id) {
              parsed.orderIndex = fo.orderIndex;
              parsed.parentId = fo.folderId ?? null;
              // write updated folder.json atomically
              await writeFile(
                folderJson,
                JSON.stringify(parsed, null, 2),
                "utf8",
              );
              break;
            }
          } catch (err) {
            // ignore missing files or parse errors for individual folders
            // eslint-disable-next-line no-console
            console.warn(
              "skipping folder.json update",
              folderJson,
              (err as Error).message,
            );
          }
        }
      }
    });
  } catch (err) {
    // log and continue with resources
    // eslint-disable-next-line no-console
    console.error("folder update error", err);
  }

  // Update resource sidecars
  for (const ro of resourceOrder) {
    try {
      const existing = await readSidecar(projectRoot, ro.id).catch(() => null);
      const merged = {
        ...(existing ?? {}),
        orderIndex: ro.orderIndex,
        folderId: ro.folderId ?? existing?.folderId ?? null,
      };
      await writeSidecar(projectRoot, ro.id, merged);
    } catch (err) {
      // log and continue
      // eslint-disable-next-line no-console
      console.error("resource sidecar update failed", ro.id, err);
    }
  }
}
