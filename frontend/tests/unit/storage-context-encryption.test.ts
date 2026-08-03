// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { resolveProjectsDir } from "../../src/lib/models/projects-dir";
import {
  createKeyring,
  type Keyring,
} from "../../src/lib/models/crypto/keyring";
import { isEnvelope } from "../../src/lib/models/crypto/envelope";
import { writeProjectMarker } from "../../src/lib/models/crypto/project-marker";
import {
  MissingProjectKeyError,
  ProjectLockedError,
  resolveProjectAdapter,
  runInProjectContext,
} from "../../src/lib/models/crypto/adapter-selection";

const WORKSPACE = "/ws";
const PLAIN_ID = "11111111-1111-4111-8111-111111111111";
const SEALED_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const PLAIN_ROOT = `${WORKSPACE}/${PLAIN_ID}`;
const SEALED_ROOT = `${WORKSPACE}/${SEALED_ID}`;
const OTHER_ROOT = `${WORKSPACE}/${OTHER_ID}`;

let base: StorageAdapter;
let keyring: Keyring;
const previousAdapter = io.getStorageAdapter();

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
});

beforeEach(async () => {
  base = createMemoryAdapter();
  // `runInProjectContext` defaults its base adapter to the ambient one, which
  // is how the app resolves it too — so make that the in-memory adapter here
  // rather than passing it explicitly at every call site.
  io.setStorageAdapter(base);
  for (const root of [PLAIN_ROOT, SEALED_ROOT, OTHER_ROOT]) {
    await base.mkdir(root, { recursive: true });
  }

  keyring = await createKeyring("correct horse battery staple");
  await keyring.addProject(SEALED_ID);
  await keyring.addProject(OTHER_ID);

  // Only these two opted in; PLAIN_ROOT deliberately has no marker.
  await writeProjectMarker(SEALED_ROOT, base);
  await writeProjectMarker(OTHER_ROOT, base);
});

describe("adapter selection — a project that never opted in", () => {
  it("returns the base adapter itself, not a wrapper", async () => {
    // FR12, asserted by identity: no crypto code may sit in the chain for an
    // unencrypted project. A functionally-equivalent wrapper would not do.
    expect(await resolveProjectAdapter(PLAIN_ROOT, base, keyring)).toBe(base);
  });

  it("returns the base adapter even when the keyring is locked", async () => {
    keyring.lock();
    expect(await resolveProjectAdapter(PLAIN_ROOT, base, keyring)).toBe(base);
  });

  it("returns the base adapter when there is no keyring at all", async () => {
    expect(await resolveProjectAdapter(PLAIN_ROOT, base, null)).toBe(base);
  });

  it("keeps its files in plaintext on disk", async () => {
    await runInProjectContext(PLAIN_ROOT, keyring, () =>
      io.writeFile(`${PLAIN_ROOT}/project.json`, '{"name":"Plain"}'),
    );

    const raw = await base.readFile(`${PLAIN_ROOT}/project.json`, "utf-8");
    expect(raw).toBe('{"name":"Plain"}');
  });
});

describe("adapter selection — a project that opted in", () => {
  it("returns a wrapper, not the base adapter", async () => {
    expect(await resolveProjectAdapter(SEALED_ROOT, base, keyring)).not.toBe(
      base,
    );
  });

  it("seals what it writes and opens what it reads", async () => {
    await runInProjectContext(SEALED_ROOT, keyring, () =>
      io.writeFile(
        `${SEALED_ROOT}/project.json`,
        '{"name":"The Whistleblower"}',
      ),
    );

    const raw = await base.readFileBuffer(`${SEALED_ROOT}/project.json`);
    expect(isEnvelope(raw)).toBe(true);
    expect(Buffer.from(raw).includes(Buffer.from("The Whistleblower"))).toBe(
      false,
    );

    const readBack = await runInProjectContext(SEALED_ROOT, keyring, () =>
      io.readFile(`${SEALED_ROOT}/project.json`, "utf-8"),
    );
    expect(readBack).toBe('{"name":"The Whistleblower"}');
  });

  it("gives each project its own key", async () => {
    await runInProjectContext(SEALED_ROOT, keyring, () =>
      io.writeFile(`${SEALED_ROOT}/a.txt`, "secret"),
    );

    // The other project's adapter must not open this project's file, even
    // though both are unlocked by the same passphrase.
    const otherAdapter = await resolveProjectAdapter(OTHER_ROOT, base, keyring);
    await expect(
      otherAdapter.readFile(`${SEALED_ROOT}/a.txt`, "utf-8"),
    ).rejects.toThrow();
  });

  it("binds the tenant root to the workspace, not the project", async () => {
    // `resolveProjectsDir()` reads tenantRoot and is contracted to return the
    // directory *containing* projects — binding the project dir itself would
    // make every path resolve one level too deep.
    const seen = await runInProjectContext(SEALED_ROOT, keyring, () => ({
      projectsDir: resolveProjectsDir(),
      adapter: io.getStorageAdapter(),
    }));

    expect(seen.projectsDir).toBe(WORKSPACE);
    expect(seen.adapter).not.toBe(base);
  });
});

describe("adapter selection — refuses to proceed without the key", () => {
  it("raises when the keyring is locked", async () => {
    keyring.lock();
    await expect(
      resolveProjectAdapter(SEALED_ROOT, base, keyring),
    ).rejects.toBeInstanceOf(ProjectLockedError);
  });

  it("raises when there is no keyring at all", async () => {
    await expect(
      resolveProjectAdapter(SEALED_ROOT, base, null),
    ).rejects.toBeInstanceOf(ProjectLockedError);
  });

  it("raises when the keyring holds no key for this project", async () => {
    const strangerRoot = `${WORKSPACE}/44444444-4444-4444-8444-444444444444`;
    await base.mkdir(strangerRoot, { recursive: true });
    await writeProjectMarker(strangerRoot, base);

    await expect(
      resolveProjectAdapter(strangerRoot, base, keyring),
    ).rejects.toBeInstanceOf(MissingProjectKeyError);
  });

  it("leaves every file untouched when it cannot resolve a key", async () => {
    await runInProjectContext(SEALED_ROOT, keyring, () =>
      io.writeFile(`${SEALED_ROOT}/a.txt`, "chapter one"),
    );
    const before = Buffer.from(
      await base.readFileBuffer(`${SEALED_ROOT}/a.txt`),
    );

    keyring.lock();
    await expect(
      resolveProjectAdapter(SEALED_ROOT, base, keyring),
    ).rejects.toThrow();

    // FR26: a project whose key cannot be resolved must be left byte-for-byte
    // intact, so a later recovery tool still has something to work with.
    const after = Buffer.from(
      await base.readFileBuffer(`${SEALED_ROOT}/a.txt`),
    );
    expect(after.equals(before)).toBe(true);
  });

  it("propagates a corrupt marker rather than treating it as unencrypted", async () => {
    await base.writeFile(`${PLAIN_ROOT}/.encrypted.json`, "{ not json");
    await expect(
      resolveProjectAdapter(PLAIN_ROOT, base, keyring),
    ).rejects.toThrow(/marker/i);
  });
});

describe("adapter selection — mixed workspace", () => {
  it("serves encrypted and unencrypted projects side by side", async () => {
    await runInProjectContext(PLAIN_ROOT, keyring, () =>
      io.writeFile(`${PLAIN_ROOT}/a.txt`, "open text"),
    );
    await runInProjectContext(SEALED_ROOT, keyring, () =>
      io.writeFile(`${SEALED_ROOT}/a.txt`, "closed text"),
    );

    expect(await base.readFile(`${PLAIN_ROOT}/a.txt`, "utf-8")).toBe(
      "open text",
    );
    expect(isEnvelope(await base.readFileBuffer(`${SEALED_ROOT}/a.txt`))).toBe(
      true,
    );
  });

  it("still serves unencrypted projects while the workspace is locked", async () => {
    keyring.lock();
    // Encrypting one project must not hold the rest of the user's work hostage
    // (FR20's decline path depends on exactly this).
    await runInProjectContext(PLAIN_ROOT, keyring, () =>
      io.writeFile(`${PLAIN_ROOT}/a.txt`, "still writable"),
    );
    expect(await base.readFile(`${PLAIN_ROOT}/a.txt`, "utf-8")).toBe(
      "still writable",
    );
  });
});
