// SPIKE (ADR-021, the riskier half): proves the WRITE path runs correctly
// in-process over the Capacitor adapter — the half the search spike did not
// touch. Writes are where the real unknowns live:
//
//   1. Revision durability — writeRevision stages files in a temp dir then
//      `rename`s it onto `v-<N>`. This exercises the adapter's *directory*
//      rename, and the temp dir must leave no trace once moved.
//   2. Single-canonical invariant — each canonical save must flip the previous
//      canonical off (a multi-file metadata rewrite) so exactly one revision is
//      canonical.
//   3. Lock serialization — createRevision takes a per-resource in-memory lock
//      so concurrent saves get distinct sequential version numbers instead of
//      colliding on the same `v-<N>` directory.
//
// All three run through capacitorFsAdapter over the in-memory plugin fake, in
// the normal Vitest gate. (The fire-and-forget indexer is disabled under
// VITEST, so the write path here is fully deterministic.)
import { describe, expect, it } from "vitest";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import {
  createFakeCapacitorFilesystem,
  type CapacitorFilesystemLike,
} from "../../src/lib/models/capacitor-filesystem";
import { createRevision } from "../../src/lib/models/revision-manager";
import {
  getCanonicalRevision,
  listRevisions,
  revisionDir,
} from "../../src/lib/models/revision";
import { readFile, readdir } from "../../src/lib/models/io";
import type { Dirent } from "node:fs";

const PROJECT_ROOT = "/projects/proj-1";

/** Runs `fn` with io.ts bound to a fresh Capacitor-adapter-backed fake. */
async function withCapacitorFs<T>(
  fn: (fs: CapacitorFilesystemLike) => Promise<T>,
): Promise<T> {
  const fs = createFakeCapacitorFilesystem();
  const adapter = capacitorFsAdapter(fs);
  return runInStorageContext({ tenantRoot: "/projects", adapter }, () =>
    fn(fs),
  );
}

describe("write path — revision durability (temp dir → v-N rename)", () => {
  it("creates a canonical v-1 whose content round-trips, leaving no temp dir", async () => {
    await withCapacitorFs(async () => {
      const rid = "11111111-1111-4111-8111-111111111111";
      const rev = await createRevision(PROJECT_ROOT, rid, "first draft", {
        isCanonical: true,
      });

      expect(rev.versionNumber).toBe(1);
      expect(rev.isCanonical).toBe(true);

      // Content landed at the final v-1 dir (the rename committed).
      const content = await readFile(
        `${revisionDir(PROJECT_ROOT, rid, 1)}/content.bin`,
        "utf8",
      );
      expect(content).toBe("first draft");

      // The staging dir was renamed away, not left behind.
      const base = `${PROJECT_ROOT}/revisions/${rid}`;
      const entries = (await readdir(base, {
        withFileTypes: true,
      })) as Dirent[];
      expect(entries.some((e) => e.name.startsWith(".tmp-"))).toBe(false);
      expect(entries.some((e) => e.name === "v-1")).toBe(true);
    });
  });
});

describe("write path — single-canonical invariant across saves", () => {
  it("a second canonical save flips the prior one off", async () => {
    await withCapacitorFs(async () => {
      const rid = "22222222-2222-4222-8222-222222222222";
      await createRevision(PROJECT_ROOT, rid, "v1 body", { isCanonical: true });
      const second = await createRevision(PROJECT_ROOT, rid, "v2 body", {
        isCanonical: true,
      });

      expect(second.versionNumber).toBe(2);

      const canonical = await getCanonicalRevision(PROJECT_ROOT, rid);
      expect(canonical?.versionNumber).toBe(2);

      const all = await listRevisions(PROJECT_ROOT, rid);
      expect(all).toHaveLength(2);
      // Exactly one canonical, and it is v-2.
      expect(
        all.filter((r) => r.isCanonical).map((r) => r.versionNumber),
      ).toEqual([2]);

      const v2 = await readFile(
        `${revisionDir(PROJECT_ROOT, rid, 2)}/content.bin`,
        "utf8",
      );
      expect(v2).toBe("v2 body");
    });
  });
});

describe("write path — lock serializes concurrent saves", () => {
  it("two concurrent createRevision calls get distinct sequential versions", async () => {
    await withCapacitorFs(async () => {
      const rid = "33333333-3333-4333-8333-333333333333";

      // Without the per-resource lock, both calls would compute nextVersionNumber
      // === 1 and the second writeRevision would collide on v-1. The lock forces
      // sequential numbering.
      const [a, b] = await Promise.all([
        createRevision(PROJECT_ROOT, rid, "concurrent A", {}),
        createRevision(PROJECT_ROOT, rid, "concurrent B", {}),
      ]);

      expect([a.versionNumber, b.versionNumber].sort()).toEqual([1, 2]);
      const all = await listRevisions(PROJECT_ROOT, rid);
      expect(all).toHaveLength(2);
    });
  });
});
