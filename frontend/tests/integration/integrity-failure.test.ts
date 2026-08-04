// Last Updated: 2026-08-04

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import { __resetWriteBarriersForTests } from "../../src/lib/models/write-barrier";
import {
  EnvelopeFormatError,
  EnvelopeIntegrityError,
} from "../../src/lib/models/crypto/envelope";
import { workspaceEncryptionAdapter } from "../../src/lib/models/crypto/workspace-adapter";
import { listProjectsCore } from "../../src/lib/models/project-crud-core";
import {
  __resetKeyringSessionForTests,
  requireSessionKeyring,
} from "../../src/lib/models/crypto/keyring-session";
import { enableProjectEncryption } from "../../src/lib/models/crypto/enable-encryption";

const WORKSPACE = "/ws";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ROOT = `${WORKSPACE}/${PROJECT_ID}`;
const CHAPTER = `${ROOT}/resources/r1/content.txt`;
const PASS = "correct horse battery staple";

let adapter: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

/** Runs work through the request-level routing adapter, as the app does. */
function inWorkspace<T>(fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(
    runInStorageContext(
      {
        tenantRoot: WORKSPACE,
        adapter: workspaceEncryptionAdapter(
          adapter,
          WORKSPACE,
          requireSessionKeyring(),
        ),
      },
      fn,
    ),
  );
}

beforeEach(async () => {
  adapter = createMemoryAdapter();
  io.setStorageAdapter(adapter);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
  await adapter.mkdir(`${ROOT}/resources/r1`, { recursive: true });
  await adapter.writeFile(
    `${ROOT}/project.json`,
    '{"id":"abc","name":"The Whistleblower","createdAt":"2026-01-01T00:00:00.000Z"}',
  );
  await adapter.writeFile(CHAPTER, "chapter one");

  await runInStorageContext({ tenantRoot: WORKSPACE, adapter }, () =>
    enableProjectEncryption({
      projectId: PROJECT_ID,
      projectName: "The Whistleblower",
      passphrase: PASS,
      workspaceRoot: WORKSPACE,
      adapter,
    }),
  );
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
  vi.restoreAllMocks();
});

/** Corrupts one byte of a sealed file, as bit-rot or tampering would. */
async function corrupt(target: string): Promise<Buffer> {
  const raw = Buffer.from(await adapter.readFileBuffer(target));
  raw[raw.length - 1] ^= 0xff;
  await adapter.writeFile(target, raw);
  return raw;
}

describe("integrity failure — surfaces distinctly", () => {
  it("raises an integrity error, not a format error", async () => {
    await corrupt(CHAPTER);

    // FR15: "encrypted and untrustworthy" must be distinguishable from "not
    // encrypted", or the UI cannot tell corruption from a mid-conversion file.
    const failure = await inWorkspace(() =>
      io.readFile(CHAPTER, "utf-8").catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(EnvelopeIntegrityError);
    expect(failure).not.toBeInstanceOf(EnvelopeFormatError);
  });

  it("carries a message a user can act on", async () => {
    await corrupt(CHAPTER);
    const failure = (await inWorkspace(() =>
      io.readFile(CHAPTER, "utf-8").catch((error: unknown) => error),
    )) as Error;

    expect(failure.message).toMatch(/wrong key or corrupted data/i);
  });

  it("never surfaces as empty or partial content", async () => {
    await corrupt(CHAPTER);

    // The failure mode that would silently destroy work: an editor opening an
    // empty document over a corrupt file and autosaving it back.
    await expect(
      inWorkspace(() => io.readFile(CHAPTER, "utf-8")),
    ).rejects.toThrow();
    await expect(
      inWorkspace(() => io.readFileBuffer(CHAPTER)),
    ).rejects.toThrow();
  });
});

describe("integrity failure — changes nothing on disk", () => {
  it("leaves the damaged file exactly as it was", async () => {
    const corrupted = await corrupt(CHAPTER);

    await inWorkspace(() =>
      io.readFile(CHAPTER, "utf-8").catch(() => undefined),
    );

    // FR26: a file that cannot be opened must be left for a recovery tool, not
    // "repaired" into something else.
    const after = Buffer.from(await adapter.readFileBuffer(CHAPTER));
    expect(after.equals(corrupted)).toBe(true);
  });

  it("leaves the rest of the project readable", async () => {
    await corrupt(CHAPTER);

    // One damaged file must not take the project with it.
    const manifest = await inWorkspace(() =>
      io.readFile(`${ROOT}/project.json`, "utf-8"),
    );
    expect(JSON.parse(manifest).name).toBe("The Whistleblower");
  });

  it("still lists the project rather than dropping it", async () => {
    await corrupt(`${ROOT}/project.json`);

    const entries = await runInStorageContext(
      { tenantRoot: WORKSPACE, adapter },
      () => listProjectsCore(),
    );

    // A project with a damaged manifest must stay visible — vanishing from the
    // Start screen reads as data loss even when the files are all still there.
    expect(entries).toHaveLength(1);
    expect(entries[0].isEncrypted).toBe(true);
  });
});
