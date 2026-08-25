import { indexResource } from "./inverted-index";
import { readSidecar } from "./sidecar";
import { listRevisions } from "./revision";
import {
  getStorageAdapter,
  runForTenant,
  readFile,
  type StorageAdapter,
} from "./io";
import { loadResourceContent, tiptapToPlainText } from "../tiptap-utils";
import { startBacklinkWatcher } from "./backlinks-watcher";
import {
  computeBacklinks,
  persistBacklinks,
  listResourceIds,
} from "./backlinks";
import {
  buildEntityAliasTable,
  type EntityAliasEntry,
} from "./entity-alias-table";
import { findMentionOffsets } from "./entity-detection";
import {
  loadMentionIndex,
  persistMentionIndex,
  type MentionRecord,
} from "./mention-index";
import type { TextResource } from "./types";

type Task = {
  projectRoot: string;
  resourceId: string;
  adapter: StorageAdapter;
};

const queue: Task[] = [];
let isRunning = false;
let isStopped = false;
const activeBacklinkWatchers = new Map<string, () => void>();
let isShutdownHooksInstalled = false;
// Entity rescans (Task 6) run outside the FIFO `queue` above, so
// `flushIndexer`/`waitForDrain` must track them separately to still be a
// reliable "everything settled" signal for callers (including tests) that
// await a sidecar write's background work.
let pendingEntityRescans = 0;

/**
 * Ensures a backlink watcher is running for the project. The watcher
 * debounces file-change events and persists meta/backlinks.json. Started
 * lazily on first enqueueIndex so the runtime backlink index is kept in
 * sync without callers having to manage watcher lifecycle.
 */
function ensureBacklinkWatcher(
  projectRoot: string,
  adapter: StorageAdapter,
): void {
  // The recursive fs.watch backlinks watcher provides no value under the unit
  // test runner, and because indexing is enqueued via a deferred dynamic import
  // it can start a watcher on a temp project dir *after* a test has begun
  // tearing it down. On Linux, Node's internal recursive-watch walk then throws
  // an uncaught ENOENT that fails the whole run. Skip the watcher under test;
  // backlinks tests exercise computeBacklinks/persistBacklinks directly.
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  if (activeBacklinkWatchers.has(projectRoot)) return;
  try {
    const stop = startBacklinkWatcher(projectRoot, {}, adapter);
    activeBacklinkWatchers.set(projectRoot, stop);
  } catch {
    // Watcher could not start (e.g. resources dir missing on cold start) —
    // leave the slot empty so a later enqueue can retry.
  }
}

/**
 * Installs SIGTERM/SIGINT/beforeExit handlers that drain the indexer queue
 * before the process exits. Idempotent; safe to call from any enqueue path.
 * The hooks call {@link shutdownIndexer} and then `process.exit(0)` so the
 * Next.js server can gracefully wind down when Electron's `before-quit`
 * sends a termination signal to the spawned child.
 */
export function installShutdownHooks(): void {
  if (isShutdownHooksInstalled) return;
  isShutdownHooksInstalled = true;
  const handle = (signal: NodeJS.Signals | "beforeExit") => () => {
    void shutdownIndexer().finally(() => {
      if (signal !== "beforeExit") process.exit(0);
    });
  };
  process.on("SIGTERM", handle("SIGTERM"));
  process.on("SIGINT", handle("SIGINT"));
  process.on("beforeExit", handle("beforeExit"));
}

/**
 * Loads a resource's persisted plain text, preferring canonical content
 * storage and falling back to the last revision snapshot if that is
 * unavailable. Shared by the whole-resource indexing task ({@link runTask},
 * Task 5) and the targeted single-entity rescan ({@link rescanEntityAcrossProject},
 * Task 6) so both scan the same "already on disk" text — never unsaved
 * editor state.
 */
async function loadPersistedPlainText(
  projectRoot: string,
  resourceId: string,
): Promise<string | undefined> {
  // Try to obtain canonical plain text from resource storage first
  let plain: string | undefined;
  try {
    const loaded = await loadResourceContent(projectRoot, resourceId);
    // `||` (not `??`): empty plainText must fall through to tiptap-derived text,
    // matching the original `if (!plain && loaded.tiptap)` falsy guard.
    plain =
      loaded.plainText ||
      (loaded.tiptap ? tiptapToPlainText(loaded.tiptap) : undefined);
  } catch {
    // ignore
  }

  // Fallback: read last revision content (content.bin) if present
  if (!plain) {
    try {
      const revs = await listRevisions(projectRoot, resourceId);
      const last = revs[revs.length - 1];
      if (last?.filePath) {
        try {
          plain = await readFile(last.filePath, "utf8");
        } catch {
          // ignore read errors
        }
      }
    } catch {
      // ignore
    }
  }

  return plain;
}

/**
 * Scans one entity's current terms (its `name` plus every `alias`) against
 * one resource's already-persisted plain text and builds the `MentionRecord`
 * for that (entity, resource) pair, or `undefined` if none of the entity's
 * terms occur in the text. Shared by the whole-resource scan
 * ({@link runTask}, Task 5 — which loops every entity against one resource)
 * and the whole-project, single-entity rescan
 * ({@link rescanEntityAcrossProject}, Task 6 — which loops every resource
 * against one entity) so the matching/aggregation rule lives in exactly one
 * place.
 */
function buildMentionRecordForEntity(
  entity: EntityAliasEntry,
  resourceId: string,
  plain: string | undefined,
): MentionRecord | undefined {
  // Aggregate offsets across every term (name + aliases) belonging to this
  // entity into a single record for this resource. Two terms of the same
  // entity matching at the exact same offset is a rare edge case (e.g. an
  // alias that is a substring-equal variant of the name); we intentionally
  // do not dedup by offset here — `count` reflects the number of
  // term-matches, not the number of distinct text spans, mirroring
  // `findMentionOffsets` returning one offset per match regardless of
  // overlap with matches from a different term.
  const offsets: number[] = [];
  for (const term of entity.terms) {
    offsets.push(...findMentionOffsets(plain ?? "", term));
  }
  if (offsets.length === 0) return undefined;
  offsets.sort((a, b) => a - b);
  return {
    entityId: entity.entityId,
    resourceId,
    count: offsets.length,
    offsets,
  };
}

async function runTask(task: Task) {
  try {
    await runForTenant(
      task.projectRoot,
      async () => {
        const side = await readSidecar(task.projectRoot, task.resourceId);
        const now = new Date().toISOString();

        const plain = await loadPersistedPlainText(
          task.projectRoot,
          task.resourceId,
        );

        const minimal: TextResource = {
          id: task.resourceId,
          name: (side?.["name"] as string | undefined) ?? task.resourceId,
          slug: side?.["slug"] as string | undefined,
          type: "text",
          folderId: undefined,
          createdAt: now,
          plainText: plain,
          tiptap: undefined,
        } as unknown as TextResource;

        await indexResource(task.projectRoot, minimal);

        try {
          const backlinks = await computeBacklinks(task.projectRoot);
          await persistBacklinks(task.projectRoot, backlinks);
        } catch (err) {
          console.error("[indexer-queue] backlinks update failed:", err);
        }

        try {
          const aliasTable = await buildEntityAliasTable(task.projectRoot);
          const records: MentionRecord[] = [];

          for (const entity of Object.values(aliasTable.entities)) {
            const record = buildMentionRecordForEntity(
              entity,
              task.resourceId,
              plain,
            );
            if (record) records.push(record);
          }

          const mentionIndex = await loadMentionIndex(task.projectRoot);
          if (records.length > 0) {
            mentionIndex[task.resourceId] = records;
          } else {
            delete mentionIndex[task.resourceId];
          }
          await persistMentionIndex(task.projectRoot, mentionIndex);
        } catch (err) {
          console.error("[indexer-queue] mention detection failed:", err);
        }
      },
      task.adapter,
    );
  } catch (err) {
    console.error("[indexer-queue] task failed:", err);
  }
}

async function processQueue() {
  if (isRunning) return;
  isRunning = true;
  while (queue.length > 0) {
    const task = queue.shift()!;
    // process sequentially to avoid concurrent fs stress
    // don't let a single failure stop the queue
    try {
      await runTask(task); // sequential: avoids concurrent fs stress
    } catch (err) {
      console.error("[indexer-queue] processQueue error:", err);
    }
  }
  isRunning = false;
}

/** Enqueue a resource id for indexing. Returns a Promise that resolves when the task has been processed. */
export function enqueueIndex(
  projectRoot: string,
  resourceId: string,
): Promise<void> {
  if (isStopped) {
    // After shutdown, accept no new work. Resolve immediately so callers
    // (e.g. background save handlers) don't hang the request.
    return Promise.resolve();
  }
  installShutdownHooks();
  // Capture the adapter active at enqueue time (the request's scope, once
  // per-tenant adapters exist) so the deferred queue drain and the debounced
  // backlink watcher use it rather than the module fallback active later.
  const adapter = getStorageAdapter();
  ensureBacklinkWatcher(projectRoot, adapter);
  return new Promise((resolve) => {
    queue.push({ projectRoot, resourceId, adapter });
    // Kick the processor asynchronously
    void processQueue();
    // Poll for task completion by waiting until resourceId no longer in queue
    const interval = setInterval(() => {
      const pending = queue.find((q) => q.resourceId === resourceId);
      if (!pending && !isRunning) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
    // Also resolve after a reasonable timeout to avoid hanging tests
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 5000);
  });
}

/**
 * Rescans every resource in the project for mentions of exactly one entity's
 * *current* terms (name + aliases from its live sidecar), and updates only
 * that entity's `MentionRecord` within each resource's mention-index entry —
 * every other entity's records for that same resource, and every other
 * resource's entries, are left byte-for-byte untouched.
 *
 * Reads the mention index once and every resource's persisted text once,
 * applies all per-resource updates for this entity in memory, then persists
 * a single time — avoiding the load/persist thrashing a per-resource
 * read-modify-write loop would cause (Task 6 done_when).
 *
 * If the entity no longer exists in the alias table (its sidecar's
 * `entityKind` was cleared, or the sidecar itself is gone), `entity` is
 * `undefined` here and every resource's rescan simply drops that entity's
 * stale record, if any — this is how a resource losing `entityKind` gets its
 * mentions removed from the index.
 */
async function rescanEntityAcrossProject(
  projectRoot: string,
  entityId: string,
): Promise<void> {
  const aliasTable = await buildEntityAliasTable(projectRoot);
  const entity = aliasTable.entities[entityId];

  const resourceIds = await listResourceIds(projectRoot);
  const mentionIndex = await loadMentionIndex(projectRoot);

  for (const resourceId of resourceIds) {
    const plain = await loadPersistedPlainText(projectRoot, resourceId);
    const newRecord = entity
      ? buildMentionRecordForEntity(entity, resourceId, plain)
      : undefined;

    const existing = mentionIndex[resourceId] ?? [];
    const withoutThisEntity = existing.filter(
      (record) => record.entityId !== entityId,
    );
    const updated = newRecord
      ? [...withoutThisEntity, newRecord]
      : withoutThisEntity;

    if (updated.length > 0) {
      mentionIndex[resourceId] = updated;
    } else {
      delete mentionIndex[resourceId];
    }
  }

  await persistMentionIndex(projectRoot, mentionIndex);
}

/**
 * Triggers a targeted rescan of one entity's mentions across every resource
 * in the project (Task 6 / FR-8). Called when an entity's `name`, `aliases`,
 * or `entityKind` changes on sidecar write — see `sidecar.ts`'s
 * `writeSidecar` for the exact old-vs-new comparison that decides when this
 * runs.
 *
 * Unlike {@link enqueueIndex}, this does not go through the FIFO
 * resource-indexing queue: it is a project-wide, single-entity operation
 * triggered by an entity's own metadata changing, not by a resource's
 * content being saved. Returns a Promise that resolves once the rescan
 * completes; failures are logged, not thrown, matching `runTask`'s error
 * handling so a rescan failure can never surface as an unhandled rejection
 * from a fire-and-forget sidecar write.
 */
export async function enqueueEntityRescan(
  projectRoot: string,
  entityId: string,
): Promise<void> {
  if (isStopped) return;
  const adapter = getStorageAdapter();
  pendingEntityRescans += 1;
  try {
    await runForTenant(
      projectRoot,
      () => rescanEntityAcrossProject(projectRoot, entityId),
      adapter,
    );
  } catch (err) {
    console.error("[indexer-queue] entity rescan failed:", err);
  } finally {
    pendingEntityRescans -= 1;
  }
}

/** Wait until the queue is drained (or timeout) — useful for tests and graceful shutdown. */
export function flushIndexer(timeout = 5000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (queue.length === 0 && !isRunning && pendingEntityRescans === 0) {
        clearInterval(iv);
        resolve();
        return;
      }
      if (Date.now() - start > timeout) {
        clearInterval(iv);
        resolve();
      }
    }, 25);
  });
}

/** Alias for {@link flushIndexer} — standard drain API. */
export const waitForDrain = flushIndexer;

/**
 * Gracefully shuts down the indexer queue. Stops accepting new tasks,
 * waits for any in-flight or queued tasks to finish (up to `timeoutMs`),
 * and stops all backlinks watchers started by this module.
 *
 * Calling more than once is safe — additional calls await the original
 * drain without re-stopping watchers.
 */
export async function shutdownIndexer(timeoutMs = 5000): Promise<void> {
  isStopped = true;
  try {
    await flushIndexer(timeoutMs);
  } finally {
    for (const stop of activeBacklinkWatchers.values()) {
      try {
        stop();
      } catch {
        // ignore individual watcher errors during shutdown
      }
    }
    activeBacklinkWatchers.clear();
  }
}

/**
 * Test-only helper that resets the stopped flag so a fresh enqueue path can
 * be exercised after a `shutdownIndexer` call. Not exported via default.
 */
export function __resetIndexerForTests(): void {
  isStopped = false;
  queue.length = 0;
  isRunning = false;
  for (const stop of activeBacklinkWatchers.values()) {
    try {
      stop();
    } catch {
      // ignore
    }
  }
  activeBacklinkWatchers.clear();
}

const indexerQueue = {
  enqueueIndex,
  enqueueEntityRescan,
  flushIndexer,
  waitForDrain,
  shutdownIndexer,
  installShutdownHooks,
};
export default indexerQueue;
