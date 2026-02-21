import path from "node:path";
import type { StorageAdapter } from "./io";
import type { Dirent, Stats } from "node:fs";

type Node =
    | { type: "dir"; children: Map<string, Node> }
    | { type: "file"; data: string | Buffer };

function splitPath(p: string) {
    const normalized = path.posix.normalize(p).replace(/^\/+/, "");
    return normalized === "" ? [] : normalized.split("/");
}

export function createMemoryAdapter(): StorageAdapter {
    const root: Node = { type: "dir", children: new Map() };

    function mkdirSync(p: string) {
        const parts = splitPath(p);
        let cur = root;
        for (const part of parts) {
            let child = cur.children.get(part);
            if (!child) {
                child = { type: "dir", children: new Map() };
                cur.children.set(part, child);
            }
            if (child.type !== "dir") throw new Error("ENOTDIR");
            cur = child;
        }
    }

    function resolveParent(p: string) {
        const parts = splitPath(p);
        const name = parts.pop();
        let cur = root;
        for (const part of parts) {
            const child = cur.children.get(part);
            if (!child || child.type !== "dir") return null;
            cur = child;
        }
        return { parent: cur, name } as { parent: Node; name?: string } | null;
    }

    return {
        mkdir: async (p: string, opts?: { recursive?: boolean }) => {
            mkdirSync(p);
        },
        writeFile: async (p: string, data: string | Buffer) => {
            const res = resolveParent(p);
            if (!res || !res.name) throw new Error("ENOENT");
            const { parent, name } = res;
            if (parent.type !== "dir") throw new Error("ENOTDIR");
            parent.children.set(name!, { type: "file", data });
        },
        readFile: async (p: string) => {
            const parts = splitPath(p);
            let cur: Node = root;
            for (const part of parts) {
                const child =
                    cur.type === "dir" ? cur.children.get(part) : undefined;
                if (!child)
                    throw Object.assign(new Error("ENOENT"), {
                        code: "ENOENT",
                    });
                cur = child;
            }
            if (cur.type !== "file")
                throw Object.assign(new Error("EISDIR"), { code: "EISDIR" });
            return cur.data.toString();
        },
        readdir: async (p: string, opts?: { withFileTypes?: boolean }) => {
            const parts = splitPath(p);
            let cur: Node = root;
            for (const part of parts) {
                const child =
                    cur.type === "dir" ? cur.children.get(part) : undefined;
                if (!child)
                    throw Object.assign(new Error("ENOENT"), {
                        code: "ENOENT",
                    });
                cur = child;
            }
            if (cur.type !== "dir")
                throw Object.assign(new Error("ENOTDIR"), { code: "ENOTDIR" });
            const entries: Dirent[] = [] as unknown as Dirent[];
            for (const [name, node] of cur.children.entries()) {
                // Minimal Dirent-like object used by tests and adapters
                entries.push({
                    name,
                    isDirectory: () => node.type === "dir",
                } as unknown as Dirent);
            }
            return entries;
        },
        stat: async (p: string) => {
            const parts = splitPath(p);
            let cur: Node = root;
            if (parts.length === 0) return { isDirectory: () => true } as any;
            for (const part of parts) {
                const child =
                    cur.type === "dir" ? cur.children.get(part) : undefined;
                if (!child)
                    throw Object.assign(new Error("ENOENT"), {
                        code: "ENOENT",
                    });
                cur = child;
            }
            return {
                isDirectory: () => cur.type === "dir",
            } as unknown as Stats;
        },
        rm: async (
            p: string,
            opts?: { recursive?: boolean; force?: boolean },
        ) => {
            const res = resolveParent(p);
            if (!res || !res.name) return;
            const { parent, name } = res;
            if (parent.type !== "dir") return;
            parent.children.delete(name!);
        },
        rename: async (oldPath: string, newPath: string) => {
            const oldRes = resolveParent(oldPath);
            const newRes = resolveParent(newPath);
            if (!oldRes || !oldRes.name || !newRes || !newRes.name)
                throw new Error("ENOENT");
            const { parent: oldParent, name: oldName } = oldRes;
            const node =
                oldParent.type === "dir"
                    ? oldParent.children.get(oldName!)
                    : undefined;
            if (!node)
                throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
            // Ensure new parent dirs exist
            mkdirSync(path.posix.dirname(newPath));
            const { parent: newParent, name: newName } = newRes;
            newParent.children.set(newName!, node);
            oldParent.children.delete(oldName!);
        },
    };
}

export default { createMemoryAdapter };
