const locks: Map<string, Promise<void>> = new Map();

export async function withMetaLock<T>(
    projectRoot: string,
    fn: () => Promise<T>,
): Promise<T> {
    const key = projectRoot || "global";
    const prev = locks.get(key) ?? Promise.resolve();

    // Chain the new operation after previous
    const next = prev.then(() => fn());

    // Ensure we remove the lock entry when done
    locks.set(
        key,
        next.then(() => undefined).catch(() => undefined),
    );

    try {
        return await next;
    } finally {
        // If the stored promise is the one we created, delete it
        const stored = locks.get(key);
        if (stored && stored === (next as unknown as Promise<void>)) {
            locks.delete(key);
        }
    }
}

export default { withMetaLock };
