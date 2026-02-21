import fs from "node:fs/promises";
import type { Dirent, Stats } from "node:fs";

export type ReaddirResult = string[] | Dirent[];

export type StorageAdapter = {
    mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
    writeFile(
        path: string,
        data: string | Buffer,
        opts?: string | object,
    ): Promise<void>;
    readFile(path: string, encoding?: string): Promise<string>;
    readdir(
        path: string,
        opts?: { withFileTypes?: boolean } | undefined,
    ): Promise<ReaddirResult>;
    stat(path: string): Promise<Stats>;
    rm(
        path: string,
        opts?: { recursive?: boolean; force?: boolean } | undefined,
    ): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
};

let adapter: StorageAdapter = {
    mkdir: (p, o) => fs.mkdir(p, o),
    writeFile: (p, d, o) => fs.writeFile(p, d, o as any),
    readFile: (p, e) => fs.readFile(p, e) as Promise<string>,
    readdir: (p, o) => fs.readdir(p, o as any) as Promise<ReaddirResult>,
    stat: (p) => fs.stat(p) as Promise<Stats>,
    rm: (p, o) => fs.rm(p, o as any),
    rename: (a, b) => fs.rename(a, b),
};

export function setStorageAdapter(a: StorageAdapter) {
    adapter = a;
}

export function getStorageAdapter(): StorageAdapter {
    return adapter;
}

export const mkdir = (p: string, o?: { recursive?: boolean }) =>
    adapter.mkdir(p, o);
export const writeFile = (p: string, d: string | Buffer, o?: string | object) =>
    adapter.writeFile(p, d, o);
export const readFile = (p: string, e?: string) => adapter.readFile(p, e);
export const readdir = (p: string, o?: { withFileTypes?: boolean }) =>
    adapter.readdir(p, o);
export const stat = (p: string) => adapter.stat(p);
export const rm = (p: string, o?: { recursive?: boolean; force?: boolean }) =>
    adapter.rm(p, o);
export const rename = (a: string, b: string) => adapter.rename(a, b);

export default { setStorageAdapter, getStorageAdapter };
