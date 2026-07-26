// ADR-021 Phase 0 (Task 6): proves the on-device verification harness's own
// plumbing/shape is correct — against the in-memory Capacitor filesystem
// fake, since none of these three checks' *logic* cares whether the
// underlying plugin is real or fake. Only Task 7's actual physical-device
// run (out of scope for automated tests, by design) can tell us whether the
// REAL plugin's numbers/behavior differ from what's asserted here.
//
// `capacitor-filesystem-real.ts` is mocked to return a single shared
// in-memory fake instance for the whole test, mirroring the module's real
// contract (`createRealCapacitorFilesystem()` always resolves the same
// on-device root) so state written by one check (e.g. the FR6 fixture seed)
// is visible to later calls within the same harness run.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return { fakeFs: undefined as unknown };
});

vi.mock("../../src/lib/models/capacitor-filesystem-real", async () => {
  const { createFakeCapacitorFilesystem } =
    await import("../../src/lib/models/capacitor-filesystem");
  const fs = createFakeCapacitorFilesystem();
  mocks.fakeFs = fs;
  return { createRealCapacitorFilesystem: () => fs };
});

async function resetAll(): Promise<void> {
  const { __resetDefaultStorageContextForTests } =
    await import("../../src/lib/models/storage-context");
  __resetDefaultStorageContextForTests();
}

describe("native-device-harness", () => {
  const originalRuntime = process.env.NEXT_PUBLIC_GETWRITE_RUNTIME;

  beforeEach(async () => {
    vi.resetModules();
    // The harness's search check goes through resolveSearchTransport(),
    // which only resolves to the in-process native transport (rather than
    // an HTTP fetch(), which has no server to call in this test) when this
    // env var reads "native" — the same gate the real native build sets.
    process.env.NEXT_PUBLIC_GETWRITE_RUNTIME = "native";
    await resetAll();
  });

  afterEach(() => {
    if (originalRuntime === undefined) {
      delete process.env.NEXT_PUBLIC_GETWRITE_RUNTIME;
    } else {
      process.env.NEXT_PUBLIC_GETWRITE_RUNTIME = originalRuntime;
    }
  });

  it("FR6: the search check returns correctly-shaped, correctly-ordered results against the seeded fixture", async () => {
    const { runNativeDeviceHarness } =
      await import("../../src/lib/models/native-device-harness");

    const report = await runNativeDeviceHarness();

    expect(report.search.projectId).toBe("harness-proj-1");
    expect(report.search.query).toBe("dragon");
    expect(report.search.hitCount).toBe(1);
    expect(report.search.hits).toHaveLength(1);
    expect(report.search.hits[0]).toMatchObject({
      resourceId: "harness-res-1",
      title: "Dragon Notes",
    });
  });

  it("FR7a/FR8: the throughput check returns sensible, non-negative, finite structured numbers with no asserted threshold", async () => {
    const { runNativeDeviceHarness } =
      await import("../../src/lib/models/native-device-harness");

    const report = await runNativeDeviceHarness();
    const { throughput } = report;

    expect(throughput.payloadBytes).toBe(4 * 1024 * 1024);
    expect(Number.isFinite(throughput.writeMs)).toBe(true);
    expect(throughput.writeMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(throughput.readMs)).toBe(true);
    expect(throughput.readMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(throughput.writeMBps)).toBe(true);
    expect(throughput.writeMBps).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(throughput.readMBps)).toBe(true);
    expect(throughput.readMBps).toBeGreaterThanOrEqual(0);
    expect(throughput.roundTripIntegrityOk).toBe(true);
  });

  it("FR7b: the rename-on-collision check runs against the fake and reports its throwing behavior (now matching real Android)", async () => {
    const { runNativeDeviceHarness } =
      await import("../../src/lib/models/native-device-harness");

    const report = await runNativeDeviceHarness();
    const { renameCollision } = report;

    // The fake now throws on a directory rename onto a pre-existing, non-empty
    // destination, faithfully modeling the real @capacitor/filesystem plugin's
    // on-device behavior (confirmed by the Pixel 7 Pro Phase 0 gate). This is
    // also the behavior revision.ts's writeRevision assumes — so the fake, the
    // real device, and the production code now agree.
    expect(renameCollision.threw).toBe(true);
    expect(renameCollision.errorMessage).toMatch(/already exists/i);
    expect(renameCollision.sourceStillExistsAfter).toBe(true);
    // The merge never happened: only the pre-existing entry remains in dst.
    expect(renameCollision.destinationEntriesAfter.sort()).toEqual([
      "pre-existing.txt",
    ]);
    expect(renameCollision.observedBehavior).toBe("threw");
    expect(typeof renameCollision.scenario).toBe("string");
    expect(renameCollision.scenario.length).toBeGreaterThan(0);
  });

  it("returns one report with a valid ISO timestamp covering all three checks", async () => {
    const { runNativeDeviceHarness } =
      await import("../../src/lib/models/native-device-harness");

    const report = await runNativeDeviceHarness();

    expect(() => new Date(report.generatedAt).toISOString()).not.toThrow();
    expect(report.search).toBeDefined();
    expect(report.throughput).toBeDefined();
    expect(report.renameCollision).toBeDefined();
  });
});
