// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { Dirent } from "node:fs";
import type { ReaddirResult, StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import {
  ProjectBusyError,
  __resetWriteBarriersForTests,
  isWriteBarrierHeld,
  runWithWriteBarrier,
} from "../../src/lib/models/write-barrier";
import { isEnvelope, open } from "../../src/lib/models/crypto/envelope";
import {
  generateDataKeyBytes,
  importAesKey,
} from "../../src/lib/models/crypto/primitives";
import {
  PROJECT_MARKER_FILENAME,
  isProjectEncrypted,
} from "../../src/lib/models/crypto/project-marker";
import {
  ConversionDirectionMismatchError,
  convertProject,
  readConversionMarker,
} from "../../src/lib/models/crypto/convert-project";

const WORKSPACE = "/ws";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ROOT = `${WORKSPACE}/${PROJECT_ID}`;

/** The file shapes a real project holds, per `projects/` on disk. */
const ORIGINAL: ReadonlyArray<readonly [string, string]> = [
  [`${ROOT}/project.json`, '{"id":"abc","name":"The Whistleblower"}'],
  [`${ROOT}/resources/r1/content.txt`, "chapter one"],
  [`${ROOT}/resources/r1/content.tiptap.json`, '{"doc":1}'],
  [`${ROOT}/resources/r2/content.txt`, "chapter two"],
  [`${ROOT}/meta/resource-r1.meta.json`, '{"tags":["draft"]}'],
  [`${ROOT}/meta/index/inverted.json`, '{"whistle":["r1"]}'],
  [`${ROOT}/revisions/r1/v-1/content.txt`, "chapter one, older"],
  [`${ROOT}/.trash/resources/r9/content.txt`, "deleted scene"],
];

class Crash extends Error {}

/** Wraps an adapter so the Nth operation throws, simulating a hard stop. */
function faultInjecting(
  inner: StorageAdapter,
  crashAt: number,
): StorageAdapter & { ops: () => number } {
  let ops = 0;
  const step = (): void => {
    if (++ops === crashAt) throw new Crash(`crash at op ${ops}`);
  };
  return {
    ops: () => ops,
    mkdir: async (p, o) => (step(), inner.mkdir(p, o)),
    writeFile: async (p, d, o) => (step(), inner.writeFile(p, d, o)),
    readFile: async (p, e) => (step(), inner.readFile(p, e)),
    readFileBuffer: async (p) => (step(), inner.readFileBuffer(p)),
    readdir: async (p, o): Promise<ReaddirResult> => (
      step(),
      inner.readdir(p, o)
    ),
    stat: async (p) => (step(), inner.stat(p)),
    rm: async (p, o) => (step(), inner.rm(p, o)),
    rename: async (a, b) => (step(), inner.rename(a, b)),
    copyFile: async (s, d) => (step(), inner.copyFile(s, d)),
    cp: async (s, d, o) => (step(), inner.cp(s, d, o)),
    appendFile: async (p, d) => (step(), inner.appendFile(p, d)),
  };
}

let store: StorageAdapter;
let key: CryptoKey;
const previousAdapter = io.getStorageAdapter();

async function seedProject(): Promise<void> {
  for (const [p, content] of ORIGINAL) {
    await store.mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
    await store.writeFile(p, content);
  }
}

/** Every original file's plaintext, whichever form it is currently stored in. */
async function readThroughEitherForm(
  adapter: StorageAdapter,
  path: string,
): Promise<string> {
  const raw = await adapter.readFileBuffer(path);
  const bytes = isEnvelope(raw) ? await open(key, raw) : raw;
  return new TextDecoder().decode(bytes);
}

/** Lists every file under the project, recursively. */
async function allFiles(
  adapter: StorageAdapter,
  dir: string = ROOT,
): Promise<string[]> {
  const out: string[] = [];
  const entries = (await adapter.readdir(dir, {
    withFileTypes: true,
  })) as Dirent[];
  for (const entry of entries) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await allFiles(adapter, child)));
    else out.push(child);
  }
  return out.sort();
}

beforeEach(async () => {
  store = createMemoryAdapter();
  io.setStorageAdapter(store);
  __resetWriteBarriersForTests();
  key = await importAesKey(generateDataKeyBytes());
  await seedProject();
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetWriteBarriersForTests();
});

describe("convertProject — encrypting a project", () => {
  it("seals every file and marks the project encrypted", async () => {
    await convertProject({ projectRoot: ROOT, direction: "encrypt", key });

    for (const [path, content] of ORIGINAL) {
      const raw = await store.readFileBuffer(path);
      expect(isEnvelope(raw), `${path} must be sealed`).toBe(true);
      expect(new TextDecoder().decode(await open(key, raw))).toBe(content);
    }
    expect(await isProjectEncrypted(ROOT, store)).toBe(true);
  });

  it("leaves no conversion marker or temp file behind", async () => {
    await convertProject({ projectRoot: ROOT, direction: "encrypt", key });

    expect(await readConversionMarker(ROOT, store)).toBeNull();
    for (const path of await allFiles(store)) {
      expect(path.endsWith(".tmp")).toBe(false);
    }
  });

  it("keeps the encryption marker itself readable, not sealed", async () => {
    await convertProject({ projectRoot: ROOT, direction: "encrypt", key });

    // Sealing this would make the project's own encrypted state unreadable.
    const raw = await store.readFile(
      `${ROOT}/${PROJECT_MARKER_FILENAME}`,
      "utf-8",
    );
    expect(JSON.parse(raw).encrypted).toBe(true);
  });

  it("is a no-op when run again", async () => {
    const first = await convertProject({
      projectRoot: ROOT,
      direction: "encrypt",
      key,
    });
    const sealedBefore = await store.readFileBuffer(`${ROOT}/project.json`);

    const second = await convertProject({
      projectRoot: ROOT,
      direction: "encrypt",
      key,
    });

    expect(first.filesConverted).toBe(ORIGINAL.length);
    expect(second.filesConverted).toBe(0);
    expect(second.filesSkipped).toBe(ORIGINAL.length);
    // Untouched, not re-sealed with a fresh nonce.
    expect(
      Buffer.from(await store.readFileBuffer(`${ROOT}/project.json`)).equals(
        Buffer.from(sealedBefore),
      ),
    ).toBe(true);
  });
});

describe("convertProject — decrypting a project", () => {
  it("restores every file byte-for-byte and clears the marker", async () => {
    await convertProject({ projectRoot: ROOT, direction: "encrypt", key });
    await convertProject({ projectRoot: ROOT, direction: "decrypt", key });

    for (const [path, content] of ORIGINAL) {
      expect(await store.readFile(path, "utf-8")).toBe(content);
    }
    expect(await isProjectEncrypted(ROOT, store)).toBe(false);
  });

  it("refuses to switch direction mid-conversion", async () => {
    // An interrupted encrypt must be finished as an encrypt; flipping halfway
    // would leave files in both forms with no record of which is which.
    const faulty = faultInjecting(store, 6);
    await expect(
      convertProject({
        projectRoot: ROOT,
        direction: "encrypt",
        key,
        adapter: faulty,
      }),
    ).rejects.toBeInstanceOf(Crash);

    await expect(
      convertProject({ projectRoot: ROOT, direction: "decrypt", key }),
    ).rejects.toBeInstanceOf(ConversionDirectionMismatchError);
  });
});

describe("convertProject — crash at every operation, then resume", () => {
  /** Asserts the fully-converted end state for a direction. */
  async function expectSettled(
    encrypted: boolean,
    where: string,
  ): Promise<void> {
    expect(await readConversionMarker(ROOT, store), where).toBeNull();
    expect(await isProjectEncrypted(ROOT, store), where).toBe(encrypted);

    for (const [path, content] of ORIGINAL) {
      const raw = await store.readFileBuffer(path);
      expect(isEnvelope(raw), `${where}: ${path} form`).toBe(encrypted);
      expect(
        await readThroughEitherForm(store, path),
        `${where}: ${path}`,
      ).toBe(content);
    }
    for (const path of await allFiles(store)) {
      expect(path.endsWith(".tmp"), `${where}: orphan temp ${path}`).toBe(
        false,
      );
    }
  }

  /** Asserts no data is lost or unreadable at an interrupted point. */
  async function expectMidCrashIntact(where: string): Promise<void> {
    for (const [path, content] of ORIGINAL) {
      const hasFile = await io.exists(path);
      const hasTemp = await io.exists(`${path}.tmp`);
      expect(hasFile || hasTemp, `${where}: ${path} lost`).toBe(true);
      if (hasFile) {
        // FR22: openable, never half-readable — in whichever form it is in.
        expect(
          await readThroughEitherForm(store, path),
          `${where}: ${path} unreadable`,
        ).toBe(content);
      }
    }

    // The other half of "openable": a reader follows the markers, not a guess.
    // Either a conversion marker is present — so tolerant reads engage (Task
    // 15) and a mixed project is expected — or the project's declared state
    // must agree with the actual form of every file. Anything else is a project
    // that claims one thing and holds another.
    if ((await readConversionMarker(ROOT, store)) === null) {
      const isDeclaredEncrypted = await isProjectEncrypted(ROOT, store);
      for (const [path] of ORIGINAL) {
        if (!(await io.exists(path))) continue;
        expect(
          isEnvelope(await store.readFileBuffer(path)),
          `${where}: ${path} disagrees with the project's declared state`,
        ).toBe(isDeclaredEncrypted);
      }
    }
  }

  it("completes a clean encrypt in a bounded number of operations", async () => {
    const counter = faultInjecting(store, Number.POSITIVE_INFINITY);
    await convertProject({
      projectRoot: ROOT,
      direction: "encrypt",
      key,
      adapter: counter,
    });
    expect(counter.ops()).toBeGreaterThan(ORIGINAL.length);
  });

  it("survives a crash at any single operation and resumes", async () => {
    // Establish the operation count of a clean run, then crash at each index.
    const probing = faultInjecting(store, Number.POSITIVE_INFINITY);
    await convertProject({
      projectRoot: ROOT,
      direction: "encrypt",
      key,
      adapter: probing,
    });
    const totalOps = probing.ops();
    // Guards against silent coverage collapse: if the sweep ever stopped
    // finding files, every crash iteration below would trivially pass.
    expect(totalOps).toBeGreaterThan(30);

    for (let k = 1; k <= totalOps; k++) {
      store = createMemoryAdapter();
      io.setStorageAdapter(store);
      __resetWriteBarriersForTests();
      await seedProject();

      const faulty = faultInjecting(store, k);
      await convertProject({
        projectRoot: ROOT,
        direction: "encrypt",
        key,
        adapter: faulty,
      }).catch((error: unknown) => {
        if (!(error instanceof Crash)) throw error;
      });

      await expectMidCrashIntact(`crash@${k}`);

      // Resume: simply run it again.
      await convertProject({ projectRoot: ROOT, direction: "encrypt", key });
      await expectSettled(true, `resume after crash@${k}`);
    }
  });

  it("survives a crash at any single operation while decrypting", async () => {
    await convertProject({ projectRoot: ROOT, direction: "encrypt", key });
    const sealedSnapshot = new Map<string, Buffer>();
    for (const path of await allFiles(store)) {
      sealedSnapshot.set(path, Buffer.from(await store.readFileBuffer(path)));
    }

    const probing = faultInjecting(store, Number.POSITIVE_INFINITY);
    await convertProject({
      projectRoot: ROOT,
      direction: "decrypt",
      key,
      adapter: probing,
    });
    const totalOps = probing.ops();
    // Guards against silent coverage collapse: if the sweep ever stopped
    // finding files, every crash iteration below would trivially pass.
    expect(totalOps).toBeGreaterThan(30);

    for (let k = 1; k <= totalOps; k++) {
      store = createMemoryAdapter();
      io.setStorageAdapter(store);
      __resetWriteBarriersForTests();
      for (const [path, bytes] of sealedSnapshot) {
        await store.mkdir(path.slice(0, path.lastIndexOf("/")), {
          recursive: true,
        });
        await store.writeFile(path, bytes);
      }

      const faulty = faultInjecting(store, k);
      await convertProject({
        projectRoot: ROOT,
        direction: "decrypt",
        key,
        adapter: faulty,
      }).catch((error: unknown) => {
        if (!(error instanceof Crash)) throw error;
      });

      await convertProject({ projectRoot: ROOT, direction: "decrypt", key });
      await expectSettled(false, `decrypt resume after crash@${k}`);
    }
  });
});

describe("convertProject — concurrency", () => {
  it("holds the write barrier for the whole sweep and releases it after", async () => {
    // Refusal itself is covered in write-barrier.test.ts; what matters here is
    // that the conversion actually takes the barrier out for its duration.
    // Work started from `onProgress` runs inside the holder's async scope and
    // is deliberately permitted, so this asserts barrier state rather than
    // attempting a write, which would prove nothing.
    const seenDuringSweep: boolean[] = [];

    await convertProject({
      projectRoot: ROOT,
      direction: "encrypt",
      key,
      onProgress: () => {
        seenDuringSweep.push(isWriteBarrierHeld(ROOT));
      },
    });

    expect(seenDuringSweep.length).toBeGreaterThan(0);
    expect(seenDuringSweep.every(Boolean)).toBe(true);
    expect(isWriteBarrierHeld(ROOT)).toBe(false);
  });

  it("refuses to start while another conversion holds the barrier", async () => {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });

    const first = runWithWriteBarrier(ROOT, () => gate);
    await expect(
      convertProject({ projectRoot: ROOT, direction: "encrypt", key }),
    ).rejects.toBeInstanceOf(ProjectBusyError);

    open();
    await first;
  });
});
