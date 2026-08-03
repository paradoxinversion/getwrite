// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import { isEnvelope } from "../../src/lib/models/crypto/envelope";
import { workspaceEncryptionAdapter } from "../../src/lib/models/crypto/workspace-adapter";
import {
  __resetKeyringSessionForTests,
  createWorkspaceKeyring,
  lockSession,
  registerProject,
  requireSessionKeyring,
} from "../../src/lib/models/crypto/keyring-session";
import type { Keyring } from "../../src/lib/models/crypto/keyring";

const WORKSPACE = "/ws";
const SEALED_ID = "11111111-1111-4111-8111-111111111111";
const PLAIN_ID = "22222222-2222-4222-8222-222222222222";
const PASS = "correct horse battery staple";

let base: StorageAdapter;
let keyring: Keyring;
const previousAdapter = io.getStorageAdapter();

/** Runs work through the routing adapter, as a request does. */
function inWorkspace<T>(
  fn: () => T | Promise<T>,
  ring: Keyring | null = keyring,
): Promise<T> {
  return Promise.resolve(
    runInStorageContext(
      {
        tenantRoot: WORKSPACE,
        adapter: workspaceEncryptionAdapter(base, WORKSPACE, ring),
      },
      fn,
    ),
  );
}

beforeEach(async () => {
  base = createMemoryAdapter();
  io.setStorageAdapter(base);
  __resetKeyringSessionForTests();
  for (const id of [SEALED_ID, PLAIN_ID]) {
    await base.mkdir(`${WORKSPACE}/${id}/resources`, { recursive: true });
  }
  await createWorkspaceKeyring(PASS, WORKSPACE, base);
  await registerProject(SEALED_ID, WORKSPACE, base);
  keyring = requireSessionKeyring();
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetKeyringSessionForTests();
});

describe("workspace adapter — routes each path to its own project", () => {
  it("seals a registered project's files", async () => {
    await inWorkspace(() =>
      io.writeFile(`${WORKSPACE}/${SEALED_ID}/project.json`, '{"a":1}'),
    );

    expect(
      isEnvelope(
        await base.readFileBuffer(`${WORKSPACE}/${SEALED_ID}/project.json`),
      ),
    ).toBe(true);
    expect(
      await inWorkspace(() =>
        io.readFile(`${WORKSPACE}/${SEALED_ID}/project.json`, "utf-8"),
      ),
    ).toBe('{"a":1}');
  });

  it("leaves an unregistered project byte-identical", async () => {
    await inWorkspace(() =>
      io.writeFile(`${WORKSPACE}/${PLAIN_ID}/project.json`, '{"b":2}'),
    );

    // FR12's intent: no cryptographic operation runs for a project with no key.
    const raw = await base.readFile(
      `${WORKSPACE}/${PLAIN_ID}/project.json`,
      "utf-8",
    );
    expect(raw).toBe('{"b":2}');
    expect(
      isEnvelope(
        await base.readFileBuffer(`${WORKSPACE}/${PLAIN_ID}/project.json`),
      ),
    ).toBe(false);
  });

  it("serves both projects in one request", async () => {
    await inWorkspace(async () => {
      await io.writeFile(`${WORKSPACE}/${SEALED_ID}/a.txt`, "secret");
      await io.writeFile(`${WORKSPACE}/${PLAIN_ID}/a.txt`, "open");
    });

    expect(
      isEnvelope(await base.readFileBuffer(`${WORKSPACE}/${SEALED_ID}/a.txt`)),
    ).toBe(true);
    expect(await base.readFile(`${WORKSPACE}/${PLAIN_ID}/a.txt`, "utf-8")).toBe(
      "open",
    );
  });

  it("leaves workspace-level files alone", async () => {
    // The keyring and the sealed name index must stay readable before any
    // project can be opened, so they can never be routed through a project key.
    await inWorkspace(() =>
      io.writeFile(`${WORKSPACE}/.getwrite-names`, "index-bytes"),
    );
    expect(await base.readFile(`${WORKSPACE}/.getwrite-names`, "utf-8")).toBe(
      "index-bytes",
    );
  });

  it("passes everything through while locked", async () => {
    lockSession();
    await inWorkspace(
      () => io.writeFile(`${WORKSPACE}/${PLAIN_ID}/a.txt`, "still writable"),
      null,
    );
    expect(await base.readFile(`${WORKSPACE}/${PLAIN_ID}/a.txt`, "utf-8")).toBe(
      "still writable",
    );
  });

  it("round-trips through atomicWriteFile, as the save path does", async () => {
    await inWorkspace(() =>
      io.atomicWriteFile(
        `${WORKSPACE}/${SEALED_ID}/resources/r1.txt`,
        "chapter one",
      ),
    );

    expect(
      isEnvelope(
        await base.readFileBuffer(`${WORKSPACE}/${SEALED_ID}/resources/r1.txt`),
      ),
    ).toBe(true);
    expect(
      await inWorkspace(() =>
        io.readFile(`${WORKSPACE}/${SEALED_ID}/resources/r1.txt`, "utf-8"),
      ),
    ).toBe("chapter one");
  });
});
