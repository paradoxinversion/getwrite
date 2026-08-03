// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import { listProjectsCore } from "../../src/lib/models/project-crud-core";
import { writeProjectMarker } from "../../src/lib/models/crypto/project-marker";
import { runInProjectContext } from "../../src/lib/models/crypto/adapter-selection";
import {
  __resetKeyringSessionForTests,
  createWorkspaceKeyring,
  lockSession,
  registerProject,
  unlockSession,
} from "../../src/lib/models/crypto/keyring-session";

const WORKSPACE = "/ws";
const PLAIN_ID = "11111111-1111-4111-8111-111111111111";
const SEALED_ID = "22222222-2222-4222-8222-222222222222";
const PASS = "correct horse battery staple";

let adapter: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

/** Lists projects with the workspace bound, as a request would. */
function listProjects() {
  return runInStorageContext({ tenantRoot: WORKSPACE, adapter }, () =>
    listProjectsCore(),
  );
}

/** Writes a plaintext project directory. */
async function seedPlainProject(id: string, name: string): Promise<void> {
  const root = `${WORKSPACE}/${id}`;
  await adapter.mkdir(`${root}/folders`, { recursive: true });
  await adapter.mkdir(`${root}/resources`, { recursive: true });
  await adapter.writeFile(
    `${root}/project.json`,
    JSON.stringify({ id, name, createdAt: "2026-01-01T00:00:00.000Z" }),
  );
}

beforeEach(async () => {
  adapter = createMemoryAdapter();
  io.setStorageAdapter(adapter);
  __resetKeyringSessionForTests();
  await adapter.mkdir(WORKSPACE, { recursive: true });
  await seedPlainProject(PLAIN_ID, "Open Notebook");
  await seedPlainProject(SEALED_ID, "The Whistleblower");
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetKeyringSessionForTests();
  vi.restoreAllMocks();
});

/** Encrypts SEALED_ID in place and leaves the workspace unlocked. */
async function encryptSecondProject(): Promise<void> {
  const root = `${WORKSPACE}/${SEALED_ID}`;
  await createWorkspaceKeyring(PASS, WORKSPACE, adapter);
  const key = await registerProject(SEALED_ID, WORKSPACE, adapter);

  // Seal the manifest the way a conversion would, then mark the project.
  const manifest = await adapter.readFile(`${root}/project.json`, "utf-8");
  await writeProjectMarker(root, adapter);
  const { seal } = await import("../../src/lib/models/crypto/envelope");
  await adapter.writeFile(
    `${root}/project.json`,
    Buffer.from(await seal(key, new TextEncoder().encode(manifest))),
  );
}

describe("listProjectsCore — workspace locked", () => {
  beforeEach(async () => {
    await encryptSecondProject();
    lockSession();
  });

  it("lists unencrypted projects normally", async () => {
    const entries = await listProjects();
    const plain = entries.find(
      (entry) => (entry.project as { id: string }).id === PLAIN_ID,
    );

    // FR20: encrypting one project must not hold the rest of the work hostage.
    expect(plain?.isLocked).toBeFalsy();
    expect((plain?.project as { name: string }).name).toBe("Open Notebook");
  });

  it("lists an encrypted project as locked rather than dropping it", async () => {
    const entries = await listProjects();
    expect(entries).toHaveLength(2);

    const sealed = entries.find(
      (entry) => (entry.project as { id: string }).id === SEALED_ID,
    );
    expect(sealed?.isLocked).toBe(true);
  });

  it("leaks no title while locked", async () => {
    const entries = await listProjects();
    const sealed = entries.find(
      (entry) => (entry.project as { id: string }).id === SEALED_ID,
    );

    // FR18: a writer's title is often the most sensitive string they have.
    expect(JSON.stringify(sealed)).not.toContain("The Whistleblower");
    expect((sealed?.project as { name?: string }).name).toBeUndefined();
    expect(sealed?.resources).toEqual([]);
    expect(sealed?.folders).toEqual([]);
  });

  it("logs no warning for a locked project", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await listProjects();
    // A locked project is an expected state, not a defect worth warning about.
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("listProjectsCore — workspace unlocked", () => {
  beforeEach(async () => {
    await encryptSecondProject();
    lockSession();
    await unlockSession(PASS, WORKSPACE, adapter);
  });

  it("lists an encrypted project in full, with its name", async () => {
    const entries = await listProjects();
    const sealed = entries.find(
      (entry) => (entry.project as { id: string }).id === SEALED_ID,
    );

    expect(sealed?.isLocked).toBe(false);
    expect((sealed?.project as { name: string }).name).toBe(
      "The Whistleblower",
    );
  });

  it("still lists unencrypted projects alongside it", async () => {
    const entries = await listProjects();
    expect(entries).toHaveLength(2);
    expect(entries.filter((entry) => entry.isLocked)).toHaveLength(0);
  });
});

describe("listProjectsCore — a project whose key is missing", () => {
  it("lists it as locked instead of dropping it", async () => {
    await encryptSecondProject();
    // A project copied in from another workspace: marked encrypted, but this
    // keyring has no key for it. FR26 forbids treating it as absent.
    const strangerId = "33333333-3333-4333-8333-333333333333";
    const strangerRoot = `${WORKSPACE}/${strangerId}`;
    await adapter.mkdir(strangerRoot, { recursive: true });
    await writeProjectMarker(strangerRoot, adapter);

    const entries = await listProjects();
    const stranger = entries.find(
      (entry) => (entry.project as { id: string }).id === strangerId,
    );

    expect(stranger?.isLocked).toBe(true);
    expect(entries).toHaveLength(3);
  });
});

describe("listProjectsCore — no encryption anywhere", () => {
  it("behaves exactly as before", async () => {
    const entries = await listProjects();

    // FR3: a workspace that never opted in sees no change at all.
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.isLocked === undefined)).toBe(true);
  });

  it("still reads resources and folders for plain projects", async () => {
    // `readFolderTree` descends into child directories and reads each
    // `folder.json`, so the descriptor lives one level down.
    await adapter.mkdir(`${WORKSPACE}/${PLAIN_ID}/folders/chapters`, {
      recursive: true,
    });
    await runInProjectContext(`${WORKSPACE}/${PLAIN_ID}`, null, () =>
      io.writeFile(
        `${WORKSPACE}/${PLAIN_ID}/folders/chapters/folder.json`,
        JSON.stringify({ id: "f1", name: "Chapters" }),
      ),
    );

    const entries = await listProjects();
    const plain = entries.find(
      (entry) => (entry.project as { id: string }).id === PLAIN_ID,
    );
    expect(plain?.folders.length).toBeGreaterThan(0);
  });
});
