// Last Updated: 2026-08-06

/**
 * Encryption exercised the way a *request* exercises it.
 *
 * `enable-encryption.test.ts` and its siblings pass a plain adapter explicitly.
 * That is the right shape for testing the sweep, but it means none of them
 * touches the adapter production actually runs on: `with-storage-context.ts`
 * binds `workspaceEncryptionAdapter`, and every crypto module that defaults to
 * `getStorageAdapter()` therefore gets the *encrypting* adapter, not the plain
 * one its documentation requires.
 *
 * That gap hid a bug that made encrypting a second project impossible while
 * every existing test passed — the same failure shape as the FR12 defect
 * recorded in ADR-022: a seam that is correct in isolation and wrong once
 * adopted.
 *
 * So these tests bind the adapter exactly as the route does and pass no
 * `adapter` argument anywhere. If a crypto module reaches for the ambient
 * adapter again, something here fails.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import {
  ProjectBusyError,
  __resetWriteBarriersForTests,
  runWithWriteBarrier,
} from "../../src/lib/models/write-barrier";
import { isEnvelope } from "../../src/lib/models/crypto/envelope";
import { isProjectEncrypted } from "../../src/lib/models/crypto/project-marker";
import {
  __resetKeyringSessionForTests,
  getSessionKeyring,
  registerProject,
  requireSessionKeyring,
} from "../../src/lib/models/crypto/keyring-session";
import { workspaceEncryptionAdapter } from "../../src/lib/models/crypto/workspace-adapter";
import { enableProjectEncryption } from "../../src/lib/models/crypto/enable-encryption";
import { readConversionMarker } from "../../src/lib/models/crypto/convert-project";

const WORKSPACE = "/ws";
const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const PASS = "correct horse battery staple";

let base: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

/**
 * Writes a minimal plaintext project.
 *
 * @param id - Project directory id.
 * @param name - Project name for the manifest.
 */
async function seedProject(id: string, name: string): Promise<void> {
  const root = `${WORKSPACE}/${id}`;
  for (const [p, c] of [
    [`${root}/project.json`, `{"id":"${id}","name":"${name}"}`],
    [`${root}/resources/r1/content.txt`, "chapter one"],
    [`${root}/meta/resource-r1.meta.json`, '{"tags":["draft"]}'],
  ]) {
    await base.mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
    await base.writeFile(p, c);
  }
}

/**
 * Runs `fn` under the adapter a real request would carry.
 *
 * Mirrors `withWorkspaceEncryption` in `app/api/_tenant/with-storage-context.ts`,
 * including that the keyring is read *once*, when the request begins.
 *
 * @param fn - The work to run.
 * @returns Whatever `fn` returns.
 */
function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runInStorageContext(
    {
      tenantRoot: WORKSPACE,
      adapter: workspaceEncryptionAdapter(base, WORKSPACE, getSessionKeyring()),
    },
    fn,
  );
}

beforeEach(async () => {
  base = createMemoryAdapter();
  io.setStorageAdapter(base);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
  await base.mkdir(WORKSPACE, { recursive: true });
  await seedProject(FIRST, "The Whistleblower");
  await seedProject(SECOND, "Poetry 2026");
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
});

describe("enabling encryption through the request adapter", () => {
  it("encrypts a second project while the session is already unlocked", async () => {
    // The first request binds with no keyring, so everything passes through.
    await inRequest(() =>
      enableProjectEncryption({
        projectId: FIRST,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
      }),
    );

    // The second binds while unlocked — the case that used to throw
    // EnvelopeFormatError, because registering the key mid-call flipped the
    // request adapter into decrypting the very plaintext it was sealing.
    await inRequest(() =>
      enableProjectEncryption({
        projectId: SECOND,
        projectName: "Poetry 2026",
        passphrase: null,
        workspaceRoot: WORKSPACE,
      }),
    );

    const keyring = requireSessionKeyring();
    expect(keyring.hasProject(FIRST)).toBe(true);
    expect(keyring.hasProject(SECOND)).toBe(true);

    // Sealed on disk, and with its own key (FR6).
    const sealed = await base.readFileBuffer(
      `${WORKSPACE}/${SECOND}/resources/r1/content.txt`,
    );
    expect(isEnvelope(sealed)).toBe(true);
    expect(keyring.projectKey(FIRST)).not.toBe(keyring.projectKey(SECOND));

    // A failed sweep used to strand this, sealed and therefore unparseable.
    expect(
      await base
        .readFile(`${WORKSPACE}/${SECOND}/.converting.json`, "utf-8")
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
  });

  it("still reads the plaintext marker once the workspace is unlocked", async () => {
    await inRequest(() =>
      enableProjectEncryption({
        projectId: FIRST,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
      }),
    );

    // The marker lives inside the project, so a project-routed adapter would
    // try to decrypt it, fail, and report the project as unencrypted (FR18).
    await inRequest(async () => {
      expect(await isProjectEncrypted(`${WORKSPACE}/${FIRST}`)).toBe(true);
    });
  });
});

/**
 * Holds a write barrier open until the returned `release` is called.
 *
 * The structure matters. Work started *inside* `runWithWriteBarrier`'s callback
 * inherits the holder scope and is allowed through by design, so a test written
 * that way asserts nothing. Everything here therefore runs in the caller's
 * scope, which is what an autosave arriving mid-conversion actually looks like.
 *
 * @param projectRoot - Project to hold the barrier on.
 * @returns The holder's promise and the function that lets it finish.
 */
function holdBarrier(projectRoot: string): {
  held: Promise<void>;
  release: () => void;
} {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { held: runWithWriteBarrier(projectRoot, () => gate), release };
}

describe("the write barrier, from a request scope", () => {
  it("refuses an ordinary write to a converting project", async () => {
    const projectRoot = `${WORKSPACE}/${FIRST}`;
    const { held, release } = holdBarrier(projectRoot);

    const refused = await inRequest(() =>
      io
        .writeFile(`${projectRoot}/resources/r1/content.txt`, "late edit")
        .then(() => null)
        .catch((error: unknown) => error),
    );

    release();
    await held;
    expect(refused).toBeInstanceOf(ProjectBusyError);
  });

  it("leaves writes to other projects alone", async () => {
    const { held, release } = holdBarrier(`${WORKSPACE}/${FIRST}`);

    await inRequest(() =>
      io.writeFile(`${WORKSPACE}/${SECOND}/resources/r1/content.txt`, "fine"),
    );

    release();
    await held;
    expect(
      await base.readFile(
        `${WORKSPACE}/${SECOND}/resources/r1/content.txt`,
        "utf-8",
      ),
    ).toBe("fine");
  });
});

describe("a half-converted project", () => {
  it("stays readable while its conversion marker is present (FR22)", async () => {
    await inRequest(() =>
      enableProjectEncryption({
        projectId: FIRST,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
      }),
    );

    const root = `${WORKSPACE}/${FIRST}`;
    // Re-introduce the mixed state a crash leaves behind: one unsealed file,
    // and the marker that says a conversion is in flight.
    await base.writeFile(`${root}/resources/r1/content.txt`, "not yet sealed");
    await base.writeFile(
      `${root}/.converting.json`,
      JSON.stringify({
        version: 1,
        direction: "encrypt",
        startedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    await inRequest(async () => {
      expect(
        await io.readFile(`${root}/resources/r1/content.txt`, "utf-8"),
      ).toBe("not yet sealed");
      // The sealed neighbour still opens normally.
      expect(
        await io.readFile(`${root}/meta/resource-r1.meta.json`, "utf-8"),
      ).toContain("draft");
    });
  });

  it("rejects an unsealed file once the conversion marker is gone", async () => {
    await inRequest(() =>
      enableProjectEncryption({
        projectId: FIRST,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
      }),
    );

    const root = `${WORKSPACE}/${FIRST}`;
    await base.writeFile(`${root}/resources/r1/content.txt`, "plaintext");

    // No marker: accepting this would be a silent downgrade.
    await inRequest(async () => {
      await expect(
        io.readFile(`${root}/resources/r1/content.txt`, "utf-8"),
      ).rejects.toThrow();
    });
  });
});

describe("registerProject when the keyring cannot be persisted", () => {
  it("does not leave a key that exists only in memory", async () => {
    await inRequest(() =>
      enableProjectEncryption({
        projectId: FIRST,
        projectName: "The Whistleblower",
        passphrase: PASS,
        workspaceRoot: WORKSPACE,
      }),
    );

    // Persisting the keyring now fails, the way a full disk would fail it.
    const failing: StorageAdapter = {
      ...base,
      writeFile: async (p: string) => {
        throw new Error(`EACCES: ${p}`);
      },
    };

    await expect(registerProject(SECOND, WORKSPACE, failing)).rejects.toThrow();

    // If the in-memory add survived, a retry would seal SECOND under a key
    // that was never written down — unrecoverable at the next unlock.
    expect(requireSessionKeyring().hasProject(SECOND)).toBe(false);
  });
});

describe("a conversion marker damaged by the crash it records", () => {
  it("reads as absent rather than throwing", async () => {
    const root = `${WORKSPACE}/${FIRST}`;
    // Truncated mid-write — exactly what an interrupted `atomicWriteFile`
    // fallback or a torn page leaves behind.
    await base.writeFile(`${root}/.converting.json`, '{"version":1,"direc');

    // The parse used to sit outside the read's try, so this threw and took
    // adapter resolution, resume and claim down with it: the project became
    // both unopenable and unresumable.
    expect(await readConversionMarker(root, base)).toBeNull();
  });
});
