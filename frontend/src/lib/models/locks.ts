// Lightweight per-key async mutex.
// Usage: const release = await acquireLock(key); try { ... } finally { release(); }
const queues = new Map<string, Array<() => void>>();

export async function acquireLock(key: string): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
        const q = queues.get(key);
        if (!q) {
            // No queue -> create and grant lock immediately
            queues.set(key, []);
            let released = false;
            resolve(() => {
                if (released) return;
                released = true;
                const cur = queues.get(key);
                if (cur && cur.length > 0) {
                    const next = cur.shift();
                    if (next) next();
                } else {
                    queues.delete(key);
                }
            });
        } else {
            // Enqueue resolver to be called when previous releases
            q.push(() => {
                let released = false;
                resolve(() => {
                    if (released) return;
                    released = true;
                    const cur = queues.get(key);
                    if (cur && cur.length > 0) {
                        const next = cur.shift();
                        if (next) next();
                    } else {
                        queues.delete(key);
                    }
                });
            });
        }
    });
}

export default { acquireLock };
