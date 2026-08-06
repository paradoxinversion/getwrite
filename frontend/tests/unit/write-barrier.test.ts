// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import {
  ProjectBusyError,
  __resetWriteBarriersForTests,
  isWriteBarrierHeld,
  runWithWriteBarrier,
} from "../../src/lib/models/write-barrier";

const WORKSPACE = "/ws";
const PROJECT_A = `${WORKSPACE}/11111111-1111-4111-8111-111111111111`;
const PROJECT_B = `${WORKSPACE}/22222222-2222-4222-8222-222222222222`;

let base: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

/** Runs `fn` as an ordinary project-scoped operation, as the app would. */
function asOperation<T>(
  projectRoot: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(
    runInStorageContext(
      { tenantRoot: WORKSPACE, adapter: base, projectRoot },
      fn,
    ),
  );
}

/**
 * Holds a barrier on `projectRoot` while running `outside`.
 *
 * `outside` runs in a *different* async scope from the barrier holder, which is
 * the whole point: work nested inside `runWithWriteBarrier` inherits the
 * holder's scope and is deliberately allowed through, so testing the refusal
 * path from in there would prove nothing.
 */
async function whileBarrierHeld(
  projectRoot: string,
  outside: () => Promise<void>,
): Promise<void> {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const held = runWithWriteBarrier(projectRoot, () => gate);
  try {
    await outside();
  } finally {
    open();
    await held;
  }
}

beforeEach(async () => {
  base = createMemoryAdapter();
  io.setStorageAdapter(base);
  __resetWriteBarriersForTests();
  for (const root of [PROJECT_A, PROJECT_B]) {
    await base.mkdir(root, { recursive: true });
  }
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetWriteBarriersForTests();
});

describe("write barrier — when nothing is held", () => {
  it("reports no barrier", () => {
    expect(isWriteBarrierHeld(PROJECT_A)).toBe(false);
  });

  it("lets writes through untouched", async () => {
    await asOperation(PROJECT_A, () =>
      io.writeFile(`${PROJECT_A}/a.txt`, "chapter one"),
    );
    expect(await base.readFile(`${PROJECT_A}/a.txt`, "utf-8")).toBe(
      "chapter one",
    );
  });

  it("lets writes through when the context names no project", async () => {
    // Workspace-level artefacts (the keyring, the name index) belong to no
    // project and must never be barred.
    await runInStorageContext({ tenantRoot: WORKSPACE, adapter: base }, () =>
      io.writeFile(`${WORKSPACE}/.getwrite-keyring.json`, "{}"),
    );
    expect(await io.exists(`${WORKSPACE}/.getwrite-keyring.json`)).toBe(true);
  });
});

describe("write barrier — while a conversion holds it", () => {
  it("reports the barrier as held, and only for that project", async () => {
    await whileBarrierHeld(PROJECT_A, async () => {
      expect(isWriteBarrierHeld(PROJECT_A)).toBe(true);
      expect(isWriteBarrierHeld(PROJECT_B)).toBe(false);
    });
  });

  it("refuses an outside write, fast and by name", async () => {
    await whileBarrierHeld(PROJECT_A, async () => {
      await expect(
        asOperation(PROJECT_A, () =>
          io.writeFile(`${PROJECT_A}/a.txt`, "autosave"),
        ),
      ).rejects.toBeInstanceOf(ProjectBusyError);
    });
  });

  it("refuses every mutating operation, not merely writeFile", async () => {
    await asOperation(PROJECT_A, () =>
      io.writeFile(`${PROJECT_A}/seed.txt`, "seed"),
    );

    await whileBarrierHeld(PROJECT_A, async () => {
      const mutations: Array<[string, () => Promise<unknown>]> = [
        ["writeFile", () => io.writeFile(`${PROJECT_A}/a.txt`, "x")],
        [
          "atomicWriteFile",
          () => io.atomicWriteFile(`${PROJECT_A}/b.txt`, "x"),
        ],
        ["appendFile", () => io.appendFile(`${PROJECT_A}/seed.txt`, "x")],
        ["mkdir", () => io.mkdir(`${PROJECT_A}/sub`, { recursive: true })],
        ["rm", () => io.rm(`${PROJECT_A}/seed.txt`)],
        ["rename", () => io.rename(`${PROJECT_A}/seed.txt`, `${PROJECT_A}/r`)],
        [
          "copyFile",
          () => io.copyFile(`${PROJECT_A}/seed.txt`, `${PROJECT_A}/c`),
        ],
        ["cp", () => io.cp(`${PROJECT_A}/seed.txt`, `${PROJECT_A}/d`)],
      ];

      for (const [name, mutate] of mutations) {
        await expect(
          asOperation(PROJECT_A, mutate),
          `${name} must be refused while the barrier is held`,
        ).rejects.toBeInstanceOf(ProjectBusyError);
      }
    });
  });

  it("still allows reads", async () => {
    await asOperation(PROJECT_A, () =>
      io.writeFile(`${PROJECT_A}/a.txt`, "chapter one"),
    );

    await whileBarrierHeld(PROJECT_A, async () => {
      expect(
        await asOperation(PROJECT_A, () =>
          io.readFile(`${PROJECT_A}/a.txt`, "utf-8"),
        ),
      ).toBe("chapter one");
      expect(
        await asOperation(PROJECT_A, () => io.readdir(PROJECT_A)),
      ).toContain("a.txt");
    });
  });

  it("leaves other projects writable", async () => {
    await whileBarrierHeld(PROJECT_A, async () => {
      await asOperation(PROJECT_B, () =>
        io.writeFile(`${PROJECT_B}/a.txt`, "unaffected"),
      );
    });
    expect(await base.readFile(`${PROJECT_B}/a.txt`, "utf-8")).toBe(
      "unaffected",
    );
  });

  it("lets the holder itself write", async () => {
    // The conversion sweep is the one writer that must get through.
    await runWithWriteBarrier(PROJECT_A, () =>
      asOperation(PROJECT_A, () =>
        io.writeFile(`${PROJECT_A}/converted.txt`, "sealed"),
      ),
    );
    expect(await base.readFile(`${PROJECT_A}/converted.txt`, "utf-8")).toBe(
      "sealed",
    );
  });
});

describe("write barrier — release", () => {
  it("releases when the work finishes", async () => {
    await runWithWriteBarrier(PROJECT_A, async () => undefined);
    expect(isWriteBarrierHeld(PROJECT_A)).toBe(false);
    await asOperation(PROJECT_A, () =>
      io.writeFile(`${PROJECT_A}/a.txt`, "ok"),
    );
  });

  it("releases when the work throws", async () => {
    await expect(
      runWithWriteBarrier(PROJECT_A, async () => {
        throw new Error("conversion blew up");
      }),
    ).rejects.toThrow("conversion blew up");

    // A crashed conversion must not leave the project permanently unwritable.
    expect(isWriteBarrierHeld(PROJECT_A)).toBe(false);
    await asOperation(PROJECT_A, () =>
      io.writeFile(`${PROJECT_A}/a.txt`, "ok"),
    );
  });

  it("refuses to acquire a barrier twice", async () => {
    await whileBarrierHeld(PROJECT_A, async () => {
      await expect(
        runWithWriteBarrier(PROJECT_A, async () => undefined),
      ).rejects.toBeInstanceOf(ProjectBusyError);
    });
  });
});

describe("write barrier — the hazard it exists to prevent", () => {
  it("stops an autosave landing plaintext in a project being converted", async () => {
    // Conversion-spike Hazard 1: the sweep converts a file, an editor autosave
    // then rewrites it as plaintext, and the sweep never revisits it — leaving
    // a plaintext file in a project marked encrypted.
    await asOperation(PROJECT_A, () =>
      io.writeFile(`${PROJECT_A}/chapter.txt`, "plaintext"),
    );

    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });

    const conversion = runWithWriteBarrier(PROJECT_A, async () => {
      // The sweep converts the file, as the holder.
      await asOperation(PROJECT_A, () =>
        io.writeFile(`${PROJECT_A}/chapter.txt`, "SEALED"),
      );
      await gate;
    });

    // A concurrent autosave, from outside the holder's scope, tries to write
    // plaintext back over the converted file.
    await expect(
      asOperation(PROJECT_A, () =>
        io.writeFile(`${PROJECT_A}/chapter.txt`, "autosaved plaintext"),
      ),
    ).rejects.toBeInstanceOf(ProjectBusyError);

    open();
    await conversion;

    expect(await base.readFile(`${PROJECT_A}/chapter.txt`, "utf-8")).toBe(
      "SEALED",
    );
  });
});
