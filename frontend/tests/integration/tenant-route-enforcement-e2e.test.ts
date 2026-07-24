/**
 * End-to-end proof for Task 10 of the 29-route tenant enforcement feature
 * (`specs/features/route-tenant-enforcement.md`, `.plan.md` Task 10).
 *
 * Exercises the real route handlers directly — the same approach already
 * used by `project-delete-route.test.ts` and `export-text-route.test.ts` —
 * against a real temporary `GETWRITE_PROJECTS_DIR`-scoped filesystem, with
 * `GETWRITE_DATA_ROOT` left unset. Because `GETWRITE_DATA_ROOT` is unset,
 * `resolveTenant()` resolves every request's `dataRoot` to
 * `defaultProjectsDir()`, which itself reads `GETWRITE_PROJECTS_DIR` — this
 * is the default/desktop path the spec's FR5 requires to be byte-for-byte
 * unaffected by the migration.
 *
 * A single scenario walks the full lifecycle a real client now performs
 * using ONLY `projectId` (never `projectRoot`/`projectPath`):
 *   1. Scaffold a project on disk (out of scope for this feature — done the
 *      same way `project-delete-route.test.ts` and `metadata-schema-api.test.ts`
 *      do it: `createProject()` + write `project.json` directly).
 *   2. POST /api/resource — create a text resource.
 *   3. Read the resource back directly off disk and confirm both content and
 *      location match `resolveProjectsDir()/<projectId>/resources/<id>/...`
 *      exactly — the same layout pre-migration code produced.
 *   4. POST /api/resource/[resource-id]/rename — rename it.
 *   5. POST /api/project/tags — create a tag.
 *   6. POST /api/project/metadata-schema — add a field.
 *   7. POST /api/export/text — export the resource's text.
 *
 * Every step must succeed (not a 400 "Invalid projectId" or any other
 * error) to prove these previously-broken operations now work end-to-end
 * under the new `projectId` contract.
 *
 * Runs in the node environment so Request/Response come from undici.
 */
// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProject } from "../../src/lib/models/project";
import { PROJECT_FILENAME } from "../../src/lib/models/project-config";
import { generateUUID } from "../../src/lib/models/uuid";
import type { MetadataSchema } from "../../src/lib/models/types";
import { removeDirRetry } from "../unit/helpers/fs-utils";

const tmpDirs: string[] = [];

// Creating resources through the route handlers starts the fire-and-forget
// indexer/backlinks watcher; removeDirRetry() resets it before deleting so a
// late write can't race the cleanup (ENOTEMPTY) — the same helper the
// resource-route tests use. A raw fs.rm here was the source of a flaky
// ENOTEMPTY on `meta/` in CI.
afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) await removeDirRetry(dir);
  }
});

/** Creates a fresh temporary projects directory (the parent of project-id folders). */
async function makeProjectsDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-tenant-e2e-"));
  tmpDirs.push(dir);
  return dir;
}

/**
 * Runs `fn` with `GETWRITE_PROJECTS_DIR` set to `projectsDir` and
 * `GETWRITE_DATA_ROOT` explicitly unset — the default/desktop path per spec
 * FR5. `defaultProjectsDir()` reads `GETWRITE_PROJECTS_DIR`, and with no
 * identity on these requests, `resolveTenant()` resolves `dataRoot` to
 * exactly that.
 */
async function withDefaultDesktopPath<T>(
  projectsDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  const originalProjectsDir = process.env.GETWRITE_PROJECTS_DIR;
  const originalDataRoot = process.env.GETWRITE_DATA_ROOT;
  process.env.GETWRITE_PROJECTS_DIR = projectsDir;
  delete process.env.GETWRITE_DATA_ROOT;
  try {
    return await fn();
  } finally {
    process.env.GETWRITE_PROJECTS_DIR = originalProjectsDir;
    if (originalDataRoot === undefined) {
      delete process.env.GETWRITE_DATA_ROOT;
    } else {
      process.env.GETWRITE_DATA_ROOT = originalDataRoot;
    }
  }
}

const GROUP_ID = "g1";

function baseSchema(): MetadataSchema {
  return { groups: [{ id: GROUP_ID, label: "Group One", fields: [] }] };
}

async function scaffoldProject(projectsDir: string): Promise<string> {
  const projectId = generateUUID();
  const projectPath = path.join(projectsDir, projectId);
  await fs.mkdir(projectPath, { recursive: true });
  const proj = createProject({ name: "e2e-test" });
  const projWithSchema = {
    ...proj,
    config: { ...proj.config, metadataSchema: baseSchema() },
  };
  await fs.writeFile(
    path.join(projectPath, PROJECT_FILENAME),
    JSON.stringify(projWithSchema, null, 2),
    "utf8",
  );
  return projectId;
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("29-route tenant enforcement — default/desktop-path end-to-end (Task 10)", () => {
  it(
    "creates, reads, renames, tags, schema-edits, and exports a resource " +
      "using only projectId, with the default desktop path unaffected",
    async () => {
      const projectsDir = await makeProjectsDir();

      await withDefaultDesktopPath(projectsDir, async () => {
        const projectId = await scaffoldProject(projectsDir);

        // --- Step 2: POST /api/resource -------------------------------------
        const { POST: createResourcePost } =
          await import("../../app/api/resource/route");
        const createRes = await createResourcePost(
          jsonRequest("http://localhost/api/resource", {
            projectId,
            resourceData: {
              name: "My Note",
              type: "text",
              text: { plainText: "hello from the e2e test" },
            },
          }) as never,
        );
        expect(createRes.status).toBe(200);
        const createJson = (await createRes.json()) as {
          success: boolean;
          resource: { id: string };
        };
        expect(createJson.success).toBe(true);
        const resourceId = createJson.resource.id;
        expect(resourceId).toBeTruthy();

        // --- Step 3: read the resource back directly off disk ---------------
        // The on-disk path must be resolveProjectsDir()/<projectId>/resources/<id>/...
        // — i.e. defaultProjectsDir() since GETWRITE_DATA_ROOT is unset — the
        // exact layout pre-migration code produced for the same logical request.
        const expectedResourceDir = path.join(
          projectsDir,
          projectId,
          "resources",
          resourceId,
        );
        const contentPath = path.join(expectedResourceDir, "content.txt");
        const onDiskContent = await fs.readFile(contentPath, "utf8");
        expect(onDiskContent).toBe("hello from the e2e test");

        // --- Step 4: POST /api/resource/[resource-id]/rename -----------------
        const { POST: renamePost } =
          await import("../../app/api/resource/[resource-id]/rename/route");
        const renameRes = await renamePost(
          jsonRequest(`http://localhost/api/resource/${resourceId}/rename`, {
            projectId,
            newName: "Renamed Note",
          }) as never,
          { params: Promise.resolve({ "resource-id": resourceId }) } as never,
        );
        expect(renameRes.status).toBe(200);
        const renameJson = (await renameRes.json()) as {
          resource: { name: string };
        };
        expect(renameJson.resource.name).toBe("Renamed Note");

        // --- Step 5: POST /api/project/tags (create) --------------------------
        const { POST: tagsPost } =
          await import("../../app/api/project/tags/route");
        const tagRes = await tagsPost(
          jsonRequest("http://localhost/api/project/tags", {
            action: "create",
            projectId,
            name: "important",
          }) as never,
        );
        expect(tagRes.status).toBe(200);
        const tagJson = (await tagRes.json()) as { tag: { name: string } };
        expect(tagJson.tag.name).toBe("important");

        // --- Step 6: POST /api/project/metadata-schema (add-field) -----------
        const { POST: schemaPost } =
          await import("../../app/api/project/metadata-schema/route");
        const schemaRes = await schemaPost(
          jsonRequest("http://localhost/api/project/metadata-schema", {
            action: "add-field",
            projectId,
            groupId: GROUP_ID,
            field: { key: "route-field", label: "Route Field", type: "text" },
          }) as never,
        );
        expect(schemaRes.status).toBe(200);
        const schemaJson = (await schemaRes.json()) as {
          schema: MetadataSchema;
        };
        expect(schemaJson.schema.groups[0].fields.map((f) => f.key)).toContain(
          "route-field",
        );

        // --- Step 7: POST /api/export/text -------------------------------------
        const { POST: exportPost } =
          await import("../../app/api/export/text/route");
        const exportRes = await exportPost(
          jsonRequest("http://localhost/api/export/text", {
            projectId,
            resourceIds: [resourceId],
            resources: [{ id: resourceId, name: "Renamed Note", type: "text" }],
            exportName: "Renamed Note",
          }) as never,
        );
        expect(exportRes.status).toBe(200);
        const exportJson = (await exportRes.json()) as {
          text: string;
          filename: string;
        };
        expect(exportJson.text).toContain("hello from the e2e test");
        expect(exportJson.filename).toBe("renamed-note.txt");
      });
    },
  );

  it("rejects a non-UUID projectId with the uniform 400 across the same routes", async () => {
    const projectsDir = await makeProjectsDir();

    await withDefaultDesktopPath(projectsDir, async () => {
      const badProjectId = "../../etc/passwd";

      const { POST: createResourcePost } =
        await import("../../app/api/resource/route");
      const createRes = await createResourcePost(
        jsonRequest("http://localhost/api/resource", {
          projectId: badProjectId,
          resourceData: { name: "x", type: "text" },
        }) as never,
      );
      expect(createRes.status).toBe(400);
      expect((await createRes.json()).error).toBe("Invalid projectId");

      const { POST: tagsPost } =
        await import("../../app/api/project/tags/route");
      const tagRes = await tagsPost(
        jsonRequest("http://localhost/api/project/tags", {
          action: "create",
          projectId: badProjectId,
          name: "x",
        }) as never,
      );
      expect(tagRes.status).toBe(400);
      expect((await tagRes.json()).error).toBe("Invalid projectId");
    });
  });
});
