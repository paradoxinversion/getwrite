import fs from "node:fs/promises";

export async function removeDirRetry(
    dir: string,
    attempts = 5,
    delayMs = 50,
): Promise<void> {
    for (let i = 0; i < attempts; i++) {
        try {
            await fs.rm(dir, { recursive: true, force: true });
            return;
        } catch (err: any) {
            if (i === attempts - 1) throw err;
            // small backoff
            await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        }
    }
}

export default { removeDirRetry };
