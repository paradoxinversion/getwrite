// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import { __resetWriteBarriersForTests } from "../../src/lib/models/write-barrier";
import { isEnvelope } from "../../src/lib/models/crypto/envelope";
import {
  PROJECT_MARKER_FILENAME,
  isProjectEncrypted,
} from "../../src/lib/models/crypto/project-marker";
import {
  __resetKeyringSessionForTests,
  requireSessionKeyring,
} from "../../src/lib/models/crypto/keyring-session";
import { enableProjectEncryption } from "../../src/lib/models/crypto/enable-encryption";
import { exportProjectAsPlaintext } from "../../src/lib/models/crypto/export-plaintext";

const WORKSPACE = "/ws";
const OUT = "/out";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ROOT = `${WORKSPACE}/${PROJECT_ID}`;
const DEST = `${OUT}/${PROJECT_ID}`;
const PASS = "correct horse battery staple";

const CONTENT: ReadonlyArray<readonly [string, string]> = [
  [
    `${ROOT}/project.json`,
    '{"id":"abc","name":"The Whistleblower","createdAt":"2026-01-01T00:00:00.000Z"}',
  ],
  [`${ROOT}/resources/r1/content.txt`, "chapter one"],
  [`${ROOT}/resources/r1/content.tiptap.json`, '{"doc":1}'],
  [`${ROOT}/meta/resource-r1.meta.json`, '{"tags":["draft"]}'],
  [`${ROOT}/meta/index/inverted.json`, '{"whistle":["r1"]}'],
  [`${ROOT}/revisions/r1/v-1/content.txt`, "chapter one, older"],
  [`${ROOT}/.trash/resources/r9/content.txt`, "deleted scene"],
];

let adapter: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

function inWorkspace<T>(fn: () => Promise<T>): Promise<T> {
  return runInStorageContext({ tenantRoot: WORKSPACE, adapter }, fn);
}

beforeEach(async () => {
  adapter = createMemoryAdapter();
  io.setStorageAdapter(adapter);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
  await adapter.mkdir(OUT, { recursive: true });
  for (const [p, content] of CONTENT) {
    await adapter.mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
    await adapter.writeFile(p, content);
  }
  await inWorkspace(() =>
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
});

/** Exports the encrypted project to DEST with the session key. */
function exportProject(destination = DEST) {
  return exportProjectAsPlaintext({
    projectRoot: ROOT,
    destinationRoot: destination,
    key: requireSessionKeyring().projectKey(PROJECT_ID),
    adapter,
  });
}

describe("plaintext export — the escape hatch", () => {
  it("writes every file back as plaintext", async () => {
    const result = await exportProject();

    expect(result.filesWritten).toBe(CONTENT.length);
    for (const [source, content] of CONTENT) {
      const exported = `${DEST}${source.slice(ROOT.length)}`;
      expect(await adapter.readFile(exported, "utf-8")).toBe(content);
      expect(isEnvelope(await adapter.readFileBuffer(exported))).toBe(false);
    }
  });

  it("leaves the encrypted original untouched", async () => {
    await exportProject();

    // The export is a copy, not a conversion: the source must still be sealed.
    expect(
      isEnvelope(await adapter.readFileBuffer(`${ROOT}/project.json`)),
    ).toBe(true);
    expect(await isProjectEncrypted(ROOT, adapter)).toBe(true);
  });

  it("omits the encryption marker, so the copy is an ordinary project", async () => {
    await exportProject();

    // Carrying it over would produce a directory claiming to be encrypted while
    // holding plaintext — the exact state everything else prevents.
    expect(await isProjectEncrypted(DEST, adapter)).toBe(false);
    expect(await adapter.readdir(DEST)).not.toContain(PROJECT_MARKER_FILENAME);
  });

  it("produces a directory shaped like an ordinary project", async () => {
    await exportProject();

    // FR24: a complete, openable project — not compiled manuscript output.
    // The manifest is plaintext and parses, and nothing marks it encrypted.
    const manifest = JSON.parse(
      await adapter.readFile(`${DEST}/project.json`, "utf-8"),
    );
    expect(manifest.name).toBe("The Whistleblower");
    expect(await isProjectEncrypted(DEST, adapter)).toBe(false);

    // Opening it in the running app — which validates every resource against
    // its schema — is Task 22's desktop end-to-end check; this fixture carries
    // deliberately minimal resources.
    expect(await io.exists(`${DEST}/resources/r1/content.txt`)).toBe(true);
  });

  it("carries revisions, metadata, indexes and trash across", async () => {
    await exportProject();

    for (const relative of [
      "/revisions/r1/v-1/content.txt",
      "/meta/resource-r1.meta.json",
      "/meta/index/inverted.json",
      "/.trash/resources/r9/content.txt",
    ]) {
      expect(await io.exists(`${DEST}${relative}`)).toBe(true);
    }
  });

  it("reports progress", async () => {
    const seen: number[] = [];
    await exportProjectAsPlaintext({
      projectRoot: ROOT,
      destinationRoot: DEST,
      key: requireSessionKeyring().projectKey(PROJECT_ID),
      adapter,
      onProgress: ({ done }) => seen.push(done),
    });

    expect(seen).toEqual(
      Array.from({ length: CONTENT.length }, (_, index) => index + 1),
    );
  });
});

describe("plaintext export — refuses to destroy data", () => {
  it("refuses to export a project into itself", async () => {
    await expect(exportProject(`${ROOT}/export`)).rejects.toThrow(
      /into itself/i,
    );
  });

  it("refuses a destination that already has content", async () => {
    await adapter.mkdir(DEST, { recursive: true });
    await adapter.writeFile(`${DEST}/existing.txt`, "someone's work");

    await expect(exportProject()).rejects.toThrow(/already has content/i);
    expect(await adapter.readFile(`${DEST}/existing.txt`, "utf-8")).toBe(
      "someone's work",
    );
  });

  it("refuses a key that cannot open the project", async () => {
    const { generateDataKeyBytes, importAesKey } =
      await import("../../src/lib/models/crypto/primitives");
    await expect(
      exportProjectAsPlaintext({
        projectRoot: ROOT,
        destinationRoot: DEST,
        key: await importAesKey(generateDataKeyBytes()),
        adapter,
      }),
    ).rejects.toThrow();
  });
});
