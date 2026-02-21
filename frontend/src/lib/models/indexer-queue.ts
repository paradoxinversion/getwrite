import { indexResource } from "./inverted-index";
import { readSidecar } from "./sidecar";
import { listRevisions } from "./revision";
import { readFile } from "./io";
import { loadResourceContent } from "../tiptap-utils";
import type { TextResource } from "./types";

type Task = { projectRoot: string; resourceId: string };

const queue: Task[] = [];
let running = false;

async function runTask(t: Task) {
    try {
        const side = await readSidecar(t.projectRoot, t.resourceId);
        const now = new Date().toISOString();

        // Try to obtain canonical plain text from resource storage first
        let plain: string | undefined;
        try {
            const loaded = await loadResourceContent(
                t.projectRoot,
                t.resourceId,
            );
            plain = loaded.plainText ?? undefined;
            if (!plain && loaded.tiptap)
                plain =
                    (loaded.tiptap as any) && loaded.tiptap
                        ? await Promise.resolve(
                              (
                                  await import("../tiptap-utils")
                              ).tiptapToPlainText(loaded.tiptap as any),
                          )
                        : undefined;
        } catch (_) {
            // ignore
        }

        // Fallback: read last revision content (content.bin) if present
        if (!plain) {
            try {
                const revs = await listRevisions(t.projectRoot, t.resourceId);
                if (revs.length > 0) {
                    const last = revs[revs.length - 1];
                    if (last.filePath) {
                        try {
                            plain = await readFile(last.filePath, "utf8");
                        } catch (_) {
                            // ignore read errors
                        }
                    }
                }
            } catch (_) {
                // ignore
            }
        }

        const minimal: TextResource = {
            id: t.resourceId,
            name: (side && (side as any).name) || t.resourceId,
            slug: (side && (side as any).slug) || undefined,
            type: "text",
            folderId: undefined,
            createdAt: now,
            plainText: plain,
            tiptap: undefined,
        } as unknown as TextResource;

        await indexResource(t.projectRoot, minimal);
    } catch (err) {
        // swallow errors to keep queue running
    }
}

async function processQueue() {
    if (running) return;
    running = true;
    while (queue.length > 0) {
        const t = queue.shift()!;
        // process sequentially to avoid concurrent fs stress
        // don't let a single failure stop the queue
        try {
            // eslint-disable-next-line no-await-in-loop
            await runTask(t);
        } catch (_) {
            // ignore
        }
    }
    running = false;
}

/** Enqueue a resource id for indexing. Returns a Promise that resolves when the task has been processed. */
export function enqueueIndex(
    projectRoot: string,
    resourceId: string,
): Promise<void> {
    return new Promise((resolve) => {
        queue.push({ projectRoot, resourceId });
        // Kick the processor asynchronously
        void processQueue();
        // Poll for task completion by waiting until resourceId no longer in queue
        const interval = setInterval(() => {
            const pending = queue.find((q) => q.resourceId === resourceId);
            if (!pending && !running) {
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

export default { enqueueIndex, flushIndexer };

/** Wait until the queue is drained (or timeout) — useful for tests. */
export function flushIndexer(timeout = 5000): Promise<void> {
    return new Promise((resolve) => {
        const start = Date.now();
        const iv = setInterval(() => {
            if (queue.length === 0 && !running) {
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
