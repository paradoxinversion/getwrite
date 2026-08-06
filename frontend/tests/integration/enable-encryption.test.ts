// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import { __resetWriteBarriersForTests } from "../../src/lib/models/write-barrier";
import { isEnvelope } from "../../src/lib/models/crypto/envelope";
import { isProjectEncrypted } from "../../src/lib/models/crypto/project-marker";
import { readNameIndex } from "../../src/lib/models/crypto/name-index";
import { readConversionMarker } from "../../src/lib/models/crypto/convert-project";
import { runInProjectContext } from "../../src/lib/models/crypto/adapter-selection";
import { listProjectsCore } from "../../src/lib/models/project-crud-core";
import {
  __resetKeyringSessionForTests,
  lockSession,
  requireSessionKeyring,
  unlockSession,
} from "../../src/lib/models/crypto/keyring-session";
import { workspaceEncryptionAdapter } from "../../src/lib/models/crypto/workspace-adapter";
import {
  enableProjectEncryption,
  resumeInterruptedConversions,
} from "../../src/lib/models/crypto/enable-encryption";

const WORKSPACE = "/ws";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const ROOT = `${WORKSPACE}/${PROJECT_ID}`;
const PASS = "correct horse battery staple";

const CONTENT: ReadonlyArray<readonly [string, string]> = [
  [
    `${ROOT}/project.json`,
    '{"id":"abc","name":"The Whistleblower","createdAt":"2026-01-01T00:00:00.000Z"}',
  ],
  [`${ROOT}/resources/r1/content.txt`, "chapter one"],
  [`${ROOT}/meta/resource-r1.meta.json`, '{"tags":["draft"]}'],
  [`${ROOT}/revisions/r1/v-1/content.txt`, "chapter one, older"],
];

let adapter: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

async function seed(files: typeof CONTENT = CONTENT): Promise<void> {
  for (const [p, content] of files) {
    await adapter.mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
    await adapter.writeFile(p, content);
  }
}

function inWorkspace<T>(fn: () => Promise<T>): Promise<T> {
  return runInStorageContext({ tenantRoot: WORKSPACE, adapter }, fn);
}

beforeEach(async () => {
  adapter = createMemoryAdapter();
  io.setStorageAdapter(adapter);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
  await adapter.mkdir(WORKSPACE, { recursive: true });
  await seed();
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
});

describe("enableProjectEncryption — the first project", () => {
  it("seals every file and leaves the project readable", async () => {
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );

    for (const [filePath, content] of CONTENT) {
      expect(isEnvelope(await adapter.readFileBuffer(filePath))).toBe(true);
      const readBack = await runInProjectContext(
        ROOT,
        requireSessionKeyring(),
        () => io.readFile(filePath, "utf-8"),
        adapter,
      );
      expect(readBack).toBe(content);
    }
    expect(await isProjectEncrypted(ROOT, adapter)).toBe(true);
  });

  it("records the name in the sealed index", async () => {
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );

    const index = await readNameIndex(
      requireSessionKeyring().workspaceKey(),
      WORKSPACE,
      adapter,
    );
    expect(index[PROJECT_ID]).toBe("The Whistleblower");
  });

  it("survives a lock and unlock", async () => {
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );
    lockSession();
    await unlockSession(PASS, WORKSPACE, adapter);

    // The decisive check: the key persisted, so the project still opens.
    const readBack = await runInProjectContext(
      ROOT,
      requireSessionKeyring(),
      () => io.readFile(`${ROOT}/resources/r1/content.txt`, "utf-8"),
      adapter,
    );
    expect(readBack).toBe("chapter one");
  });

  it("shows up correctly in the project list", async () => {
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );

    const unlocked = await inWorkspace(() => listProjectsCore());
    expect(unlocked[0].isEncrypted).toBe(true);
    expect(unlocked[0].isLocked).toBe(false);
    expect((unlocked[0].project as { name: string }).name).toBe(
      "The Whistleblower",
    );

    lockSession();
    const locked = await inWorkspace(() => listProjectsCore());
    expect(locked[0].isLocked).toBe(true);
    expect(JSON.stringify(locked[0])).not.toContain("The Whistleblower");
  });

  it("reports progress while it works", async () => {
    const seen: number[] = [];
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
        onProgress: ({ done }) => seen.push(done),
      }),
    );

    expect(seen.length).toBeGreaterThan(0);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

describe("enableProjectEncryption — a second project", () => {
  it("reuses the workspace passphrase", async () => {
    await seed([
      [
        `${WORKSPACE}/${SECOND_ID}/project.json`,
        '{"id":"b","name":"Poetry 2026","createdAt":"2026-01-01T00:00:00.000Z"}',
      ],
    ]);

    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: SECOND_ID,
        projectName: "Poetry 2026",
        passphrase: null,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );

    const keyring = requireSessionKeyring();
    expect(keyring.hasProject(PROJECT_ID)).toBe(true);
    expect(keyring.hasProject(SECOND_ID)).toBe(true);
    // FR6: same passphrase, independent keys.
    expect(keyring.projectKey(PROJECT_ID)).not.toBe(
      keyring.projectKey(SECOND_ID),
    );
  });
});

describe("resumeInterruptedConversions", () => {
  it("finishes a conversion that was interrupted", async () => {
    let calls = 0;
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
        onProgress: () => {
          if (++calls === 1) throw new Error("interrupted");
        },
      }),
    ).catch(() => undefined);
    __resetWriteBarriersForTests();

    // Half-converted: the conversion marker is the record that work remains.
    expect(await readConversionMarker(ROOT, adapter)).not.toBeNull();

    const resumed = await inWorkspace(() =>
      resumeInterruptedConversions(WORKSPACE, adapter),
    );

    expect(resumed).toEqual([PROJECT_ID]);
    expect(await readConversionMarker(ROOT, adapter)).toBeNull();
    for (const [filePath, content] of CONTENT) {
      expect(isEnvelope(await adapter.readFileBuffer(filePath))).toBe(true);
      const readBack = await runInProjectContext(
        ROOT,
        requireSessionKeyring(),
        () => io.readFile(filePath, "utf-8"),
        adapter,
      );
      expect(readBack).toBe(content);
    }
  });

  it("does nothing when no conversion was interrupted", async () => {
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );

    expect(
      await inWorkspace(() => resumeInterruptedConversions(WORKSPACE, adapter)),
    ).toEqual([]);
  });
});

describe("an encrypted project opens through the workspace adapter", () => {
  it("loads project.json after encryption, as the open route does", async () => {
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );

    // Reproduces the bug that made an encrypted project unopenable: the load
    // path reads project.json with whatever adapter the request bound, so the
    // request-level adapter has to route per project.
    const loaded = await runInStorageContext(
      {
        tenantRoot: WORKSPACE,
        adapter: workspaceEncryptionAdapter(
          adapter,
          WORKSPACE,
          requireSessionKeyring(),
        ),
      },
      () => io.readFile(`${ROOT}/project.json`, "utf-8"),
    );

    expect(JSON.parse(loaded).name).toBe("The Whistleblower");
  });

  it("still fails with a plain adapter, which is what broke", async () => {
    await inWorkspace(() =>
      enableProjectEncryption({
        projectId: PROJECT_ID,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
        adapter,
      }),
    );

    const raw = await adapter.readFile(`${ROOT}/project.json`, "utf-8");
    expect(() => JSON.parse(raw)).toThrow();
  });
});
