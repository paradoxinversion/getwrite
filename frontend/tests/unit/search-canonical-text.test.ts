// Last Updated: 2026-08-05

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import { encryptingAdapter } from "../../src/lib/models/encryptingAdapter";
import { EnvelopeIntegrityError } from "../../src/lib/models/crypto/envelope";
import {
  generateDataKeyBytes,
  importAesKey,
} from "../../src/lib/models/crypto/primitives";
import { executeSearch } from "../../src/lib/search/execute-search";

const ROOT = "/ws/proj";
const RESOURCE_ID = "11111111-1111-4111-8111-111111111111";

let base: StorageAdapter;
let key: CryptoKey;
const previousAdapter = io.getStorageAdapter();

/** Seeds the shape `executeSearch` reads: index, sidecar, canonical revision. */
async function seed(adapter: StorageAdapter): Promise<void> {
  await adapter.mkdir(`${ROOT}/meta/index`, { recursive: true });
  await adapter.mkdir(`${ROOT}/revisions/${RESOURCE_ID}/v-1`, {
    recursive: true,
  });
  await adapter.writeFile(
    `${ROOT}/project.json`,
    JSON.stringify({ id: "p", name: "P", createdAt: "2026-01-01T00:00:00Z" }),
  );
  await adapter.writeFile(
    `${ROOT}/meta/index/inverted.json`,
    JSON.stringify({ dragon: { [RESOURCE_ID]: 1 } }),
  );
  await adapter.writeFile(
    `${ROOT}/meta/resource-${RESOURCE_ID}.meta.json`,
    JSON.stringify({ id: RESOURCE_ID, name: "Dragon Notes" }),
  );
  await adapter.writeFile(
    `${ROOT}/revisions/${RESOURCE_ID}/v-1/metadata.json`,
    JSON.stringify({
      id: "rev-1",
      resourceId: RESOURCE_ID,
      versionNumber: 1,
      isCanonical: true,
      createdAt: "2026-01-01T00:00:00Z",
      filePath: "content.bin",
      displayName: "v1",
    }),
  );
  await adapter.writeFile(
    `${ROOT}/revisions/${RESOURCE_ID}/v-1/content.bin`,
    "the dragon sleeps",
  );
}

beforeEach(() => {
  base = createMemoryAdapter();
  io.setStorageAdapter(base);
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
});

describe("search — canonical text on an encrypted project", () => {
  it("finds content through the encrypting adapter", async () => {
    key = await importAesKey(generateDataKeyBytes());
    const sealed = encryptingAdapter(base, key);
    await seed(sealed);

    const results = await runInStorageContext(
      { tenantRoot: "/ws", adapter: sealed },
      () => executeSearch(ROOT, "dragon", {}, 10),
    );

    // The symptom that started this: names matched but content did not.
    expect(results).toHaveLength(1);
    expect(results[0].resourceId).toBe(RESOURCE_ID);
  });

  it("raises rather than reporting an undecryptable resource as empty", async () => {
    key = await importAesKey(generateDataKeyBytes());
    const sealed = encryptingAdapter(base, key);
    await seed(sealed);

    // Corrupt the canonical text only — everything else still opens.
    const target = path.join(
      ROOT,
      "revisions",
      RESOURCE_ID,
      "v-1",
      "content.bin",
    );
    const raw = Buffer.from(await base.readFileBuffer(target));
    raw[raw.length - 1] ^= 0xff;
    await base.writeFile(target, raw);

    // FR15: "could not decrypt" must not be flattened into "has no content".
    // Reporting empty hides real work from search and invites an editor to
    // open an empty document over a real file and autosave it back.
    await expect(
      runInStorageContext({ tenantRoot: "/ws", adapter: sealed }, () =>
        executeSearch(ROOT, "dragon", {}, 10),
      ),
    ).rejects.toBeInstanceOf(EnvelopeIntegrityError);
  });

  it("still treats a genuinely missing revision as empty", async () => {
    await seed(base);
    await base.rm(`${ROOT}/revisions/${RESOURCE_ID}/v-1/content.bin`);

    // A stub resource has no canonical text; that is ordinary, not an error.
    const results = await runInStorageContext(
      { tenantRoot: "/ws", adapter: base },
      () => executeSearch(ROOT, "dragon", {}, 10),
    );
    expect(Array.isArray(results)).toBe(true);
  });
});
