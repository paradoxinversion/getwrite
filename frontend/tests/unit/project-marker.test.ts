// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach } from "vitest";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { encryptingAdapter } from "../../src/lib/models/encryptingAdapter";
import {
  PROJECT_MARKER_FILENAME,
  ProjectMarkerFormatError,
  isProjectEncrypted,
  readProjectMarker,
  removeProjectMarker,
  writeProjectMarker,
} from "../../src/lib/models/crypto/project-marker";
import {
  generateDataKeyBytes,
  importAesKey,
} from "../../src/lib/models/crypto/primitives";

const WORKSPACE = "/ws";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ROOT = `${WORKSPACE}/${PROJECT_ID}`;

let adapter: StorageAdapter;

beforeEach(async () => {
  adapter = createMemoryAdapter();
  await adapter.mkdir(PROJECT_ROOT, { recursive: true });
});

describe("project marker — presence is the opt-in signal", () => {
  it("reports a project with no marker as unencrypted", async () => {
    expect(await isProjectEncrypted(PROJECT_ROOT, adapter)).toBe(false);
    expect(await readProjectMarker(PROJECT_ROOT, adapter)).toBeNull();
  });

  it("adds no file to a project that never opted in", async () => {
    await isProjectEncrypted(PROJECT_ROOT, adapter);
    // FR3: an unencrypted project must be byte-for-byte unchanged, so merely
    // asking the question must not create anything.
    expect(await adapter.readdir(PROJECT_ROOT)).toEqual([]);
  });

  it("reports a project with a marker as encrypted", async () => {
    await writeProjectMarker(PROJECT_ROOT, adapter);
    expect(await isProjectEncrypted(PROJECT_ROOT, adapter)).toBe(true);
  });

  it("reverts to unencrypted once the marker is removed", async () => {
    await writeProjectMarker(PROJECT_ROOT, adapter);
    await removeProjectMarker(PROJECT_ROOT, adapter);

    expect(await isProjectEncrypted(PROJECT_ROOT, adapter)).toBe(false);
    expect(await adapter.readdir(PROJECT_ROOT)).toEqual([]);
  });

  it("treats removing an absent marker as a no-op", async () => {
    await expect(
      removeProjectMarker(PROJECT_ROOT, adapter),
    ).resolves.toBeUndefined();
  });
});

describe("project marker — readable without the passphrase", () => {
  it("stores plaintext JSON, not an envelope", async () => {
    await writeProjectMarker(PROJECT_ROOT, adapter);
    const raw = await adapter.readFile(
      `${PROJECT_ROOT}/${PROJECT_MARKER_FILENAME}`,
      "utf-8",
    );
    expect(JSON.parse(raw).encrypted).toBe(true);
  });

  it("round-trips through read", async () => {
    const written = await writeProjectMarker(PROJECT_ROOT, adapter);
    expect(await readProjectMarker(PROJECT_ROOT, adapter)).toEqual(written);
  });

  it("is readable while the project's own files are sealed", async () => {
    // The decisive property: the marker must be legible before anything can be
    // decrypted, so it cannot itself live behind the encrypting adapter.
    const sealed = encryptingAdapter(
      adapter,
      await importAesKey(generateDataKeyBytes()),
    );
    await sealed.writeFile(`${PROJECT_ROOT}/project.json`, '{"a":1}');
    await writeProjectMarker(PROJECT_ROOT, adapter);

    expect(await isProjectEncrypted(PROJECT_ROOT, adapter)).toBe(true);
  });
});

describe("project marker — carries no user-authored text", () => {
  it("serialises exactly the documented fields", async () => {
    const marker = await writeProjectMarker(PROJECT_ROOT, adapter);
    expect(Object.keys(marker).sort()).toEqual([
      "encrypted",
      "encryptedAt",
      "version",
    ]);
  });

  it("leaks neither the project name nor its id", async () => {
    await writeProjectMarker(PROJECT_ROOT, adapter);
    const raw = await adapter.readFile(
      `${PROJECT_ROOT}/${PROJECT_MARKER_FILENAME}`,
      "utf-8",
    );
    // Titles are frequently the most sensitive text a writer has, which is why
    // the marker deliberately holds none (FR18).
    expect(raw).not.toContain("The Whistleblower");
    expect(raw).not.toContain(PROJECT_ID);
  });
});

describe("project marker — rejects what it cannot trust", () => {
  it("raises on malformed JSON rather than assuming unencrypted", async () => {
    await adapter.writeFile(
      `${PROJECT_ROOT}/${PROJECT_MARKER_FILENAME}`,
      "{ not json",
    );
    // Treating a corrupt marker as "not encrypted" could lead to overwriting an
    // encrypted project with plaintext.
    await expect(
      readProjectMarker(PROJECT_ROOT, adapter),
    ).rejects.toBeInstanceOf(ProjectMarkerFormatError);
  });

  it("raises on a structurally invalid marker", async () => {
    await adapter.writeFile(
      `${PROJECT_ROOT}/${PROJECT_MARKER_FILENAME}`,
      JSON.stringify({ version: 1 }),
    );
    await expect(
      readProjectMarker(PROJECT_ROOT, adapter),
    ).rejects.toBeInstanceOf(ProjectMarkerFormatError);
  });

  it("raises on an unknown marker version", async () => {
    await adapter.writeFile(
      `${PROJECT_ROOT}/${PROJECT_MARKER_FILENAME}`,
      JSON.stringify({ version: 99, encrypted: true, encryptedAt: "x" }),
    );
    await expect(
      readProjectMarker(PROJECT_ROOT, adapter),
    ).rejects.toBeInstanceOf(ProjectMarkerFormatError);
  });

  it("propagates the failure through isProjectEncrypted", async () => {
    await adapter.writeFile(
      `${PROJECT_ROOT}/${PROJECT_MARKER_FILENAME}`,
      "{ not json",
    );
    await expect(isProjectEncrypted(PROJECT_ROOT, adapter)).rejects.toThrow();
  });
});
