// Last Updated: 2026-07-25

/**
 * @module native-device-harness
 *
 * **ADR-021 Phase 0 (Task 6).** Manual, on-device verification harness for
 * the physical-device gate required by the native Android Phase 0 spec's
 * FR6/FR7/FR8 (`specs/features/native-android-phase0-walking-skeleton.md`).
 *
 * This module is deliberately **not** wired into any app UI, button, or
 * route — that is explicitly Phase 2 territory per the spec's non-goals. It
 * exposes a single top-level async function, {@link runNativeDeviceHarness},
 * that a human running Task 7 (out of scope here — no emulator/device exists
 * in this environment) can invoke manually from a debug console or a
 * temporary dev-only trigger, once the app has already called
 * `bootstrapNativeStorageContext()` (`native-bootstrap.ts`) at startup in the
 * same process. It returns one JSON-serializable
 * {@link NativeDeviceHarnessReport} — safe to
 * `console.log(JSON.stringify(report, null, 2))` — covering three checks:
 *
 * - **FR6 — search end-to-end.** Seeds a small, deterministic fixture
 *   directly onto the real on-device filesystem — same shape as
 *   `transport-collapse.spike.test.ts`'s `seedProject()` helper
 *   (`project.json`, `meta/index/inverted.json`, a resource sidecar) — then
 *   runs a query through `resolveSearchTransport()` (`search-transport.ts`),
 *   the same entry point production call sites use. On a real native build
 *   (`NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`) that resolves to the
 *   in-process native transport created with **no** injected `deps`, relying
 *   on the ambient {@link StorageContext} `native-bootstrap.ts` already
 *   installed. This module deliberately does **not** import
 *   `native-search-backend.ts` directly — only `search-transport.ts`'s own
 *   dynamic `import()` may reference it (see
 *   `native-search-backend-web-exclusion.test.ts`). The report returns the
 *   raw, ordered hit array so a human can visually diff it against the same
 *   fixture run through the existing web/desktop `/api/project/:id/search`
 *   route to confirm "same hits, same ordering" (FR6). There is no live
 *   server on-device to automate that comparison against — the harness only
 *   makes its own output self-evidently comparable.
 * - **FR7a — base64 read/write throughput.** Times a synthetic buffer's
 *   round trip through `capacitorFsAdapter`'s base64-encoded
 *   `writeFile`/`readFileBuffer`, reporting bytes/sec (as MB/s) for each
 *   direction. Per FR8, **no threshold is asserted or hardcoded here** — a
 *   human sets an acceptable threshold from the numbers this reports after
 *   running it on a physical device.
 * - **FR7b — directory rename-on-collision.** `revision.ts`'s
 *   `writeRevision` stages a fresh temp directory and renames it onto the
 *   final `v-<N>` directory, with a comment asserting "If finalDir exists,
 *   this will throw" (see `revision.ts`) — but the in-memory fake
 *   (`capacitor-filesystem.ts`'s `createFakeCapacitorFilesystem().rename`)
 *   actually *merges* colliding directories silently: it overwrites
 *   file-name collisions and folds in the rest, never throwing. This check
 *   reproduces exactly that collision shape — a non-empty source directory
 *   renamed onto a pre-existing, non-empty destination directory — against
 *   the REAL plugin, and reports what was observed (error thrown and its
 *   message, whether the source directory still exists afterward, and what
 *   ended up in the destination) so a human can compare it to the fake's
 *   assumption. No pass/fail assertion is made — Phase 0 exists precisely to
 *   surface whether this mismatch is real.
 *
 * **Native-only.** Statically imports `capacitor-filesystem-real.ts`, which
 * itself statically imports `@capacitor/filesystem`. Per that module's own
 * doc comment, this is only safe because THIS module is never statically
 * imported from anything reachable by the web/hosted/desktop client bundle —
 * by design, nothing in the tree imports it (see the spec's non-goals on
 * app-UI wiring); it exists as a correctly-implemented, unit-tested seam
 * ready for a human to invoke directly (e.g. via a REPL/debug console) or
 * wire behind a temporary dev-only trigger during Task 7.
 */
import { createRealCapacitorFilesystem } from "./capacitor-filesystem-real";
import { capacitorFsAdapter } from "./capacitorFsAdapter";
import { resolveSearchTransport } from "../../store/transport/search-transport";
import type { SearchResult } from "../../store/search-transport-service";

/**
 * Scratch root the harness seeds/reads/writes under — fixed and disposable,
 * isolated from any real project data the app may already have on-device.
 */
const HARNESS_ROOT = "/harness";

/** FR6 fixture identifiers, matching `transport-collapse.spike.test.ts`'s `seedProject()` shape. */
const FIXTURE_PROJECTS_DIR = "/projects";
const FIXTURE_PROJECT_ID = "harness-proj-1";
const FIXTURE_RESOURCE_ID = "harness-res-1";
const FIXTURE_RESOURCE_TITLE = "Dragon Notes";
const FIXTURE_QUERY = "dragon";

/**
 * FR7a synthetic payload size for the base64 read/write throughput
 * benchmark. 4 MiB is large enough to produce a meaningful, non-instant
 * timing signal for real device I/O plus base64 encode/decode overhead,
 * while staying practical for a human to re-run repeatedly by hand during
 * manual Task 7 verification (no multi-minute transfer per run).
 */
const THROUGHPUT_PAYLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Floor applied to a measured duration before computing a rate, to avoid a
 * divide-by-zero → `Infinity` when timing an effectively-instant operation
 * (e.g. an in-memory fake in unit tests). Real device I/O never approaches
 * this floor, so it never affects genuine on-device measurements.
 */
const MIN_DURATION_MS = 0.001;

/** FR6 report: the raw, ordered search hits for a human to visually diff. */
export interface SearchCheckReport {
  projectId: string;
  query: string;
  hitCount: number;
  hits: SearchResult[];
}

/** FR7a report: measured base64 read/write throughput. No pass/fail — see FR8. */
export interface ThroughputCheckReport {
  payloadBytes: number;
  writeMs: number;
  readMs: number;
  writeMBps: number;
  readMBps: number;
  roundTripIntegrityOk: boolean;
}

/** FR7b report: observed behavior of a real directory rename-on-collision. */
export interface RenameCollisionCheckReport {
  scenario: string;
  threw: boolean;
  errorMessage: string | null;
  sourceStillExistsAfter: boolean;
  destinationEntriesAfter: string[];
  observedBehavior: "overwrote-merged" | "threw" | "unknown";
}

/** The single, JSON-serializable report {@link runNativeDeviceHarness} returns. */
export interface NativeDeviceHarnessReport {
  generatedAt: string;
  search: SearchCheckReport;
  throughput: ThroughputCheckReport;
  renameCollision: RenameCollisionCheckReport;
}

/**
 * Seeds the FR6 fixture directly onto the real on-device filesystem, in the
 * exact shape `transport-collapse.spike.test.ts`'s `seedProject()` helper
 * uses: `project.json`, an inverted index mapping the fixture query to the
 * fixture resource, and a sidecar carrying the resource's display name.
 */
async function seedSearchFixture(): Promise<void> {
  const adapter = capacitorFsAdapter(createRealCapacitorFilesystem());
  const root = `${FIXTURE_PROJECTS_DIR}/${FIXTURE_PROJECT_ID}`;
  await adapter.mkdir(`${root}/meta/index`, { recursive: true });
  await adapter.writeFile(
    `${root}/project.json`,
    JSON.stringify({ id: FIXTURE_PROJECT_ID }),
  );
  await adapter.writeFile(
    `${root}/meta/index/inverted.json`,
    JSON.stringify({ [FIXTURE_QUERY]: { [FIXTURE_RESOURCE_ID]: 3 } }),
  );
  await adapter.writeFile(
    `${root}/meta/resource-${FIXTURE_RESOURCE_ID}.meta.json`,
    JSON.stringify({ name: FIXTURE_RESOURCE_TITLE }),
  );
}

/**
 * FR6: seeds the fixture, then runs a real search through
 * {@link resolveSearchTransport} — the same production entry point call
 * sites use, with no `deps` of its own to inject — so the call resolves
 * against whatever ambient {@link StorageContext} `native-bootstrap.ts`
 * already installed for this process (on a real native build, where
 * `NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`, this resolves to the
 * in-process native transport).
 */
async function runSearchCheck(): Promise<SearchCheckReport> {
  await seedSearchFixture();
  const transport = await resolveSearchTransport();
  const hits = await transport.search(FIXTURE_PROJECT_ID, FIXTURE_QUERY);
  return {
    projectId: FIXTURE_PROJECT_ID,
    query: FIXTURE_QUERY,
    hitCount: hits.length,
    hits,
  };
}

/** Converts bytes transferred over a duration (ms) into MB/s, floor-guarded against divide-by-zero. */
function toMBps(bytes: number, durationMs: number): number {
  const effectiveMs = Math.max(durationMs, MIN_DURATION_MS);
  return bytes / 1024 / 1024 / (effectiveMs / 1000);
}

/**
 * FR7a/FR8: writes and reads back a synthetic buffer through
 * `capacitorFsAdapter`'s base64-encoded `writeFile`/`readFileBuffer`, timing
 * each direction independently. Reports raw measured numbers only — no
 * threshold is asserted (FR8: a human sets one from real device data).
 */
async function runThroughputCheck(): Promise<ThroughputCheckReport> {
  const adapter = capacitorFsAdapter(createRealCapacitorFilesystem());
  const path = `${HARNESS_ROOT}/perf/blob.bin`;

  const payload = Buffer.alloc(THROUGHPUT_PAYLOAD_BYTES);
  for (let i = 0; i < payload.length; i += 1) payload[i] = i % 256;

  const writeStart = performance.now();
  await adapter.writeFile(path, payload);
  const writeMs = performance.now() - writeStart;

  const readStart = performance.now();
  const readBack = await adapter.readFileBuffer(path);
  const readMs = performance.now() - readStart;

  return {
    payloadBytes: THROUGHPUT_PAYLOAD_BYTES,
    writeMs,
    readMs,
    writeMBps: toMBps(THROUGHPUT_PAYLOAD_BYTES, writeMs),
    readMBps: toMBps(THROUGHPUT_PAYLOAD_BYTES, readMs),
    roundTripIntegrityOk: readBack.equals(payload),
  };
}

/**
 * FR7: reproduces the directory rename-on-collision shape
 * `revision.ts`'s `writeRevision` comment assumes throws — a non-empty
 * source directory renamed onto a pre-existing, non-empty destination
 * directory — against the REAL plugin, and reports what was actually
 * observed. Makes no pass/fail assertion; the mismatch (if any) against the
 * in-memory fake's silent-merge behavior is exactly what a human evaluates.
 */
async function runRenameCollisionCheck(): Promise<RenameCollisionCheckReport> {
  const adapter = capacitorFsAdapter(createRealCapacitorFilesystem());
  const srcDir = `${HARNESS_ROOT}/rename/src`;
  const dstDir = `${HARNESS_ROOT}/rename/dst`;

  await adapter.mkdir(srcDir, { recursive: true });
  await adapter.writeFile(`${srcDir}/from-src.txt`, "from source");
  await adapter.mkdir(dstDir, { recursive: true });
  await adapter.writeFile(
    `${dstDir}/pre-existing.txt`,
    "pre-existing in destination",
  );

  let didThrow = false;
  let errorMessage: string | null = null;
  try {
    await adapter.rename(srcDir, dstDir);
  } catch (err) {
    didThrow = true;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  let isSourceStillPresentAfter = true;
  try {
    await adapter.readdir(srcDir);
  } catch {
    isSourceStillPresentAfter = false;
  }

  let destinationEntriesAfter: string[] = [];
  try {
    destinationEntriesAfter = (await adapter.readdir(dstDir)) as string[];
  } catch {
    destinationEntriesAfter = [];
  }

  const observedBehavior: RenameCollisionCheckReport["observedBehavior"] =
    didThrow
      ? "threw"
      : !isSourceStillPresentAfter && destinationEntriesAfter.length > 0
        ? "overwrote-merged"
        : "unknown";

  return {
    scenario:
      "rename a non-empty source directory onto a pre-existing, non-empty " +
      "destination directory — mirrors revision.ts's writeRevision temp-dir " +
      "-> v-<N> rename, whose comment assumes rename throws when the " +
      "destination already exists; the in-memory fake instead merges " +
      "silently rather than throwing",
    threw: didThrow,
    errorMessage,
    sourceStillExistsAfter: isSourceStillPresentAfter,
    destinationEntriesAfter,
    observedBehavior,
  };
}

/**
 * Runs all three ADR-021 Phase 0 physical-device checks (FR6, FR7a, FR7b)
 * and returns a single structured, JSON-serializable report. Must be
 * invoked manually, on-device, after `bootstrapNativeStorageContext()` has
 * already run for this process (Task 7 — not automated, not run here).
 */
export async function runNativeDeviceHarness(): Promise<NativeDeviceHarnessReport> {
  const search = await runSearchCheck();
  const throughput = await runThroughputCheck();
  const renameCollision = await runRenameCollisionCheck();

  return {
    generatedAt: new Date().toISOString(),
    search,
    throughput,
    renameCollision,
  };
}
