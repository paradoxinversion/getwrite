import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  verifyProjectManifest,
  verifyResourceContent,
  verifyResourceSidecar,
  verifyRevision,
} from "../../src/qa/verify";

const tmpDirs: string[] = [];

async function mkWorkspace(): Promise<string> {
  const tmp = await fs.mkdtemp(
    path.join(os.tmpdir(), "getwrite-cli-qa-verify-"),
  );
  tmpDirs.push(tmp);
  return tmp;
}

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

describe("verifyProjectManifest", () => {
  it("passes when project.json is present and matches expectations", async () => {
    const root = await mkWorkspace();
    const projectId = "11111111-1111-4111-8111-111111111111";
    await fs.mkdir(path.join(root, projectId), { recursive: true });
    await fs.writeFile(
      path.join(root, projectId, "project.json"),
      JSON.stringify({ id: projectId, name: "My Novel", projectType: "novel" }),
      "utf8",
    );

    const result = await verifyProjectManifest(root, projectId, {
      name: "My Novel",
      projectType: "novel",
    });

    expect(result.status).toBe("pass");
    expect(result.artifact).toBe("project-manifest");
    expect(result.checkedPaths).toEqual([
      path.join(root, projectId, "project.json"),
    ]);
  });

  it("fails when project.json does not exist on disk (FR-6: no artifact never passes)", async () => {
    const root = await mkWorkspace();
    const projectId = "22222222-2222-4222-8222-222222222222";
    // Note: no project directory or manifest is created at all — this
    // simulates a UI that reported "project created" with nothing to back
    // it up on disk.

    const result = await verifyProjectManifest(root, projectId, {
      name: "Ghost Project",
    });

    expect(result.status).toBe("fail");
    expect(result.artifact).toBe("project-manifest");
  });

  it("fails when project.json exists but does not match expected fields", async () => {
    const root = await mkWorkspace();
    const projectId = "33333333-3333-4333-8333-333333333333";
    await fs.mkdir(path.join(root, projectId), { recursive: true });
    await fs.writeFile(
      path.join(root, projectId, "project.json"),
      JSON.stringify({
        id: projectId,
        name: "Actual Name",
        projectType: "blank",
      }),
      "utf8",
    );

    const result = await verifyProjectManifest(root, projectId, {
      name: "Expected Name",
    });

    expect(result.status).toBe("fail");
  });
});

describe("verifyResourceContent", () => {
  it("passes when content.txt and content.tiptap.json exist and text matches", async () => {
    const root = await mkWorkspace();
    const projectId = "44444444-4444-4444-8444-444444444444";
    const resourceId = "55555555-5555-4555-8555-555555555555";
    const resourceDir = path.join(root, projectId, "resources", resourceId);
    await fs.mkdir(resourceDir, { recursive: true });
    await fs.writeFile(
      path.join(resourceDir, "content.txt"),
      "Hello world",
      "utf8",
    );
    await fs.writeFile(
      path.join(resourceDir, "content.tiptap.json"),
      JSON.stringify({ type: "doc", content: [] }),
      "utf8",
    );

    const result = await verifyResourceContent(
      root,
      projectId,
      resourceId,
      "Hello world",
    );

    expect(result.status).toBe("pass");
    expect(result.artifact).toBe("resource-content");
  });

  it("fails when no content files exist for the resource (FR-6)", async () => {
    const root = await mkWorkspace();
    const projectId = "66666666-6666-4666-8666-666666666666";
    const resourceId = "77777777-7777-4777-8777-777777777777";
    // Nothing written to disk at all — simulates a UI-reported "saved" with
    // no backing filesystem artifact.

    const result = await verifyResourceContent(
      root,
      projectId,
      resourceId,
      "Some text that would have been saved",
    );

    expect(result.status).toBe("fail");
    expect(result.artifact).toBe("resource-content");
  });

  it("fails when content.txt exists but does not match expectedText", async () => {
    const root = await mkWorkspace();
    const projectId = "88888888-8888-4888-8888-888888888888";
    const resourceId = "99999999-9999-4999-8999-999999999999";
    const resourceDir = path.join(root, projectId, "resources", resourceId);
    await fs.mkdir(resourceDir, { recursive: true });
    await fs.writeFile(
      path.join(resourceDir, "content.txt"),
      "Actual text",
      "utf8",
    );
    await fs.writeFile(
      path.join(resourceDir, "content.tiptap.json"),
      JSON.stringify({ type: "doc", content: [] }),
      "utf8",
    );

    const result = await verifyResourceContent(
      root,
      projectId,
      resourceId,
      "Expected text",
    );

    expect(result.status).toBe("fail");
  });
});

describe("verifyResourceSidecar", () => {
  it("passes when the sidecar is present and matches expected fields", async () => {
    const root = await mkWorkspace();
    const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const resourceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await fs.mkdir(path.join(root, projectId, "meta"), { recursive: true });
    await fs.writeFile(
      path.join(root, projectId, "meta", `resource-${resourceId}.meta.json`),
      JSON.stringify({
        id: resourceId,
        name: "Scene 1",
        type: "text",
        folderId: null,
      }),
      "utf8",
    );

    const result = await verifyResourceSidecar(root, projectId, resourceId, {
      name: "Scene 1",
      type: "text",
      folderId: null,
    });

    expect(result.status).toBe("pass");
    expect(result.artifact).toBe("resource-sidecar");
  });

  it("fails when the sidecar file does not exist (FR-6)", async () => {
    const root = await mkWorkspace();
    const projectId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const resourceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    // No meta directory or sidecar file created — UI would have reported
    // the resource as created, but nothing exists on disk.

    const result = await verifyResourceSidecar(root, projectId, resourceId, {
      name: "Ghost Resource",
    });

    expect(result.status).toBe("fail");
    expect(result.artifact).toBe("resource-sidecar");
  });

  it("fails when the sidecar exists but expected fields mismatch", async () => {
    const root = await mkWorkspace();
    const projectId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const resourceId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    await fs.mkdir(path.join(root, projectId, "meta"), { recursive: true });
    await fs.writeFile(
      path.join(root, projectId, "meta", `resource-${resourceId}.meta.json`),
      JSON.stringify({ id: resourceId, name: "Actual Name", type: "text" }),
      "utf8",
    );

    const result = await verifyResourceSidecar(root, projectId, resourceId, {
      name: "Expected Name",
    });

    expect(result.status).toBe("fail");
  });
});

describe("verifyRevision", () => {
  async function writeRevision(
    root: string,
    projectId: string,
    resourceId: string,
    version: number,
  ): Promise<void> {
    const dir = path.join(
      root,
      projectId,
      "revisions",
      resourceId,
      `v-${version}`,
    );
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "metadata.json"),
      JSON.stringify({ version, isCanonical: version === 1 }),
      "utf8",
    );
    await fs.writeFile(path.join(dir, "content.bin"), "revision body", "utf8");
  }

  it("passes when at least one well-formed revision exists", async () => {
    const root = await mkWorkspace();
    const projectId = "10101010-1010-4101-8101-101010101010";
    const resourceId = "20202020-2020-4202-8202-202020202020";
    await writeRevision(root, projectId, resourceId, 1);

    const result = await verifyRevision(root, projectId, resourceId);

    expect(result.status).toBe("pass");
    expect(result.artifact).toBe("revision");
  });

  it("fails when the revisions directory does not exist at all (FR-6)", async () => {
    const root = await mkWorkspace();
    const projectId = "30303030-3030-4303-8303-303030303030";
    const resourceId = "40404040-4040-4404-8404-404040404040";
    // No revisions/<resourceId> directory created — UI would have reported
    // a revision as saved, but there's nothing on disk to back it up.

    const result = await verifyRevision(root, projectId, resourceId);

    expect(result.status).toBe("fail");
    expect(result.artifact).toBe("revision");
  });

  it("fails when fewer well-formed revisions exist than expectedMinCount", async () => {
    const root = await mkWorkspace();
    const projectId = "50505050-5050-4505-8505-505050505050";
    const resourceId = "60606060-6060-4606-8606-606060606060";
    await writeRevision(root, projectId, resourceId, 1);

    const result = await verifyRevision(root, projectId, resourceId, 2);

    expect(result.status).toBe("fail");
  });
});
