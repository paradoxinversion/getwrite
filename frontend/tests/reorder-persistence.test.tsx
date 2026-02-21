import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AppShell from "../components/Layout/AppShell";
import { createProjectFromType } from "../src/lib/models/project-creator";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildProjectView } from "../src/lib/models/project-view";
import { readSidecar, writeSidecar } from "../src/lib/models/sidecar";

describe("Reorder persistence integration", () => {
    it("persists folder.json and resource sidecar orderIndex after drag/drop", async () => {
        // create temp project on disk using scaffolder
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "getwrite-test-"));
        const specPath = path.resolve(
            process.cwd(),
            "../specs/002-define-data-models/project-types/novel_project_type.json",
        );

        const created = await createProjectFromType({
            projectRoot: tmp,
            spec: specPath,
            name: "Reorder Persistence Project",
        });

        const view = buildProjectView({
            project: created.project,
            folders: created.folders,
            resources: created.resources,
        });

        const projectForUI = {
            ...created.project,
            folders: created.folders,
            resources: view.resources,
        } as any;

        // stub global fetch so AppShell's persistence call writes into our tmp project
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn(async (url: string, opts?: any) => {
            // parse body
            const body = opts && opts.body ? JSON.parse(opts.body) : {};
            const folderOrder = body.folderOrder ?? [];
            const resourceOrder = body.resourceOrder ?? [];

            // update folder.json files
            const foldersDir = path.join(tmp, "folders");
            const folderDirs = await fs
                .readdir(foldersDir, { withFileTypes: true })
                .catch(() => [] as any[]);
            for (const fo of folderOrder) {
                for (const d of folderDirs) {
                    if (!d.isDirectory()) continue;
                    const folderJson = path.join(
                        foldersDir,
                        d.name,
                        "folder.json",
                    );
                    try {
                        const raw = await fs.readFile(folderJson, "utf8");
                        const parsed = JSON.parse(raw) as any;
                        if (parsed && parsed.id === fo.id) {
                            parsed.orderIndex = fo.orderIndex;
                            await fs.writeFile(
                                folderJson,
                                JSON.stringify(parsed, null, 2),
                                "utf8",
                            );
                            break;
                        }
                    } catch (_) {
                        // ignore
                    }
                }
            }

            // update resource sidecars by merging existing meta
            for (const ro of resourceOrder) {
                try {
                    const existing = await readSidecar(tmp, ro.id).catch(
                        () => null,
                    );
                    const merged = {
                        ...(existing ?? {}),
                        orderIndex: ro.orderIndex,
                    };
                    await writeSidecar(tmp, ro.id, merged);
                } catch (_e) {
                    // ignore
                }
            }

            return { ok: true, status: 200 } as any;
        });

        // render AppShell with project to ensure AppShell persists reorders
        render(
            <AppShell
                showSidebars={true}
                project={projectForUI}
                resources={projectForUI.resources}
            />,
        );

        // Expand the first folder if present and locate treeitems
        const tree = await screen.findByLabelText("Resource tree");
        const treeItems = Array.from(
            tree.querySelectorAll('[role="treeitem"]'),
        ) as HTMLElement[];
        expect(treeItems.length).toBeGreaterThanOrEqual(2);

        // perform drag: move first item after the second
        const source = treeItems[0];
        const target = treeItems[1];

        const dataTransfer = {
            data: {} as Record<string, string>,
            setData(key: string, value: string) {
                this.data[key] = value;
            },
            getData(key: string) {
                return this.data[key];
            },
        };

        fireEvent.dragStart(source, { dataTransfer });
        fireEvent.dragOver(target, { dataTransfer });
        fireEvent.drop(target, { dataTransfer });

        // allow async persistence stub to complete
        await new Promise((r) => setTimeout(r, 50));

        // verify that at least one resource sidecar was updated with orderIndex
        const sampleRes = created.resources[0];
        const sidecar = await readSidecar(tmp, sampleRes.id);
        expect(sidecar).not.toBeNull();
        expect(typeof sidecar?.orderIndex === "number").toBeTruthy();

        // verify folder descriptors contain orderIndex fields
        for (const f of created.folders) {
            const folderJsonPath = path.join(
                tmp,
                "folders",
                f.slug,
                "folder.json",
            );
            const raw = await fs.readFile(folderJsonPath, "utf8");
            const parsed = JSON.parse(raw) as any;
            expect(typeof parsed.orderIndex).toBe("number");
        }

        // restore fetch
        globalThis.fetch = originalFetch;
    });
});
