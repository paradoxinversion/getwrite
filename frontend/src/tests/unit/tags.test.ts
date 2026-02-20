import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createProject } from "../../../src/lib/models/project";
import {
    createTag,
    listTags,
    assignTagToResource,
    listResourcesByTag,
    deleteTag,
    unassignTagFromResource,
} from "../../../src/lib/models/tags";

async function makeTmpProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-proj-"));
    const proj = createProject({ name: "temp" });
    await fs.writeFile(
        path.join(dir, "project.json"),
        JSON.stringify(proj, null, 2),
        "utf8",
    );
    return { dir, proj };
}

describe("tags (T023)", () => {
    it("creates and lists tags", async () => {
        const { dir } = await makeTmpProject();
        const tag = await createTag(dir, "foo", "#ff0");
        const tags = await listTags(dir);
        expect(tags.find((t) => t.id === tag.id)).toBeDefined();
    });

    it("assigns and lists resources by tag", async () => {
        const { dir } = await makeTmpProject();
        const tag = await createTag(dir, "bar");
        // assign tag to resource 'res-1'
        await assignTagToResource(dir, "res-1", tag.id);
        await assignTagToResource(dir, "res-2", tag.id);
        const res = await listResourcesByTag(dir, tag.id);
        expect(res.sort()).toEqual(["res-1", "res-2"]);
    });

    it("unassigns and deletes tags", async () => {
        const { dir } = await makeTmpProject();
        const tag = await createTag(dir, "baz");
        await assignTagToResource(dir, "res-x", tag.id);
        await unassignTagFromResource(dir, "res-x", tag.id);
        let res = await listResourcesByTag(dir, tag.id);
        expect(res).toEqual([]);

        const deleted = await deleteTag(dir, tag.id);
        expect(deleted).toBe(true);
        const tags = await listTags(dir);
        expect(tags.find((t) => t.id === tag.id)).toBeUndefined();
    });
});
