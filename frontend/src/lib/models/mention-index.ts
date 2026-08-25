import path from "node:path";
import { atomicWriteFile, mkdir, readFile } from "./io";
import { withMetaLock } from "./meta-locks";

const INDEX_DIR = "meta/index";
const INDEX_FILE = "mentions.json";

/**
 * A single entity's detected mentions within one resource.
 *
 * `offsets` carries the verbatim character offset of each occurrence in the
 * resource's persisted plain text, so a caller can render a snippet by
 * slicing text directly rather than re-tokenizing (FR-6). `count` MUST equal
 * `offsets.length`.
 */
export type MentionRecord = {
  entityId: string;
  resourceId: string;
  count: number;
  offsets: number[];
};

/**
 * The mention index, keyed by `resourceId` so a resource's own mentions are
 * a direct lookup (FR-9). One resource can mention multiple entities, so
 * each value is an array of records.
 */
export type MentionIndex = Record<string, MentionRecord[]>;

async function ensureIndexDir(projectRoot: string): Promise<void> {
  await mkdir(path.join(projectRoot, INDEX_DIR), { recursive: true });
}

/** Load persisted mention index if present; returns an empty index if missing or unreadable. */
export async function loadMentionIndex(
  projectRoot: string,
): Promise<MentionIndex> {
  const p = path.join(projectRoot, INDEX_DIR, INDEX_FILE);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as MentionIndex;
  } catch {
    return {};
  }
}

/** Persist the mention index under `meta/index/mentions.json`. */
export async function persistMentionIndex(
  projectRoot: string,
  index: MentionIndex,
): Promise<void> {
  await ensureIndexDir(projectRoot);
  const p = path.join(projectRoot, INDEX_DIR, INDEX_FILE);
  await withMetaLock(projectRoot, async () => {
    await atomicWriteFile(p, JSON.stringify(index, null, 2), {
      writeOptions: "utf8",
      durable: process.env.GETWRITE_DURABLE_META === "1",
    });
  });
}

/**
 * Invert a resource-keyed `MentionIndex` into an entity-keyed map, so all
 * mentions of a given entity across every resource can be looked up directly
 * (supports FR-10/FR-11).
 */
export function invertMentionIndex(
  index: MentionIndex,
): Record<string, MentionRecord[]> {
  const byEntity: Record<string, MentionRecord[]> = {};
  for (const records of Object.values(index)) {
    for (const record of records) {
      const bucket = byEntity[record.entityId] ?? [];
      bucket.push(record);
      byEntity[record.entityId] = bucket;
    }
  }
  return byEntity;
}

const mentionIndex = {
  loadMentionIndex,
  persistMentionIndex,
  invertMentionIndex,
};
export default mentionIndex;
