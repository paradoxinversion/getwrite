import { mkdir, readFile, writeFile } from "./io";
import path from "node:path";
import type { UUID, MetadataValue } from "./types";
import { withMetaLock } from "./meta-locks";
import { PROJECT_FILENAME } from "./project-config";

/**
 * Compute the canonical sidecar filename for a resource id.
 * Example: resource-<uuid>.meta.json
 */
export function sidecarFilename(resourceId: UUID): string {
  return `resource-${resourceId}.meta.json`;
}

/**
 * Compute the sidecar file path inside a project folder.
 * The default location is `<projectRoot>/meta/<sidecarFilename>`.
 */
export function sidecarPathForProject(
  projectRoot: string,
  resourceId: UUID,
): string {
  return path.join(projectRoot, "meta", sidecarFilename(resourceId));
}

async function bumpMetadataRevision(projectRoot: string): Promise<void> {
  const projectPath = path.join(projectRoot, PROJECT_FILENAME);
  try {
    const raw = await readFile(projectPath, "utf8");
    const project = JSON.parse(raw) as {
      config?: { metadataRevision?: number; [key: string]: unknown };
      [key: string]: unknown;
    };
    if (!project.config) project.config = {};
    project.config.metadataRevision =
      (project.config.metadataRevision ?? 0) + 1;
    await writeFile(projectPath, JSON.stringify(project, null, 2), "utf8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}

/**
 * Read sidecar metadata for a resource from a project root. Returns `null`
 * if the file does not exist.
 *
 * Throws on filesystem or JSON parse errors so callers can handle them.
 */
export async function readSidecar(
  projectRoot: string,
  resourceId: UUID,
): Promise<Record<string, MetadataValue> | null> {
  const filePath = sidecarPathForProject(projectRoot, resourceId);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as Record<string, MetadataValue>;
  } catch (err: unknown) {
    // If the file doesn't exist, return null. Otherwise rethrow.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn("sidecar not found for", resourceId, "at", filePath);
      return null;
    }
    throw err;
  }
}

function isEntitySidecar(
  sidecar: Record<string, MetadataValue> | null,
): boolean {
  const kind = sidecar?.["entityKind"];
  return typeof kind === "string" && kind.length > 0;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function aliasesEqual(a: unknown, b: unknown): boolean {
  const arrA = toStringArray(a);
  const arrB = toStringArray(b);
  if (arrA.length !== arrB.length) return false;
  return arrA.every((v, i) => v === arrB[i]);
}

/**
 * Decides whether a sidecar write could change what the project's mention
 * index (`meta/index/mentions.json`) reflects for this resource's entity
 * identity — i.e. whether {@link enqueueEntityRescan} (Task 6 / FR-8) should
 * run in addition to the normal per-resource {@link enqueueIndex}.
 *
 * A rescan is needed whenever:
 *  - the resource is becoming an entity for the first time (`entityKind`
 *    absent/empty before, set now) — its terms are new to the alias table
 *    and every resource needs scanning against them;
 *  - the resource was an entity and is losing `entityKind` on this write —
 *    its stale mention records must be removed from the index; or
 *  - the resource was and remains an entity, but its `name` or `aliases`
 *    changed — the set of terms other resources should be matched against
 *    has changed.
 *
 * A resource that neither was nor is an entity, or that stays an entity
 * with unchanged name/aliases, does not need a rescan: the normal
 * `enqueueIndex` pass already re-scans this resource's own content against
 * the (in that case, unchanged) alias table.
 */
function needsEntityRescan(
  previous: Record<string, MetadataValue> | null,
  next: Record<string, MetadataValue>,
): boolean {
  const isPreviouslyEntity = isEntitySidecar(previous);
  const isNowEntity = isEntitySidecar(next);

  if (!isPreviouslyEntity && !isNowEntity) return false;
  if (isPreviouslyEntity !== isNowEntity) return true;

  const isNameChanged = (previous?.["name"] ?? "") !== (next["name"] ?? "");
  const isAliasesChanged = !aliasesEqual(
    previous?.["aliases"],
    next["aliases"],
  );
  return isNameChanged || isAliasesChanged;
}

/**
 * Write sidecar metadata for a resource into the project's `meta/` folder.
 * Creates directories as needed. Overwrites existing sidecars.
 */
export async function writeSidecar(
  projectRoot: string,
  resourceId: UUID,
  metadata: Record<string, MetadataValue>,
): Promise<void> {
  const dir = path.join(projectRoot, "meta");
  const filePath = sidecarPathForProject(projectRoot, resourceId);

  // Read the pre-write sidecar (if any) so we can detect an entity's
  // name/aliases/entityKind changing across this write, below. A failure
  // reading it (as opposed to it simply not existing, which readSidecar
  // already reports as `null`) must not block the write itself.
  let previous: Record<string, MetadataValue> | null = null;
  try {
    previous = await readSidecar(projectRoot, resourceId);
  } catch {
    previous = null;
  }

  const json = JSON.stringify(metadata, null, 2);
  await withMetaLock(projectRoot, async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, json, "utf8");
    await bumpMetadataRevision(projectRoot);
  });

  const shouldRescanEntity = needsEntityRescan(previous, metadata);

  // Enqueue background indexing after sidecar update. Use dynamic import
  // to avoid circular static imports between sidecar and the indexer queue.
  setImmediate(() => {
    import("./indexer-queue")
      .then((m) => {
        const tasks: Promise<void>[] = [
          m.enqueueIndex(projectRoot, resourceId),
        ];
        if (shouldRescanEntity) {
          // `resourceId` doubles as the entity id — an entity IS a resource
          // with `entityKind` set (see `entity-alias-table.ts`).
          tasks.push(m.enqueueEntityRescan(projectRoot, resourceId));
        }
        return Promise.all(tasks);
      })
      .catch(() => {
        /* ignore enqueue errors */
      });
  });
}

export default {
  sidecarFilename,
  sidecarPathForProject,
  readSidecar,
  writeSidecar,
};
