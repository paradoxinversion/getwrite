import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runStorageAdapterConformance } from "./storage-adapter-conformance";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { objectStoreAdapter } from "../../src/lib/models/objectStoreAdapter";
import {
  createMemoryObjectStore,
  createFsObjectStore,
} from "../../src/lib/models/object-store";
import { encryptingAdapter } from "../../src/lib/models/encryptingAdapter";
import {
  generateDataKeyBytes,
  importAesKey,
} from "../../src/lib/models/crypto/primitives";

// The default filesystem adapter's behavior is the reference the object-store
// backend must match. We assert the object store against the same suite so the
// seam is provably transparent to the model layer, across three backends.

/**
 * A throwaway data key for a fixture.
 *
 * Deliberately random rather than passphrase-derived: this suite exercises
 * adapter *behaviour*, and running Argon2id per fixture would add seconds to the
 * run while proving nothing the keyring's own tests do not already cover.
 */
const fixtureKey = (): Promise<CryptoKey> =>
  importAesKey(generateDataKeyBytes());

runStorageAdapterConformance("in-memory fs tree (memoryAdapter)", async () => ({
  adapter: createMemoryAdapter(),
}));

runStorageAdapterConformance("object store over in-memory store", async () => ({
  adapter: objectStoreAdapter(createMemoryObjectStore()),
}));

runStorageAdapterConformance("object store over filesystem store", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gw-objstore-conf-"));
  return {
    adapter: objectStoreAdapter(createFsObjectStore(root)),
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
  };
});

// The encrypting decorator (ADR-021 encryption work, Task 4) must be equally
// transparent. Running the *same* suite against it over each backend is what
// proves the claim: if encryption changed any observable behaviour the model
// layer depends on, one of these fourteen assertions would fail. Composing it
// over the object store additionally proves it stacks with ADR-019 rather than
// competing with it.

runStorageAdapterConformance("encrypting over in-memory fs tree", async () => ({
  adapter: encryptingAdapter(createMemoryAdapter(), await fixtureKey()),
}));

runStorageAdapterConformance("encrypting over object store", async () => ({
  adapter: encryptingAdapter(
    objectStoreAdapter(createMemoryObjectStore()),
    await fixtureKey(),
  ),
}));

runStorageAdapterConformance(
  "encrypting over object store on disk",
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "gw-enc-conf-"));
    return {
      adapter: encryptingAdapter(
        objectStoreAdapter(createFsObjectStore(root)),
        await fixtureKey(),
      ),
      cleanup: () => fs.rm(root, { recursive: true, force: true }),
    };
  },
);
